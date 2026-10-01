"""Schemas da equipe (staff) e da sessao (/auth/me)."""
import re
import uuid
from datetime import datetime

from pydantic import field_validator

from app.core.permissions import ROLE_LABEL
from app.models.enums import StaffRole
from app.schemas.content import CamelModel


def parse_discord_id(value: str) -> int:
    """
    Discord ID chega como TEXTO (string de 17-20 digitos) e NUNCA como
    numero JSON: o JavaScript so' guarda inteiros exatos ate' 2^53, e um
    ID do Discord passa disso - virar numero no navegador CORROMPE o ID
    (os ultimos digitos mudam) e cadastraria a pessoa errada.
    """
    value = str(value).strip()
    if not re.fullmatch(r"\d{15,20}", value):
        raise ValueError("Invalid Discord ID (15 to 20 digits)")
    return int(value)


class StaffRead(CamelModel):
    """Membro da equipe como a API devolve."""
    id: uuid.UUID
    discord_id: str          # texto pelo motivo acima
    username: str
    avatar_url: str | None
    role: StaffRole
    is_active: bool
    is_owner: bool           # dono do sistema (.env) - o painel nao deixa alterar
    created_at: datetime
    last_login_at: datetime | None


class MeRead(CamelModel):
    """Quem esta' logado + tudo que o front precisa saber pra' montar a tela."""
    id: uuid.UUID
    discord_id: str
    username: str
    avatar_url: str | None
    role: StaffRole
    role_label: str          # "S.Adm" / "Adm" / "Creator"
    permissions: list[str]   # so' as permissoes que ESTE cargo pode ver
    assignable_roles: list[StaffRole]


class StaffCreate(CamelModel):
    """Corpo de cadastrar alguem na equipe."""
    discord_id: str
    role: StaffRole
    username: str | None = None

    @field_validator("discord_id")
    @classmethod
    def _check_id(cls, v: str) -> str:
        """Valida o Discord ID (15 a 20 digitos, como texto)."""
        parse_discord_id(v)
        return v.strip()

    @field_validator("username")
    @classmethod
    def _clean_username(cls, v: str | None) -> str | None:
        """Limpa espacos do nome informado."""
        v = (v or "").strip()
        return v[:100] or None


class StaffRoleUpdate(CamelModel):
    """Corpo de trocar o cargo."""
    role: StaffRole


class DevLogin(CamelModel):
    """Corpo do login de desenvolvimento (so' funciona em ambiente local)."""
    discord_id: str

    @field_validator("discord_id")
    @classmethod
    def _check_id(cls, v: str) -> str:
        """Valida o Discord ID do login de desenvolvimento."""
        parse_discord_id(v)
        return v.strip()


def role_label(role: StaffRole) -> str:
    """Nome curto do cargo para mostrar (S.Adm, Adm, Creator)."""
    return ROLE_LABEL[role]
