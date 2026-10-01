"""
API do NinWiki.Bot (Discord) - cadastro/gestao da equipe por comando.

COMO A CONFIANCA FUNCIONA: o bot prova quem ELE e' com o header
X-Bot-Token (BOT_API_TOKEN do .env, comparado em tempo constante) e
informa QUEM DIGITOU o comando (invokerDiscordId). A API entao aplica as
MESMAS regras do painel a esse "invoker" (ele tem que ser staff ativa, com
a permissao e a hierarquia certas) - o bot nunca ganha poder proprio.
Quem tiver o token do bot consegue agir como qualquer staff, entao ele
e' tratado como senha: so' no .env, nunca no Git, nunca em log.
Discord ja garante ao bot o ID real de quem executou o comando.

BOT_API_TOKEN vazio = tudo aqui devolve 404 (desligado).
"""
import hmac
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.staff import to_read
from app.core import staff_service
from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import Permission, has_permission
from app.core.rate_limit import BOT_FAIL, client_key, limiter, retry_message
from app.models.enums import StaffRole
from app.models.users import AuditLogEntry, User
from app.schemas.content import CamelModel
from app.schemas.staff import StaffRead, parse_discord_id


async def require_bot(x_bot_token: str | None = Header(default=None)) -> None:
    """Dependencia das rotas /bot: confere o X-Bot-Token (tempo constante) e freia quem erra demais."""
    if not settings.bot_api_token:
        raise HTTPException(status_code=404, detail="Not Found")
    # Quem errou o token vezes demais fica bloqueado ate' a janela andar (freio contra adivinhacao).
    window = 10 * 60
    wait = limiter.blocked(BOT_FAIL, client_key(), settings.bot_fail_limit, window)
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    if not x_bot_token or not hmac.compare_digest(x_bot_token, settings.bot_api_token):
        limiter.fail(BOT_FAIL, client_key(), window)
        raise HTTPException(status_code=401, detail="Token do bot inválido")


router = APIRouter(prefix="/bot", tags=["bot"], dependencies=[Depends(require_bot)])


class BotInvoker(CamelModel):
    """Corpo base das chamadas do bot: o Discord ID de QUEM digitou o comando."""
    invoker_discord_id: str


class BotStaffCreate(BotInvoker):
    """Corpo de cadastrar alguem na equipe pelo bot."""
    discord_id: str
    role: StaffRole
    username: str | None = None


class BotRoleUpdate(BotInvoker):
    """Corpo de trocar o cargo de alguem pelo bot."""
    role: StaffRole


async def _invoker(db: AsyncSession, raw_id: str) -> User:
    """Acha quem digitou o comando e exige que seja staff ativa (senao 403)."""
    try:
        discord_id = parse_discord_id(raw_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="invokerDiscordId inválido")
    user = await staff_service.get_by_discord_id(db, discord_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=403, detail="Você não faz parte da equipe")
    return user


async def _target(db: AsyncSession, raw_id: str) -> User:
    """Acha o membro da equipe alvo do comando pelo Discord ID (senao 404)."""
    try:
        discord_id = parse_discord_id(raw_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Discord ID inválido")
    user = await staff_service.get_by_discord_id(db, discord_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Esse Discord ID não está na equipe")
    return user


@router.get("/staff", response_model=list[StaffRead])
async def bot_list_staff(invokerDiscordId: str, db: AsyncSession = Depends(get_db)):
    """Lista a equipe para o comando /equipe listar (so' quem tem a permissao staff.view)."""
    invoker = await _invoker(db, invokerDiscordId)
    if not has_permission(invoker.role, Permission.STAFF_VIEW):
        raise HTTPException(status_code=403, detail="Você não tem permissão para fazer isso")
    rows = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return [to_read(u) for u in rows]


@router.post("/staff", response_model=StaffRead, status_code=201)
async def bot_add_staff(payload: BotStaffCreate, db: AsyncSession = Depends(get_db)):
    """Cadastra alguem na equipe (/equipe adicionar) aplicando as regras do invoker."""
    invoker = await _invoker(db, payload.invoker_discord_id)
    try:
        target_id = parse_discord_id(payload.discord_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Discord ID inválido")
    user = await staff_service.add_staff(db, invoker, target_id, payload.role, payload.username, source="bot")
    await db.commit()
    return to_read(user)


@router.patch("/staff/{discord_id}/role", response_model=StaffRead)
async def bot_change_role(discord_id: str, payload: BotRoleUpdate, db: AsyncSession = Depends(get_db)):
    """Troca o cargo de alguem (/equipe cargo) aplicando as regras do invoker."""
    invoker = await _invoker(db, payload.invoker_discord_id)
    target = await _target(db, discord_id)
    await staff_service.change_role(db, invoker, target, payload.role, source="bot")
    await db.commit()
    return to_read(target)


@router.post("/staff/{discord_id}/deactivate", response_model=StaffRead)
async def bot_deactivate(discord_id: str, payload: BotInvoker, db: AsyncSession = Depends(get_db)):
    """Desativa alguem da equipe (/equipe desativar)."""
    invoker = await _invoker(db, payload.invoker_discord_id)
    target = await _target(db, discord_id)
    await staff_service.set_active(db, invoker, target, False, source="bot")
    await db.commit()
    return to_read(target)


@router.post("/staff/{discord_id}/activate", response_model=StaffRead)
async def bot_activate(discord_id: str, payload: BotInvoker, db: AsyncSession = Depends(get_db)):
    """Reativa alguem da equipe (/equipe reativar)."""
    invoker = await _invoker(db, payload.invoker_discord_id)
    target = await _target(db, discord_id)
    await staff_service.set_active(db, invoker, target, True, source="bot")
    await db.commit()
    return to_read(target)


# ---------------- feed do log geral para o Discord ----------------

class BotLogEntry(CamelModel):
    """Uma linha do log geral SEM o IP (o canal do Discord nao deve mostrar IPs de ninguem)."""
    id: UUID
    created_at: datetime
    action: str
    entity_type: str
    entity_id: str
    diff: dict | None
    actor_name: str | None
    actor_role: str | None
    source: str


@router.get("/audit-log", response_model=list[BotLogEntry])
async def bot_audit_log(
    since: datetime = Query(..., description="So' linhas criadas DEPOIS deste instante (ISO 8601)"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    O bot pergunta de tempos em tempos "o que aconteceu desde X?" e posta o que vier no canal de log.
    Ordem crescente (mais antigo primeiro) para o canal ficar em ordem cronologica.
    """
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    stmt = select(AuditLogEntry).where(AuditLogEntry.created_at > since).order_by(AuditLogEntry.created_at).limit(limit)
    return (await db.execute(stmt)).scalars().all()
