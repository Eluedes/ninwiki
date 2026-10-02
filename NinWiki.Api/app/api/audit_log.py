"""
Leitura do LOG GERAL do sistema (quem fez o que, quando, de onde).

So' GET - o log e' escrito automaticamente pelo servidor (ver
app/core/audit.py), nunca por um cliente. Um log que qualquer um pode
editar deixa de servir pra' auditoria.

QUEM VE O QUE (camadas):
  - Historico de UMA entry (entityType + entityId de conteudo): qualquer
    staff logada (usado na aba "Historico" dentro dos editores).
  - Feed geral de CONTEUDO (criar/editar/apagar/publicar/upload): Adm e S.Adm
    (permissao audit.view).
  - Log COMPLETO - logins, mudancas de equipe, tentativas negadas e IPs:
    SO' o S.Adm (permissao audit.view_all). Pra' os demais cargos esses
    registros simplesmente nao aparecem, e o IP vem sempre vazio.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission, has_permission
from app.models.users import AuditLogEntry, User

router = APIRouter(prefix="/audit-log", tags=["audit-log"])

# Tipos de registro que sao "trabalho de conteudo" - o que o Adm pode ver.
# Todo o resto (auth, staff, security...) e' log completo, so' do S.Adm.
CONTENT_ENTITY_TYPES = {"content_item", "jutsu", "mastery", "upload", "village", "organization", "post", "notice"}  # (errors/roles/staff ficam so' com o S.Adm)


class AuditLogEntryRead(BaseModel):
    """Uma linha do log geral como a API devolve ao painel (o IP so' vai pro S.Adm)."""
    id: UUID
    user_id: UUID | None
    action: str
    entity_type: str
    entity_id: str
    diff: dict | None
    created_at: datetime  # o Pydantic serializa isso como ISO 8601 automaticamente no JSON
    actor_name: str | None
    actor_role: str | None
    source: str
    ip_address: str | None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


@router.get("", response_model=list[AuditLogEntryRead])
async def list_audit_log(
    limit: int = Query(50, ge=1, le=200, description="Quantas linhas devolver, mais recentes primeiro"),
    # alias="entityType"/"entityId": Query() NAO aplica o alias_generator
    # camelCase que os corpos JSON recebem - sem o alias explicito, a URL
    # ?entityType=... seria silenciosamente ignorada.
    entity_type: str | None = Query(None, alias="entityType", description="Filtra so' por um tipo (ex: content_item, jutsu, staff)"),
    entity_id: str | None = Query(None, alias="entityId", description="Filtra so' pelas linhas de UMA entry especifica - historico de versao dela"),
    source: str | None = Query(None, description="Filtra por origem: panel, bot, auth"),
    action: str | None = Query(None, description="Filtra por acao (ex: login, delete, permission_denied)"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    LIMITACAO CONHECIDA: acoes em massa (bulk-status/bulk-delete/bulk-import)
    gravam o log com entity_id = "N itens" (um resumo, nao o id de cada
    entry) - entao uma entry alterada via bulk nao mostra isso no historico
    PROPRIO dela, so' no feed geral. Gravar uma linha por item pesaria o
    log rapido demais pra' um beneficio que hoje nao parece necessario.
    """
    sees_everything = has_permission(user.role, Permission.AUDIT_VIEW_ALL)
    is_entry_history = entity_type is not None and entity_id is not None

    if not is_entry_history and not has_permission(user.role, Permission.AUDIT_VIEW):
        raise HTTPException(status_code=403, detail="You do not have permission to do this")

    stmt = select(AuditLogEntry).order_by(AuditLogEntry.created_at.desc()).limit(limit)
    if not sees_everything:
        stmt = stmt.where(AuditLogEntry.entity_type.in_(CONTENT_ENTITY_TYPES))
    if entity_type is not None:
        stmt = stmt.where(AuditLogEntry.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(AuditLogEntry.entity_id == entity_id)
    if source is not None:
        stmt = stmt.where(AuditLogEntry.source == source)
    if action is not None:
        stmt = stmt.where(AuditLogEntry.action == action)

    rows = (await db.execute(stmt)).scalars().all()
    out = [AuditLogEntryRead.model_validate(r) for r in rows]
    if not sees_everything:
        for entry in out:
            entry.ip_address = None  # IP e' dado sensivel: so' o S.Adm enxerga
    return out


async def clear_log_rows(db: AsyncSession, actor: User, older_than_days: int | None, source: str = "panel",
                         discord_channel: bool = False, delete_rows: bool = True) -> int:
    """
    Apaga linhas do log (tudo, ou so' o que passou de N dias) e registra a limpeza como a primeira linha do log novo.
    `delete_rows=False` so' registra (usado quando o bot limpa APENAS o canal do Discord). Devolve quantas linhas apagou.
    A checagem de permissao (audit.clear = so' S.Adm) e' de quem chama.
    """
    total = 0
    if delete_rows:
        stmt = delete(AuditLogEntry)
        count_stmt = select(func.count()).select_from(AuditLogEntry)
        if older_than_days is not None:
            cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
            stmt = stmt.where(AuditLogEntry.created_at < cutoff)
            count_stmt = count_stmt.where(AuditLogEntry.created_at < cutoff)
        total = (await db.execute(count_stmt)).scalar_one()
        await db.execute(stmt)
    await log_action(db, action="clear_log", entity_type="security", entity_id="audit-log",
                     diff={"deleted": total, "older_than_days": older_than_days, "discord_channel": discord_channel},
                     actor=actor, source=source)
    return total


@router.delete("")
async def clear_audit_log(
    older_than_days: int | None = Query(None, alias="olderThanDays", ge=1, le=3650,
                                        description="Apaga so' o que for mais antigo que N dias; vazio = apaga TUDO"),
    staff: User = Depends(require_permission(Permission.AUDIT_CLEAR)),
    db: AsyncSession = Depends(get_db),
):
    """
    LIMPA o log (so' S.Adm; os demais cargos recebem 404): apaga tudo ou so' o que passou de N dias, para a equipe nao ver
    mais o historico antigo. A propria limpeza NAO some: fica registrada como a primeira linha do log novo
    (quem limpou, quantas linhas e o criterio).
    """
    total = await clear_log_rows(db, staff, older_than_days)
    await db.commit()
    return {"deleted": total}
