"""
Schemas dos "extras" da categoria Guia: Profissoes, Ranks Ninja, Story
Arcs e Summons. So' leitura (GET) por enquanto - mesmo aviso de
app/schemas/villages.py sobre como adicionar edicao no futuro.
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator

from pydantic.alias_generators import to_camel

from app.models.enums import ContentStatus, ProfessionGroup
from app.schemas.validators import validate_rich_content

# Secoes do Guia, na ordem em que aparecem no site (o rotulo de cada uma fica em lib/i18n.ts).
GUIDE_SECTIONS = ("new-player", "combat", "progression", "interface", "economy")
SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class CamelModel(BaseModel):
    """Base dos schemas: converte nomes para camelCase no JSON, igual ao TypeScript do site."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ProfessionRead(CamelModel):
    """Profissao como a API devolve."""
    id: str
    name: str
    name_pt: str | None
    group: ProfessionGroup
    description: str
    description_pt: str | None = None  # traducao EN -> PT (DeepL)
    icon: str
    # Informacao completa da pagina da profissao: {"resources": [...], "recipes": [...], "tools": [...]} (ver scripts/importar_profissoes_atlas.py)
    details: dict | None = None


class NinjaRankRead(CamelModel):
    """Rank ninja como a API devolve."""
    id: str
    name: str
    name_pt: str | None
    order: int
    description: str
    description_pt: str | None = None  # traducao EN -> PT (DeepL)


class StoryArcRead(CamelModel):
    """Arco de historia como a API devolve."""
    id: str
    name: str
    name_pt: str | None = None  # traducao EN -> PT (DeepL)
    level_range: str
    description: str
    description_pt: str | None = None


class SummonRead(CamelModel):
    """Summon como a API devolve."""
    id: str
    name: str
    name_pt: str | None
    village: str
    village_pt: str | None = None  # traducao EN -> PT (DeepL)
    stage_young: str
    stage_teen: str
    stage_adult: str
    stage_young_pt: str | None = None
    stage_teen_pt: str | None = None
    stage_adult_pt: str | None = None


class ProfessionWrite(CamelModel):
    """Corpo de criar/editar uma proficiencia. Os `details` (receitas, recursos, ferramentas) NAO entram aqui: vem do importador e nao sao mexidos."""
    id: str = Field(min_length=1, max_length=50, pattern=SLUG_PATTERN, description="Slug unico, ex: cooking")
    name: str = Field(default="", max_length=100)   # vazio permitido se o _pt vier escrito: o EN e' gerado (translation.fill_missing_translations); vazio nos dois = 422
    name_pt: str | None = Field(default=None, max_length=100)     # vazio = a DeepL traduz
    group: ProfessionGroup
    description: str = ""
    description_pt: str | None = None
    icon: str = Field(min_length=1, max_length=20)                # emoji


class GuideArticleRead(CamelModel):
    """Artigo do Guia como a API devolve."""
    id: str
    section: str
    position: int
    title: str
    title_pt: str | None = None
    summary: str
    summary_pt: str | None = None
    body: str
    body_pt: str | None = None
    icon: str
    status: ContentStatus


class GuideArticleWrite(CamelModel):
    """Corpo de criar/editar um artigo do Guia."""
    id: str = Field(min_length=1, max_length=80, pattern=SLUG_PATTERN, description="Slug unico, ex: crime-system")
    section: str
    position: int = Field(default=0, ge=0, le=999)
    title: str = Field(default="", max_length=150)   # vazio permitido se o _pt vier escrito: o EN e' gerado (translation.fill_missing_translations); vazio nos dois = 422
    title_pt: str | None = Field(default=None, max_length=150)    # vazio = a DeepL traduz
    summary: str = Field(default="", max_length=300)
    summary_pt: str | None = Field(default=None, max_length=300)
    body: str = ""
    body_pt: str | None = None
    icon: str = Field(default="book-open", min_length=1, max_length=50)
    status: ContentStatus = ContentStatus.PUBLISHED

    @field_validator("section")
    @classmethod
    def _section(cls, v: str) -> str:
        """So' as secoes que o Guia conhece (senao o artigo nunca apareceria)."""
        if v not in GUIDE_SECTIONS:
            raise ValueError(f"Unknown section; use one of: {', '.join(GUIDE_SECTIONS)}")
        return v

    @field_validator("body", "body_pt")
    @classmethod
    def _rich(cls, v: str | None) -> str | None:
        """Valida o texto rico (documento Tiptap permitido), em ingles e em portugues."""
        return validate_rich_content(v) if v else v
