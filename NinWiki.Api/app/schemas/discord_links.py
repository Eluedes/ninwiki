"""Schemas da ligacao Discord -> perfil (rotas /bot/guilds-sync, /bot/member-roles, /bot/reader-ids e /discord-links do painel)."""
import re
from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.content import CamelModel

_ID = r"^\d{1,25}$"   # Discord ID: so' digitos, sempre texto


def _clean(v: str) -> str:
    """Nome de servidor/cargo sem caracteres de controle e sem espacos nas pontas."""
    return "".join(ch for ch in v if ch.isprintable()).strip()


class BotRole(CamelModel):
    """Cargo informado pelo bot."""
    id: str = Field(pattern=_ID)
    name: str = Field(max_length=100)

    @field_validator("name", mode="after")
    @classmethod
    def _name(cls, v: str) -> str:
        """Nome limpo."""
        return _clean(v)


class BotGuild(CamelModel):
    """Servidor onde o bot esta' + os cargos dele (sem o @everyone)."""
    id: str = Field(pattern=_ID)
    name: str = Field(max_length=100)
    member_count: int = Field(default=0, ge=0, le=100_000_000)
    roles: list[BotRole] = Field(default_factory=list, max_length=250)

    @field_validator("name", mode="after")
    @classmethod
    def _name(cls, v: str) -> str:
        """Nome limpo."""
        return _clean(v)


class GuildsSync(CamelModel):
    """Lista completa dos servidores do bot (o que nao vier fica inativo)."""
    guilds: list[BotGuild] = Field(max_length=200)


class MemberFact(CamelModel):
    """Fato sobre um membro: esta' no servidor (present) com estes cargos, ou saiu (present=false)."""
    discord_id: str = Field(pattern=_ID)
    present: bool = True
    roles: list[BotRole] = Field(default_factory=list, max_length=250)


class MemberRolesPush(CamelModel):
    """Lote de fatos de membros de UM servidor."""
    guild_id: str = Field(pattern=_ID)
    members: list[MemberFact] = Field(max_length=500)


class MemberRolesResult(CamelModel):
    """Quantos fatos foram guardados, apagados e ignorados (nao e' leitor do site)."""
    stored: int
    removed: int
    ignored: int
    profiles_changed: int


class ReaderIds(CamelModel):
    """Pagina de Discord IDs (texto) de leitores; `next` = passar em `after` para a proxima pagina (None = acabou)."""
    ids: list[str]
    next: str | None


class RoleLinkRead(CamelModel):
    """Cargo de um servidor e o rank mapeado (None = vale o nome do cargo)."""
    role_id: str
    name: str
    ninja_rank_id: str | None


class GuildLinkRead(CamelModel):
    """Servidor com a vila mapeada e seus cargos."""
    guild_id: str
    name: str
    active: bool
    member_count: int
    village_id: str | None
    readers: int
    members_stored: int   # quantos membros a lista guardada tem (a lista em si so' vem em /guilds/{id}/members)
    members_synced_at: datetime | None
    members_partial: bool
    roles: list[RoleLinkRead]


class RoleLinkWrite(CamelModel):
    """Mapeamento de um cargo -> rank (None limpa)."""
    role_id: str = Field(pattern=_ID)
    ninja_rank_id: str | None = Field(default=None, max_length=50)


class GuildLinkWrite(CamelModel):
    """Corpo do PUT: vila do servidor e os mapeamentos de cargo enviados (os cargos nao citados ficam como estao)."""
    village_id: str | None = Field(default=None, max_length=50)
    roles: list[RoleLinkWrite] = Field(default_factory=list, max_length=250)


class BotGuildMember(CamelModel):
    """Membro de um servidor informado pelo bot (so' fatos; sem e-mail nem mensagens)."""
    discord_id: str = Field(pattern=_ID)
    username: str = Field(default="", max_length=100)
    display_name: str = Field(default="", max_length=100)
    is_bot: bool = False
    joined_at: datetime | None = None
    roles: list[str] = Field(default_factory=list, max_length=250)   # IDs de cargo (texto)

    @field_validator("username", "display_name", mode="after")
    @classmethod
    def _names(cls, v: str) -> str:
        """Nome limpo (sem caracteres de controle)."""
        return _clean(v)

    @field_validator("roles", mode="after")
    @classmethod
    def _role_ids(cls, v: list[str]) -> list[str]:
        """Cada cargo e' um ID numerico em texto."""
        if any(not re.fullmatch(_ID, r) for r in v):
            raise ValueError("role ids must be digits")
        return v


class GuildMembersPush(CamelModel):
    """Lote de membros de UM servidor (ate' 500). `sync_token` = carimbo da sincronizacao completa em andamento;
    no ultimo lote (`final`) quem ficou com outro carimbo saiu e e' apagado. `remove` = IDs que sairam (evento de saida)."""
    guild_id: str = Field(pattern=_ID)
    sync_token: str = Field(default="", max_length=40, pattern=r"^[A-Za-z0-9_-]*$")
    members: list[BotGuildMember] = Field(default_factory=list, max_length=500)
    remove: list[str] = Field(default_factory=list, max_length=500)
    final: bool = False

    @field_validator("remove", mode="after")
    @classmethod
    def _remove_ids(cls, v: list[str]) -> list[str]:
        """IDs de quem saiu: so' digitos."""
        if any(not re.fullmatch(_ID, r) for r in v):
            raise ValueError("ids must be digits")
        return v


class GuildMembersResult(CamelModel):
    """Quantos membros foram guardados/apagados e se o teto cortou alguem."""
    stored: int
    removed: int
    partial: bool


class GuildMemberRead(CamelModel):
    """Membro na tela do painel."""
    discord_id: str
    username: str
    display_name: str
    is_bot: bool
    joined_at: datetime | None
    roles: list[str]


class GuildMembersPage(CamelModel):
    """Pagina de membros + total (com a busca aplicada) + estado da sincronizacao."""
    total: int
    items: list[GuildMemberRead]
    synced_at: datetime | None
    partial: bool
