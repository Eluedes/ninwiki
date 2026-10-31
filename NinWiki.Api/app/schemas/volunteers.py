"""Schemas das inscricoes de voluntarios: envio (publico) e leitura/avaliacao (painel)."""
import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from app.models.volunteers import VolunteerStatus
from app.schemas.content import CamelModel

AreaName = Literal["translation", "wiki-editing", "data-collection", "mapping", "bot-dev", "art-graphics", "moderation", "other"]
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,60}\.[^@\s]{2,20}$")


def _plain(v: str) -> str:
    """Texto simples: tira caracteres de controle (mantem quebra de linha) e espacos nas pontas."""
    return "".join(ch for ch in v if ch == "\n" or ch.isprintable()).strip()


class VolunteerApply(CamelModel):
    """O que o visitante envia. Tamanhos maximos de tudo; consentimento obrigatorio (sem ele a API responde 422)."""
    name: str = Field(min_length=2, max_length=80)
    discord: str = Field(min_length=2, max_length=64)
    game_nick: str = Field(min_length=1, max_length=60)
    languages: str = Field(min_length=2, max_length=120)
    areas: list[AreaName] = Field(min_length=1, max_length=8)
    availability: str = Field(min_length=2, max_length=200)
    experience: str = Field(min_length=10, max_length=1500)
    motivation: str = Field(min_length=10, max_length=1500)
    contact_email: str | None = Field(default=None, max_length=120)
    consent: Literal[True]   # so' aceita true
    website: str = Field(default="", max_length=200)   # "isca" anti-robo: se vier preenchido, a inscricao e' descartada em silencio

    @field_validator("name", "discord", "game_nick", "languages", "availability", "experience", "motivation", mode="after")
    @classmethod
    def _clean(cls, v: str) -> str:
        """Limpa o texto e recusa se ficar curto demais depois da limpeza (so' espacos)."""
        v = _plain(v)
        if len(v) < 1:
            raise ValueError("Required")
        return v

    @field_validator("contact_email", mode="after")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        """E-mail e' opcional; se vier, tem que parecer um e-mail."""
        v = (v or "").strip()
        if not v:
            return None
        if not _EMAIL.match(v):
            raise ValueError("Invalid e-mail")
        return v


class VolunteerRead(CamelModel):
    """Uma inscricao como o painel ve' (sem consentimento/IP: nem existe IP no banco)."""
    id: uuid.UUID
    created_at: datetime
    name: str
    discord: str
    game_nick: str
    languages: str
    areas: list[str]
    availability: str
    experience: str
    motivation: str
    contact_email: str | None
    status: VolunteerStatus
    staff_notes: str | None
    reviewed_by: str | None
    reviewed_at: datetime | None


class VolunteerListRead(CamelModel):
    """Pagina da lista do painel, com o total e o contador de NOVAS."""
    items: list[VolunteerRead]
    total: int
    new_count: int


class VolunteerUpdate(CamelModel):
    """PATCH do painel: status e/ou notas internas (o que nao vier fica como esta')."""
    status: VolunteerStatus | None = None
    staff_notes: str | None = Field(default=None, max_length=2000)
