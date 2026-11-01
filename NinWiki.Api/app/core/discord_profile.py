"""
Decide a VILA e o RANK NINJA de cada leitor a partir do que o BOT informou do Discord (cargos do leitor em cada servidor).

REGRAS (so' aqui; o bot nunca decide nada, so' repassa fatos):
  1. Cada servidor tem uma vila (mapeamento do painel). Cada cargo do servidor pode ter um rank (mapeamento do painel);
     sem mapeamento explicito vale o NOME do cargo igual ao nome/id do rank (sem diferenciar maiusculas: "Chunin" = rank Chunin).
  2. Num servidor, o rank do leitor e' o MAIOR entre os cargos dele que viram rank. Vila = a vila do servidor.
     - So' a vila mapeada e nenhum cargo de rank: vila do servidor + o MENOR rank da hierarquia (Academy Student).
     - So' o rank e servidor sem vila: rank do cargo + vila padrao.
     - Servidor sem vila e sem cargo de rank: nao conta (nao ha' informacao).
  3. Varios servidores (ex.: o jogador esta nos servidores das 3 vilas): vale a combinacao do servidor onde o leitor tem o MAIOR rank
     (Genin < Chunin < Jonin Special < Jonin < Conselho < Kami). Empate de rank: fica o servidor que JA valia no perfil (a vila nao troca
     sozinha); se ele nao esta' entre os empatados, o de menor ID de servidor (estavel).
  4. Sem nenhum servidor que conte (saiu, perdeu o cargo, bot nao esta' la'): padrao = vila Takumi + rank Rogue, origem "default".
Rogue (ninja sem vila) fica FORA da hierarquia academia -> kami (id `kage`; order 0) e nunca e' usado como "o menor rank".
"""
from collections.abc import Iterable
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.discord_links import DiscordGuild, DiscordMemberRoles, DiscordRole
from app.models.guide import NinjaRank
from app.models.readers import Reader
from app.models.villages import Village

DEFAULT_VILLAGE_ID = "takumi"
DEFAULT_RANK_ID = "rogue"
SOURCE_DEFAULT = "default"


def source_for(guild_id: str) -> str:
    """Texto guardado em Reader.profile_source para um servidor."""
    return f"discord:{guild_id}"


def _norm(text: str) -> str:
    """Nome de cargo/rank para comparar: minusculo, sem espacos nas pontas e sem diferenca entre '-' e espaco."""
    return " ".join(text.replace("-", " ").casefold().split())


def rank_name_index(ranks: Iterable[NinjaRank]) -> dict[str, NinjaRank]:
    """Nome normalizado (ingles, portugues e id) -> rank, para o casamento por nome do cargo."""
    out: dict[str, NinjaRank] = {}
    for r in ranks:
        for label in (r.id, r.name, r.name_pt):
            if label:
                out.setdefault(_norm(label), r)
    return out


def best_rank_for_roles(roles: list[dict], explicit: dict[str, NinjaRank], by_name: dict[str, NinjaRank]) -> NinjaRank | None:
    """O MAIOR rank entre os cargos (id -> rank explicito do painel; senao o nome do cargo igual ao do rank). None = nenhum cargo vira rank."""
    best: NinjaRank | None = None
    for role in roles:
        rank = explicit.get(str(role.get("id"))) or by_name.get(_norm(str(role.get("name", ""))))
        if rank is not None and (best is None or rank.order > best.order):
            best = rank
    return best


def pick_candidate(candidates: list[tuple[int, datetime, str, str | None, str | None]], current_source: str | None = None) -> tuple[int, datetime, str, str | None, str | None] | None:
    """Regra de varios servidores: candidato = (ordem do rank, atualizado_em, guild_id, village_id, rank_id); vence o maior rank.
    Empate: o servidor que ja' valia (`current_source`, ex. "discord:123") continua; senao o de menor guild_id. Assim a vila nao fica trocando a cada atualizacao."""
    if not candidates:
        return None
    top = max(c[0] for c in candidates)
    tied = [c for c in candidates if c[0] == top]
    for c in tied:
        if current_source == source_for(c[2]):
            return c
    return min(tied, key=lambda c: (len(c[2]), c[2]))   # guild_id e' texto numerico: compara pelo tamanho e depois pelo texto = ordem numerica


async def apply_defaults(db: AsyncSession, reader: Reader) -> None:
    """Padrao (Takumi + Rogue) num leitor; so' usa o que existe no banco (a equipe pode ter apagado)."""
    reader.village_id = DEFAULT_VILLAGE_ID if await db.get(Village, DEFAULT_VILLAGE_ID) else None
    reader.ninja_rank_id = DEFAULT_RANK_ID if await db.get(NinjaRank, DEFAULT_RANK_ID) else None
    reader.profile_source = SOURCE_DEFAULT


async def recompute_readers(db: AsyncSession, discord_ids: Iterable[int]) -> int:
    """Recalcula vila/rank desses leitores (pelos Discord IDs) com os cargos guardados e o mapeamento atual. Nao faz commit. Devolve quantos mudaram."""
    ids = sorted(set(discord_ids))
    if not ids:
        return 0
    ranks = list((await db.execute(select(NinjaRank))).scalars())
    by_name = rank_name_index(ranks)
    lowest = min((r for r in ranks if r.id != DEFAULT_RANK_ID), key=lambda r: r.order, default=None)
    guilds = {g.guild_id: g for g in (await db.execute(select(DiscordGuild).where(DiscordGuild.active.is_(True)))).scalars()}
    rank_by_id = {r.id: r for r in ranks}
    explicit: dict[str, dict[str, NinjaRank]] = {}
    for role in (await db.execute(select(DiscordRole).where(DiscordRole.ninja_rank_id.is_not(None)))).scalars():
        if role.ninja_rank_id in rank_by_id:
            explicit.setdefault(role.guild_id, {})[role.role_id] = rank_by_id[role.ninja_rank_id]
    villages = set((await db.execute(select(Village.id))).scalars())

    changed = 0
    for start in range(0, len(ids), 500):
        chunk = ids[start:start + 500]
        rows: dict[int, list[DiscordMemberRoles]] = {}
        for m in (await db.execute(select(DiscordMemberRoles).where(DiscordMemberRoles.discord_id.in_(chunk)))).scalars():
            rows.setdefault(m.discord_id, []).append(m)
        for reader in (await db.execute(select(Reader).where(Reader.discord_id.in_(chunk)))).scalars():
            candidates = []
            for m in rows.get(reader.discord_id, []):
                guild = guilds.get(m.guild_id)
                if guild is None:
                    continue   # servidor que o bot nao informa mais: ignorado
                rank = best_rank_for_roles(m.roles or [], explicit.get(m.guild_id, {}), by_name)
                if rank is None and guild.village_id is None:
                    continue   # sem vila e sem cargo de rank: nenhuma informacao
                rank = rank or lowest
                village_id = guild.village_id if guild.village_id in villages else None
                candidates.append((rank.order if rank else 0, m.updated_at, m.guild_id, village_id, rank.id if rank else None))
            best = pick_candidate(candidates, reader.profile_source)
            before = (reader.village_id, reader.ninja_rank_id, reader.profile_source)
            if best is None:
                await apply_defaults(db, reader)
            else:
                _, _, guild_id, village_id, rank_id = best
                default_village = DEFAULT_VILLAGE_ID if DEFAULT_VILLAGE_ID in villages else None
                reader.village_id, reader.ninja_rank_id, reader.profile_source = village_id or default_village, rank_id, source_for(guild_id)
            changed += before != (reader.village_id, reader.ninja_rank_id, reader.profile_source)
    return changed
