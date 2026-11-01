"""Schemas do Blog (posts): leitura (lista resumida e ficha completa), escrita, tags, comentarios e curtidas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.models.enums import ContentStatus
from app.schemas.validators import validate_rich_content

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
MAX_TAGS_PER_POST = 8
MAX_COMMENT_CHARS = 1000


class CamelModel(BaseModel):
    """Base dos schemas: converte nomes para camelCase no JSON, igual ao TypeScript do site."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class TagRead(CamelModel):
    """Tag/categoria de post: `id` e' o slug (usado no filtro ?tag=), `name` em ingles e `name_pt` a traducao."""
    id: str
    name: str
    name_pt: str | None = None


class TagWrite(CamelModel):
    """Corpo de criar uma tag nova (so' o nome em ingles; o slug nasce do nome e a DeepL traduz)."""
    name: str = Field(min_length=2, max_length=50)

    @field_validator("name")
    @classmethod
    def _clean(cls, v: str) -> str:
        """Tira espacos e caracteres de controle do nome."""
        return " ".join("".join(ch if ch.isprintable() else " " for ch in v).split())


class TagWithCount(TagRead):
    """Tag + quantos posts PUBLICADOS usam (para a lista de filtros do blog)."""
    post_count: int = 0


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
    tags: list[TagRead] = []
    published_at: datetime | None = None
    is_scheduled: bool = False      # publicado com data no FUTURO: ainda invisivel para o publico
    is_steam: bool = False          # post importado da Steam (oficial da desenvolvedora): selo com a logo dela
    like_count: int = 0
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


class PostRead(PostSummary):
    """Ficha completa de um post (resumo + conteudo + SEO)."""
    content: str
    content_pt: str | None = None  # traducao EN -> PT (DeepL)
    banner_image: str | None = None   # banner largo do topo do post (vazio = usa a capa)
    meta_title: str | None = None
    meta_description: str | None = None


class PostWrite(CamelModel):
    """Corpo de criar/editar um post."""
    slug: str = Field(min_length=1, max_length=150, pattern=SLUG_PATTERN)
    title: str = Field(default="", max_length=200)   # vazio permitido se o _pt vier escrito: o EN e' gerado (translation.fill_missing_translations); vazio nos dois = 422
    excerpt: str = ""
    content: str = ""
    # Traducoes (vazio = a DeepL traduz do ingles ao salvar; pode corrigir a mao)
    title_pt: str | None = Field(default=None, max_length=200)
    excerpt_pt: str | None = None
    content_pt: str | None = None
    cover_image: str | None = Field(default=None, max_length=500)
    banner_image: str | None = Field(default=None, max_length=500)   # banner do topo do post (vazio = usa a capa)
    status: ContentStatus = ContentStatus.DRAFT
    tags: list[str] = Field(default_factory=list, max_length=MAX_TAGS_PER_POST)
    # SEO (vazio = usa titulo e resumo) e agendamento (vazio = publica quando for publicado)
    meta_title: str | None = Field(default=None, max_length=70)
    meta_description: str | None = Field(default=None, max_length=200)
    published_at: datetime | None = None

    @field_validator("content", "content_pt")
    @classmethod
    def _rich(cls, v: str | None) -> str | None:
        """Valida o conteudo rico do post, em ingles e em portugues (documento Tiptap permitido)."""
        # mesma defesa dos outros textos ricos: so' aceita documento Tiptap valido ou texto simples sem <script
        return validate_rich_content(v) if v else v

    @field_validator("tags")
    @classmethod
    def _tags_ok(cls, v: list[str]) -> list[str]:
        """Cada tag precisa ser um slug valido; repetidas somem (mantem a ordem)."""
        import re
        for t in v:
            if not re.fullmatch(SLUG_PATTERN, t) or len(t) > 50:
                raise ValueError(f"Invalid tag: {t[:30]}")
        return list(dict.fromkeys(v))

    @field_validator("meta_title", "meta_description")
    @classmethod
    def _meta_clean(cls, v: str | None) -> str | None:
        """Limpa espacos e quebras de linha dos campos de SEO (vazio vira None)."""
        if v is None:
            return None
        v = " ".join(v.split())
        return v or None


# ---------------- leitores, comentarios e curtidas ----------------

class ReaderPublic(CamelModel):
    """O que se mostra de um leitor: so' nome e avatar do Discord (nunca o ID)."""
    username: str
    avatar_url: str | None = None


class ReaderMe(ReaderPublic):
    """O leitor logado (resposta de /auth/reader/me)."""
    id: uuid.UUID
    is_super_admin: bool = False   # o mesmo Discord e' de um S.Adm ATIVO: so' ele ve o atalho para o painel no menu do usuario (so' conforto; o painel tem login e permissoes proprios)


class CommentRead(CamelModel):
    """Um comentario visivel no post."""
    id: uuid.UUID
    body: str
    created_at: datetime
    author: ReaderPublic
    mine: bool = False   # o leitor logado e' o autor (pode apagar)


class CommentWrite(CamelModel):
    """Corpo de comentar: texto simples, ate' MAX_COMMENT_CHARS caracteres."""
    body: str = Field(min_length=1, max_length=MAX_COMMENT_CHARS * 2)


class Engagement(CamelModel):
    """Curtidas e comentarios de um post + se o leitor logado ja' curtiu."""
    like_count: int
    comment_count: int
    liked_by_me: bool = False


class ModerationComment(CamelModel):
    """Um comentario como a MODERACAO ve': com o post, o autor (e o ID do Discord) e se esta' escondido."""
    id: uuid.UUID
    body: str
    created_at: datetime
    hidden: bool
    hidden_by: str | None
    post_slug: str
    post_title: str
    reader_id: uuid.UUID
    reader_name: str
    reader_discord_id: str
    reader_banned: bool
