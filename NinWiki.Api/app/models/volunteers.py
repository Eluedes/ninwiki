"""Inscricoes de voluntarios (formulario publico /volunteer); a equipe avalia em /admin/volunteers."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class VolunteerStatus(str, enum.Enum):
    """Andamento da avaliacao (no banco os rotulos ficam em MAIUSCULAS: NEW, REVIEWING...)."""
    NEW = "new"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONTACTED = "contacted"


class VolunteerApplication(Base):
    """
    Uma inscricao enviada por um visitante (sem login). Tem dados pessoais (Discord, e-mail opcional): so' a equipe com a
    permissao volunteers.manage ve, e o visitante pode pedir exclusao pelo Discord. NAO guarda IP (o limite de envios e' em memoria).
    """
    __tablename__ = "volunteer_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    discord: Mapped[str] = mapped_column(String(64))                 # texto livre (usuario ou ID)
    game_nick: Mapped[str] = mapped_column(String(60))               # nick no Nin Online
    languages: Mapped[str] = mapped_column(String(120))              # ex.: "Portuguese, English"
    areas: Mapped[list[str]] = mapped_column(ARRAY(String(30)))      # translation, wiki-editing, ...
    availability: Mapped[str] = mapped_column(String(200))
    motivation: Mapped[str] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    consent: Mapped[bool] = mapped_column(Boolean)                   # sempre True (sem consentimento nao grava)
    status: Mapped[VolunteerStatus] = mapped_column(
        Enum(VolunteerStatus, name="volunteer_status"), default=VolunteerStatus.NEW, server_default="NEW", index=True)
    staff_notes: Mapped[str | None] = mapped_column(Text, nullable=True)   # notas internas, nunca saem para o publico
    reviewed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class VolunteerSettings(Base):
    """Interruptor do formulario de voluntarios (uma unica linha, id = 1). Sem a linha = ABERTO (padrao)."""
    __tablename__ = "volunteer_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")   # true = aceitando inscricoes
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
