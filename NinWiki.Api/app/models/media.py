"""Banco de imagens do painel: cada imagem enviada ganha um ID numerico (#1, #2...) para ser usado nos campos de imagem."""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MediaImage(Base):
    """
    Uma imagem da biblioteca. `id` e' o numero que a equipe digita (ex.: `img:12`, `#12` ou `12`) em qualquer campo de imagem; a API troca pelo
    endereco do arquivo ao salvar. O arquivo fica em uploads/ com nome aleatorio (`filename`); `name` e' so' um rotulo para achar na busca.
    """
    __tablename__ = "media_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(80), unique=True)          # nome aleatorio em uploads/
    name: Mapped[str] = mapped_column(String(80), default="", server_default="")
    category: Mapped[str] = mapped_column(String(20), default="", server_default="", index=True)  # weapon, clothing... ('' = sem categoria); filtro rapido do painel
    width: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    height: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    bytes: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    uploaded_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
