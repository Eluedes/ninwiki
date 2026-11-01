"""
Ligacao Discord -> perfil do leitor (vila e rank ninja automaticos). Regras de decisao: app/core/discord_profile.py.

BOT (token, require_bot - o bot so' informa FATOS, a API decide):
  GET  /bot/reader-ids      Discord IDs (texto) dos leitores, paginado (o bot so' consulta cargos de quem e' leitor)
  POST /bot/guilds-sync     servidores onde o bot esta' + cargos de cada um
  POST /bot/member-roles    cargos de leitores num servidor (ou que saiu dele)
PAINEL (permissao discord.links):
  GET  /discord-links                    servidores, vila e mapeamento de cargos
  PUT  /discord-links/guilds/{guild_id}  define a vila do servidor e os cargos -> rank (recalcula os leitores do servidor)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.bot import require_bot
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.discord_profile import recompute_readers
from app.core.permissions import Permission
from app.core.rate_limit import limiter, retry_message
from app.models.discord_links import DiscordGuild, DiscordMemberRoles, DiscordRole
from app.models.guide import NinjaRank
from app.models.readers import Reader
from app.models.users import User
from app.models.villages import Village
from app.schemas.discord_links import (
    GuildLinkRead, GuildLinkWrite, GuildsSync, MemberRolesPush, MemberRolesResult, ReaderIds, RoleLinkRead,
)

bot_router = APIRouter(prefix="/bot", tags=["bot"], dependencies=[Depends(require_bot)])
router = APIRouter(prefix="/discord-links", tags=["discord-links"])

BOT_CALLS_PER_MINUTE = 300   # teto de chamadas do bot a estas rotas (uma sincronizacao completa usa poucas dezenas)


def _throttle() -> None:
    """Limite de uso das rotas do bot (o token ja' protege; isto freia um bot com defeito em laco)."""
    wait = limiter.hit("bot-discord-links", "bot", BOT_CALLS_PER_MINUTE, 60)
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})


@bot_router.get("/reader-ids", response_model=ReaderIds)
async def bot_reader_ids(after: int = Query(0, ge=0), limit: int = Query(1000, ge=1, le=1000), db: AsyncSession = Depends(get_db)):
    """Discord IDs dos leitores (nao banidos) em ordem crescente, a partir do `after` (exclusivo). Paginado."""
    _throttle()
    ids = list((await db.execute(select(Reader.discord_id).where(Reader.discord_id > after, Reader.banned.is_(False)).order_by(Reader.discord_id).limit(limit))).scalars())
    return ReaderIds(ids=[str(i) for i in ids], next=str(ids[-1]) if len(ids) == limit else None)


async def _readers_of_guilds(db: AsyncSession, guild_ids: list[str]) -> set[int]:
    """Discord IDs que tem linha de cargos em algum desses servidores."""
    if not guild_ids:
        return set()
    return set((await db.execute(select(DiscordMemberRoles.discord_id).where(DiscordMemberRoles.guild_id.in_(guild_ids)))).scalars())


@bot_router.post("/guilds-sync")
async def bot_guilds_sync(payload: GuildsSync, db: AsyncSession = Depends(get_db)) -> dict:
    """Sincroniza servidores e cargos. Servidor que nao veio fica inativo (mapeamento guardado); cargo que sumiu e' apagado."""
    _throttle()
    now = datetime.now(timezone.utc)
    reported = {g.id: g for g in payload.guilds}
    existing = {g.guild_id: g for g in (await db.execute(select(DiscordGuild))).scalars()}
    flipped: list[str] = []   # servidores que ligaram/desligaram: os leitores deles precisam ser recalculados
    for gid, g in reported.items():
        row = existing.get(gid)
        if row is None:
            db.add(DiscordGuild(guild_id=gid, name=g.name or gid, active=True, updated_at=now))
        else:
            if not row.active:
                flipped.append(gid)
            row.name, row.active, row.updated_at = g.name or gid, True, now
    for gid, row in existing.items():
        if gid not in reported and row.active:
            row.active = False
            flipped.append(gid)
    await db.flush()
    for gid, g in reported.items():
        await db.execute(delete(DiscordRole).where(DiscordRole.guild_id == gid, DiscordRole.role_id.not_in([r.id for r in g.roles] or [""])))
        if g.roles:
            stmt = pg_insert(DiscordRole).values([{"guild_id": gid, "role_id": r.id, "name": r.name or r.id} for r in g.roles])
            await db.execute(stmt.on_conflict_do_update(index_elements=["guild_id", "role_id"], set_={"name": stmt.excluded.name}))   # mantem o rank mapeado
    changed = await recompute_readers(db, await _readers_of_guilds(db, flipped))
    await db.commit()
    return {"guilds": len(reported), "profilesChanged": changed}


