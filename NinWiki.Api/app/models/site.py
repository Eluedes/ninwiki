"""Estado do site: modo MANUTENCAO (uma unica linha, id = 1). Ligado, o site publico mostra a pagina de manutencao para quem nao e' da equipe."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SiteMaintenance(Base):
    """O modo manutencao atual. `enabled` ligado = so' a equipe (depois do login) entra no site; a mensagem e' opcional (ingles + portugues)."""
    __tablename__ = "site_maintenance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    message: Mapped[str] = mapped_column(String(300), default="", server_default="")        # ingles (padrao do site); vazio = texto padrao
    message_pt: Mapped[str | None] = mapped_column(String(300), nullable=True)              # portugues; vazio = texto padrao
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
