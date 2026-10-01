"""
Posts de blog (noticias/patch notes) - tabela SEPARADA de content_items
de proposito. Decisao ja tomada com o mantenedor: wiki e blog tem
comportamento diferente (wiki e' atemporal e editado com frequencia;
blog e' cronologico e raramente editado apos publicado), entao viram
tabelas diferentes em vez de forcar um schema unico pros dois.

Tambem mora aqui o catalogo de TAGS/categorias (Update, Guide, Lore...) e a ligacao N:N com os posts.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import ContentStatus

# Ligacao N:N entre posts e tags (apagar o post ou a tag desfaz a ligacao sozinho).
post_tag_links = Table(
    "post_tag_links", Base.metadata,
    Column("post_id", UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(50), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    """Tag/categoria de post (ex: Update, Guide, Lore). `id` e' o slug; `name` e' o INGLES e `name_pt` a traducao (DeepL)."""
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    name_pt: Mapped[str | None] = mapped_column(String(50), nullable=True)


class Post(Base, TimestampMixin):
    """Post do blog (noticia/atualizacao), separado das entries do catalogo."""
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    excerpt: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    # Traducoes EN -> PT-BR (DeepL preenche sozinho; o titulo/resumo/texto sem sufixo e' o INGLES).
    title_pt: Mapped[str | None] = mapped_column(String(200), nullable=True)
    excerpt_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # SEO: titulo e descricao das tags <meta> (vazio = usa o titulo e o resumo do post). Tamanhos ideais pro Google: ~60 e ~160.
    meta_title: Mapped[str | None] = mapped_column(String(70), nullable=True)
    meta_description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Quando o post aparece no site. Vazio = assim que for publicado. Data no futuro = AGENDADO: status "published" mas
    # invisivel para o publico ate' la'.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus, name="content_status"), default=ContentStatus.DRAFT)

    author: Mapped["User | None"] = relationship()
    tags: Mapped[list[Tag]] = relationship(secondary=post_tag_links, order_by="Tag.name", lazy="selectin")