@bot_router.post("/member-roles", response_model=MemberRolesResult)
async def bot_member_roles(payload: MemberRolesPush, db: AsyncSession = Depends(get_db)) -> MemberRolesResult:
    """Guarda os cargos de leitores num servidor (present=false apaga) e recalcula a vila/rank deles. Quem nao e' leitor e' ignorado."""
    _throttle()
    if await db.get(DiscordGuild, payload.guild_id) is None:
        raise HTTPException(status_code=404, detail="Unknown guild: send /bot/guilds-sync first")
    wanted = {int(m.discord_id): m for m in payload.members}
    known = set((await db.execute(select(Reader.discord_id).where(Reader.discord_id.in_(list(wanted))))).scalars()) if wanted else set()
    now = datetime.now(timezone.utc)
    stored = [m for i, m in wanted.items() if i in known and m.present]
    gone = [i for i, m in wanted.items() if i in known and not m.present]
    if stored:
        stmt = pg_insert(DiscordMemberRoles).values([
            {"discord_id": int(m.discord_id), "guild_id": payload.guild_id, "roles": [{"id": r.id, "name": r.name} for r in m.roles], "updated_at": now} for m in stored])
        await db.execute(stmt.on_conflict_do_update(index_elements=["discord_id", "guild_id"], set_={"roles": stmt.excluded.roles, "updated_at": stmt.excluded.updated_at}))
    if gone:
        await db.execute(delete(DiscordMemberRoles).where(DiscordMemberRoles.guild_id == payload.guild_id, DiscordMemberRoles.discord_id.in_(gone)))
    changed = await recompute_readers(db, known)
    await db.commit()
    return MemberRolesResult(stored=len(stored), removed=len(gone), ignored=len(wanted) - len(known), profiles_changed=changed)


# ---------------- painel ----------------

async def _guild_view(db: AsyncSession, g: DiscordGuild) -> GuildLinkRead:
    """Servidor + cargos + quantos leitores tem cargos informados nele."""
    roles = (await db.execute(select(DiscordRole).where(DiscordRole.guild_id == g.guild_id).order_by(DiscordRole.name))).scalars().all()
    n = (await db.execute(select(func.count()).select_from(DiscordMemberRoles).where(DiscordMemberRoles.guild_id == g.guild_id))).scalar_one()
    return GuildLinkRead(guild_id=g.guild_id, name=g.name, active=g.active, village_id=g.village_id, readers=n,
                         roles=[RoleLinkRead(role_id=r.role_id, name=r.name, ninja_rank_id=r.ninja_rank_id) for r in roles])


@router.get("", response_model=list[GuildLinkRead])
async def list_links(staff: User = Depends(require_permission(Permission.DISCORD_LINKS)), db: AsyncSession = Depends(get_db)):
    """Servidores que o bot informou (ativos primeiro) com a vila e o mapeamento de cargos."""
    guilds = (await db.execute(select(DiscordGuild).order_by(DiscordGuild.active.desc(), DiscordGuild.name))).scalars().all()
    return [await _guild_view(db, g) for g in guilds]


@router.put("/guilds/{guild_id}", response_model=GuildLinkRead)
async def save_links(guild_id: str, payload: GuildLinkWrite, staff: User = Depends(require_permission(Permission.DISCORD_LINKS)), db: AsyncSession = Depends(get_db)):
    """Define a vila do servidor e os cargos -> rank enviados; recalcula na hora o perfil dos leitores desse servidor."""
    guild = await db.get(DiscordGuild, guild_id)
    if guild is None:
        raise HTTPException(status_code=404, detail="Guild not found")
    if payload.village_id and await db.get(Village, payload.village_id) is None:
        raise HTTPException(status_code=422, detail="Unknown village")
    known_roles = {r.role_id: r for r in (await db.execute(select(DiscordRole).where(DiscordRole.guild_id == guild_id))).scalars()}
    rank_ids = {w.ninja_rank_id for w in payload.roles if w.ninja_rank_id}
    if rank_ids and len(set((await db.execute(select(NinjaRank.id).where(NinjaRank.id.in_(rank_ids)))).scalars())) != len(rank_ids):
        raise HTTPException(status_code=422, detail="Unknown ninja rank")
    if any(w.role_id not in known_roles for w in payload.roles):
        raise HTTPException(status_code=422, detail="Unknown role for this guild")
    before = {"village": guild.village_id, "roles": {r.role_id: r.ninja_rank_id for r in known_roles.values() if r.ninja_rank_id}}
    guild.village_id = payload.village_id or None
    for w in payload.roles:
        known_roles[w.role_id].ninja_rank_id = w.ninja_rank_id or None
    await db.flush()
    changed = await recompute_readers(db, await _readers_of_guilds(db, [guild_id]))
    after = {"village": guild.village_id, "roles": {r.role_id: r.ninja_rank_id for r in known_roles.values() if r.ninja_rank_id}}
    await log_action(db, action="update", entity_type="discord_links", entity_id=guild_id, diff={"guild": guild.name, "before": before, "after": after, "profilesChanged": changed}, actor=staff)
    await db.commit()
    return await _guild_view(db, guild)
