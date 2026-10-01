"""Registro de erros e problemas do wiki (API, site, DeepL, seguranca) - alimenta o painel /admin/errors e o canal de erros do bot."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ErrorEvent(Base):
    """
    UM problema (nao uma linha por ocorrencia): ocorrencias repetidas do MESMO problema (mesmo `fingerprint`)
    aumentam `count` e atualizam `last_seen`. Assim mil erros iguais viram uma linha com "x1000" - nada de
    spam no banco nem no Discord. Se um problema ja' marcado como resolvido volta a acontecer, ele reabre.

    Nunca guarda cookies, cabecalhos, corpo de requisicao, senhas nem tokens (ver app/core/error_log.py::mask).
    """
    __tablename__ = "error_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Identidade do problema: hash de (origem + tipo + local + rota normalizada).
    fingerprint: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(20))        # api | web | deepl | security
    level: Mapped[str] = mapped_column(String(10))         # error | warning
    title: Mapped[str] = mapped_column(String(200))        # ex: "OperationalError" ou "DeepL quota exceeded"
    message: Mapped[str] = mapped_column(Text)             # mensagem JA' mascarada e cortada
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)  # ex: "app/api/posts.py:131 in create_post"
    path: Mapped[str | None] = mapped_column(String(300), nullable=True)      # rota normalizada, ex: /posts/:id
    method: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[int | None] = mapped_column(Integer, nullable=True)        # HTTP devolvido, quando ha'
    trace: Mapped[str | None] = mapped_column(Text, nullable=True)            # traceback da ULTIMA ocorrencia (mascarado) - so' o S.Adm ve'
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True) # IP da ultima ocorrencia (so' o S.Adm ve'; nunca vai pro Discord)
    count: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
