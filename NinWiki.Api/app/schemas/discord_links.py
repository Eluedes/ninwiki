"""Schemas da ligacao Discord -> perfil (rotas /bot/guilds-sync, /bot/member-roles, /bot/reader-ids e /discord-links do painel)."""
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
    village_id: str | None
    readers: int
    roles: list[RoleLinkRead]


class RoleLinkWrite(CamelModel):
    """Mapeamento de um cargo -> rank (None limpa)."""
    role_id: str = Field(pattern=_ID)
    ninja_rank_id: str | None = Field(default=None, max_length=50)


class GuildLinkWrite(CamelModel):
    """Corpo do PUT: vila do servidor e os mapeamentos de cargo enviados (os cargos nao citados ficam como estao)."""
    village_id: str | None = Field(default=None, max_length=50)
    roles: list[RoleLinkWrite] = Field(default_factory=list, max_length=250)
