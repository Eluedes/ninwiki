"""
Registro de erros do wiki.

Painel (so' S.Adm - permissao errors.view, que e' SUPER_ONLY: os outros cargos recebem 404):
  GET    /errors                 lista os problemas (filtros: status=open|resolved|all, source, limit)
  POST   /errors/{id}/resolve    marca como resolvido (se voltar a acontecer, reabre sozinho)
  POST   /errors/{id}/reopen     reabre
  DELETE /errors/{id}            apaga (so' faz sentido para os ja' resolvidos)

Publico (sem login, com limite de uso):
  POST   /client-errors          o site avisa que o visitante viu um erro de tela (ver NinWiki.Web/app/error.tsx)
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import error_log
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.rate_limit import client_key, limiter, retry_message
from app.core.security import ensure_same_origin
from app.models.errors import ErrorEvent
from app.models.users import User
from app.schemas.errors import ClientErrorReport, ErrorEventRead

router = APIRouter(prefix="/errors", tags=["errors"])
client_router = APIRouter(prefix="/client-errors", tags=["errors"])

# Limites do relatorio vindo do navegador (endpoint publico): por IP e total de problemas "web" novos por hora.
CLIENT_REPORTS_PER_MINUTE = 10
MAX_NEW_WEB_ERRORS_PER_HOUR = 100


@router.get("", response_model=list[ErrorEventRead])
async def list_errors(
    status: str = Query("open", pattern="^(open|resolved|all)$"),
    source: str | None = Query(None, pattern="^(api|web|deepl|security)$"),
    limit: int = Query(100, ge=1, le=300),
    staff: User = Depends(require_permission(Permission.ERRORS_VIEW)),
    db: AsyncSession = Depends(get_db),
):
    """Lista os problemas, o que aconteceu mais recentemente primeiro."""
    stmt = select(ErrorEvent).order_by(ErrorEvent.last_seen.desc()).limit(limit)
    if status != "all":
        stmt = stmt.where(ErrorEvent.resolved == (status == "resolved"))
    if source:
        stmt = stmt.where(ErrorEvent.source == source)
    return (await db.execute(stmt)).scalars().all()


async def _get_or_404(db: AsyncSession, error_id: UUID) -> ErrorEvent:
    """Acha o problema pelo id ou responde 404."""
    event = await db.get(ErrorEvent, error_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Error not found")
    return event


@router.post("/{error_id}/resolve", response_model=ErrorEventRead)
async def resolve_error(
    error_id: UUID, staff: User = Depends(require_permission(Permission.ERRORS_VIEW)), db: AsyncSession = Depends(get_db),
):
    """Marca como resolvido. Se o mesmo problema voltar a acontecer ele reabre sozinho (e o bot avisa de novo)."""
    event = await _get_or_404(db, error_id)
    event.resolved, event.resolved_at, event.resolved_by = True, datetime.now(timezone.utc), staff.username
    await log_action(db, action="resolve", entity_type="error", entity_id=str(event.id), diff={"name": event.title}, actor=staff)
    await db.commit()
    return event


@router.post("/{error_id}/reopen", response_model=ErrorEventRead)
async def reopen_error(
    error_id: UUID, staff: User = Depends(require_permission(Permission.ERRORS_VIEW)), db: AsyncSession = Depends(get_db),
):
    """Reabre um problema que tinha sido marcado como resolvido."""
    event = await _get_or_404(db, error_id)
    event.resolved, event.resolved_at, event.resolved_by = False, None, None
    await log_action(db, action="reopen", entity_type="error", entity_id=str(event.id), diff={"name": event.title}, actor=staff)
    await db.commit()
    return event


@router.delete("/{error_id}", status_code=204)
async def delete_error(
    error_id: UUID, staff: User = Depends(require_permission(Permission.ERRORS_VIEW)), db: AsyncSession = Depends(get_db),
):
    """Apaga o registro de um problema (limpeza)."""
    event = await _get_or_404(db, error_id)
    await db.delete(event)
    await log_action(db, action="delete", entity_type="error", entity_id=str(error_id), diff={"name": event.title}, actor=staff)
    await db.commit()


@client_router.post("", status_code=204)
async def report_client_error(report: ClientErrorReport, request: Request, db: AsyncSession = Depends(get_db)):
    """
    O navegador do visitante avisa que o site quebrou na tela dele. Publico, entao com defesas: so' aceita a origem do
    nosso site, limite por IP, tamanho/caracteres limitados, e no maximo MAX_NEW_WEB_ERRORS_PER_HOUR problemas "web"
    novos por hora (um atacante nao consegue encher o painel nem o Discord com mensagens inventadas).
    """
    ensure_same_origin(request)
    wait = limiter.hit("client-errors", client_key(), CLIENT_REPORTS_PER_MINUTE, 60)
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    new_last_hour = (await db.execute(
        select(func.count()).select_from(ErrorEvent).where(ErrorEvent.source == "web", ErrorEvent.first_seen > since)
    )).scalar_one()
    if new_last_hour >= MAX_NEW_WEB_ERRORS_PER_HOUR:
        return Response(status_code=204)  # teto atingido: ignora em silencio
    first_line = report.message.split("\n")[0][:120]
    await error_log.record(
        source="web", level="error", title=f"Site error: {first_line}", message=report.message,
        location=f"page ({report.kind})" + (f" digest {report.digest}" if report.digest else ""),
        path=report.path or None, status=None, ip=client_key(),
    )
    return Response(status_code=204)
