"""
Cargos dos LEITORES do site no Discord -> API (a API decide vila e rank ninja; o bot so' informa FATOS).

O que o bot faz aqui (nenhuma regra de cargo/permissao/rank mora no bot):
  - pergunta a' API quem sao os leitores (so' os Discord IDs; assim nao varre servidores grandes inteiros);
  - manda a lista de servidores onde esta' e os cargos de cada um (para o painel /admin/discord-links);
  - manda, por servidor, os cargos de cada leitor (ou "saiu do servidor");
  - reage na hora a on_member_update / on_member_join / on_member_remove e refaz tudo ao ligar e a cada ~30 min.

Exige a intent privilegiada "Server Members Intent" (Discord Developer Portal > Bot) E intents.members=True no codigo (main.py).
Sem ela o bot continua funcionando: so' esta funcao fica desligada (main.py avisa em portugues).

Este arquivo NAO importa discord.py de proposito (usa so' os atributos dos objetos), para ser testavel sem o Discord.
"""
import logging
from collections.abc import Iterable, Iterator, Sequence

log = logging.getLogger("ninwiki_bot")

BATCH = 500   # membros por chamada (limite da API)
MAX_ROLES = 250   # o Discord permite no maximo 250 cargos por servidor
SYNC_MINUTES = 30


def chunks(items: Sequence, size: int) -> Iterator[Sequence]:
    """Fatias de `size` itens."""
    for i in range(0, len(items), size):
        yield items[i:i + size]


def roles_payload(roles: Iterable) -> list[dict]:
    """Cargos no formato da API: {id (texto), name}. O @everyone (cargo padrao) fica de fora."""
    return [{"id": str(r.id), "name": str(r.name)[:100]} for r in roles if not r.is_default()][:MAX_ROLES]


def guild_payload(guild) -> dict:
    """Servidor + cargos para /bot/guilds-sync."""
    return {"id": str(guild.id), "name": str(guild.name)[:100], "roles": roles_payload(guild.roles)}


def member_fact(member) -> dict:
    """Fato "este membro esta' no servidor com estes cargos" para /bot/member-roles."""
    return {"discordId": str(member.id), "present": True, "roles": roles_payload(member.roles)}


def absent_fact(discord_id: str) -> dict:
    """Fato "este Discord ID nao esta' mais no servidor"."""
    return {"discordId": str(discord_id), "present": False, "roles": []}


class MemberSync:
    """Sincroniza os cargos dos leitores. `client` = o bot (guilds, get_member); `api` = NinWikiApi."""

    def __init__(self, client, api) -> None:
        self.client = client
        self.api = api
        self.reader_ids: set[str] = set()   # leitores conhecidos (atualizado a cada sincronizacao completa)

    async def full_sync(self) -> None:
        """Sincronizacao completa: leitores -> servidores/cargos -> cargos de cada leitor em cada servidor."""
        ids = await self.api.reader_ids()
        self.reader_ids = set(ids)
        guilds = list(self.client.guilds)
        await self.api.sync_guilds([guild_payload(g) for g in guilds])
        for guild in guilds:
            facts = []
            for did in ids:
                member = guild.get_member(int(did))
                facts.append(member_fact(member) if member is not None else absent_fact(did))
            for batch in chunks(facts, BATCH):
                await self.api.push_member_roles(str(guild.id), list(batch))
        log.info("Cargos dos leitores sincronizados: %s leitores em %s servidores", len(ids), len(guilds))

    async def push_member(self, member) -> None:
        """Um membro mudou (cargos ou entrada): informa se ele for leitor."""
        if str(member.id) in self.reader_ids:
            await self.api.push_member_roles(str(member.guild.id), [member_fact(member)])

    async def on_member_update(self, before, after) -> None:
        """Evento: so' envia se os cargos mudaram."""
        if {r.id for r in before.roles} != {r.id for r in after.roles}:
            await self.push_member(after)

    async def on_member_remove(self, member) -> None:
        """Evento: saiu (ou foi removido) do servidor."""
        if str(member.id) in self.reader_ids:
            await self.api.push_member_roles(str(member.guild.id), [absent_fact(member.id)])

    async def on_guild_change(self, guild) -> None:
        """Evento: o bot entrou num servidor novo - informa servidores/cargos para o painel enxergar."""
        await self.api.sync_guilds([guild_payload(g) for g in self.client.guilds])
