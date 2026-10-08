"""Reports de visitantes: "esta informacao esta desatualizada" / "erro de traducao" em uma pagina de conteudo, jutsu ou mastery."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ContentReport(Base):
    """
    Um aviso enviado por um visitante (sem login) sobre uma pagina. O alvo NAO e' uma chave estrangeira de proposito: o report
    guarda o nome e o endereco da pagina como eram no momento do envio, entao continua legivel mesmo se a pagina for renomeada
    ou apagada depois. A equipe (permissao reports.manage) le, resolve ou descarta em /admin/reports.
    """
    __tablename__ = "content_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_type: Mapped[str] = mapped_column(String(10))            # content | jutsu | mastery
    target_id: Mapped[str] = mapped_column(String(150))             # slug (content) ou id (jutsu / mastery)
    target_name: Mapped[str] = mapped_column(String(200))           # nome da pagina no momento do envio
    target_path: Mapped[str] = mapped_column(String(300))           # endereco no site, ex: /detail/larva
    kind: Mapped[str] = mapped_column(String(12))                   # outdated | translation | other
    message: Mapped[str] = mapped_column(Text)                      # texto do visitante (ja' limpo)
    locale: Mapped[str | None] = mapped_column(String(5), nullable=True)   # idioma em que o visitante via a pagina (pt/en)
    status: Mapped[str] = mapped_column(String(10), default="open", server_default="open", index=True)   # open | resolved | dismissed
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)   # so' para barrar abuso; nunca sai pela API
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    handled_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
