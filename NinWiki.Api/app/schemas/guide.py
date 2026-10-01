"""
Schemas dos "extras" da categoria Guia: Profissoes, Ranks Ninja, Story
Arcs e Summons. So' leitura (GET) por enquanto - mesmo aviso de
app/schemas/villages.py sobre como adicionar edicao no futuro.
"""
from pydantic import BaseModel, ConfigDict

from pydantic.alias_generators import to_camel

from app.models.enums import ProfessionGroup


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
