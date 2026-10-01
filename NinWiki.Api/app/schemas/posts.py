"""Schemas do Blog (posts): leitura (lista resumida e ficha completa) e escrita."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import ContentStatus
from app.schemas.validators import validate_rich_content

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class CamelModel(BaseModel):
    """Base dos schemas: converte nomes para camelCase no JSON, igual ao TypeScript do site."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class PostSummary(CamelModel):
    """Item da lista - sem o `content` (que pode ser grande)."""
    id: uuid.UUID
    slug: str
    title: str
    excerpt: str
    title_pt: str | None = None    # traducao EN -> PT (DeepL)
    excerpt_pt: str | None = None
    cover_image: str | None
    status: ContentStatus
    author_name: str | None
    created_at: datetime
    updated_at: datetime


class PostRead(PostSummary):
    """Ficha completa de um post (resumo + conteudo)."""
    content: str
    content_pt: str | None = None  # traducao EN -> PT (DeepL)


class PostWrite(CamelModel):
    """Corpo de criar/editar um post."""
    slug: str = Field(min_length=1, max_length=150, pattern=SLUG_PATTERN)
    title: str = Field(min_length=1, max_length=200)
    excerpt: str = ""
    content: str = ""
    # Traducoes (vazio = a DeepL traduz do ingles ao salvar; pode corrigir a mao)
    title_pt: str | None = Field(default=None, max_length=200)
    excerpt_pt: str | None = None
    content_pt: str | None = None
    cover_image: str | None = Field(default=None, max_length=500)
    status: ContentStatus = ContentStatus.DRAFT

    @field_validator("content", "content_pt")
    @classmethod
    def _rich(cls, v: str | None) -> str | None:
        """Valida o conteudo rico do post, em ingles e em portugues (documento Tiptap permitido)."""
        # mesma defesa dos outros textos ricos: so' aceita documento Tiptap valido ou texto simples sem <script
        return validate_rich_content(v) if v else v
