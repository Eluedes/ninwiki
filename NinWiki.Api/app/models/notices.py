"""Quadro de avisos da equipe (Visao Geral do painel): avisos + arquivos anexados."""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Notice(Base, TimestampMixin):
    """Aviso do quadro da equipe (Visao Geral do painel)."""
    __tablename__ = "notices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(Text, default="")  # texto simples (quebra de linha preservada)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Fotografia do nome de quem postou (continua certo se a pessoa for renomeada/apagada).
    author_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    files: Mapped[list["NoticeFile"]] = relationship(
        back_populates="notice", cascade="all, delete-orphan", order_by="NoticeFile.created_at"
    )


class NoticeFile(Base):
    """Arquivo anexado a um aviso (o arquivo em si fica em staff_files/, com nome aleatorio)."""
    __tablename__ = "notice_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    notice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("notices.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(200))      # nome ORIGINAL, so' pra mostrar/baixar
    stored_name: Mapped[str] = mapped_column(String(80))    # nome aleatorio no disco
    size: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    notice: Mapped["Notice"] = relationship(back_populates="files")
