"""Anuncio da pagina inicial do site (uma unica linha, id = 1): vazio = nada aparece na Home."""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SiteAnnouncement(Base):
    """O anuncio atual da Home. `message` vazio = sem anuncio (a Home nao mostra nada)."""
    __tablename__ = "site_announcement"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    message: Mapped[str] = mapped_column(Text, default="", server_default="")        # ingles (padrao do site)
    message_pt: Mapped[str | None] = mapped_column(Text, nullable=True)              # traducao (DeepL), editavel
    link_url: Mapped[str] = mapped_column(String(300), default="", server_default="")
    link_label: Mapped[str] = mapped_column(String(60), default="", server_default="")
    level: Mapped[str] = mapped_column(String(10), default="info", server_default="info")  # info | success | warning | event
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
