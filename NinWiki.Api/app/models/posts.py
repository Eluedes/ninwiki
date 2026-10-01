"""
Posts de blog (noticias/patch notes) - tabela SEPARADA de content_items
de proposito. Decisao ja tomada com o mantenedor: wiki e blog tem
comportamento diferente (wiki e' atemporal e editado com frequencia;
blog e' cronologico e raramente editado apos publicado), entao viram
tabelas diferentes em vez de forcar um schema unico pros dois.
"""
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import ContentStatus


class Post(Base, TimestampMixin):
    """Post do blog (noticia/atualizacao), separado das entries do catalogo."""
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    excerpt: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus, name="content_status"), default=ContentStatus.DRAFT)

    author: Mapped["User | None"] = relationship()
