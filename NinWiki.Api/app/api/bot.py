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

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.staff import to_read
from app.core import staff_service
from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import Permission, has_permission
from app.core.rate_limit import BOT_FAIL, client_key, limiter, retry_message
from app.models.enums import StaffRole
from app.models.users import User
from app.schemas.content import CamelModel
from app.schemas.staff import StaffRead, parse_discord_id


async def require_bot(x_bot_token: str | None = Header(default=None)) -> None:
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
    invoker_discord_id: str


class BotStaffCreate(BotInvoker):
    discord_id: str
    role: StaffRole
    username: str | None = None


class BotRoleUpdate(BotInvoker):
    role: StaffRole


async def _invoker(db: AsyncSession, raw_id: str) -> User:
    try:
        discord_id = parse_discord_id(raw_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="invokerDiscordId inválido")
    user = await staff_service.get_by_discord_id(db, discord_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=403, detail="Você não faz parte da equipe")
    return user


async def _target(db: AsyncSession, raw_id: str) -> User:
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
    invoker = await _invoker(db, invokerDiscordId)
    if not has_permission(invoker.role, Permission.STAFF_VIEW):
        raise HTTPException(status_code=403, detail="Você não tem permissão para fazer isso")
    rows = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return [to_read(u) for u in rows]


@router.post("/staff", response_model=StaffRead, status_code=201)
async def bot_add_staff(payload: BotStaffCreate, db: AsyncSession = Depends(get_db)):
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
    invoker = await _invoker(db, payload.invoker_discord_id)
    target = await _target(db, discord_id)
    await staff_service.change_role(db, invoker, target, payload.role, source="bot")
    await db.commit()
    return to_read(target)


@router.post("/staff/{discord_id}/deactivate", response_model=StaffRead)
async def bot_deactivate(discord_id: str, payload: BotInvoker, db: AsyncSession = Depends(get_db)):
    invoker = await _invoker(db, payload.invoker_discord_id)
    target = await _target(db, discord_id)
    await staff_service.set_active(db, invoker, target, False, source="bot")
    await db.commit()
    return to_read(target)


@router.post("/staff/{discord_id}/activate", response_model=StaffRead)
async def bot_activate(discord_id: str, payload: BotInvoker, db: AsyncSession = Depends(get_db)):
    invoker = await _invoker(db, payload.invoker_discord_id)
    target = await _target(db, discord_id)
    await staff_service.set_active(db, invoker, target, True, source="bot")
    await db.commit()
    return to_read(target)
