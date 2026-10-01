"""Schemas do Blog (posts): leitura (lista resumida e ficha completa) e escrita."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import ContentStatus
from app.schemas.validators import validate_rich_content

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class PostSummary(CamelModel):
    """Item da lista - sem o `content` (que pode ser grande)."""
    id: uuid.UUID
    slug: str
    title: str
    excerpt: str
    cover_image: str | None
    status: ContentStatus
    author_name: str | None
    created_at: datetime
    updated_at: datetime


class PostRead(PostSummary):
    content: str


class PostWrite(CamelModel):
    slug: str = Field(min_length=1, max_length=150, pattern=SLUG_PATTERN)
    title: str = Field(min_length=1, max_length=200)
    excerpt: str = ""
    content: str = ""
    cover_image: str | None = Field(default=None, max_length=500)
    status: ContentStatus = ContentStatus.DRAFT

    @field_validator("content")
    @classmethod
    def _rich(cls, v: str) -> str:
        # mesma defesa dos outros textos ricos: so' aceita documento Tiptap valido ou texto simples sem <script
        return validate_rich_content(v) or ""
