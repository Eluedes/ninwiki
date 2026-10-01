"""
Schemas dos "extras" da categoria Guia: Profissoes, Ranks Ninja, Story
Arcs e Summons. So' leitura (GET) por enquanto - mesmo aviso de
app/schemas/villages.py sobre como adicionar edicao no futuro.
"""
from pydantic import BaseModel, ConfigDict

from pydantic.alias_generators import to_camel

from app.models.enums import ProfessionGroup


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ProfessionRead(CamelModel):
    id: str
    name: str
    name_pt: str | None
    group: ProfessionGroup
    description: str
    icon: str


class NinjaRankRead(CamelModel):
    id: str
    name: str
    name_pt: str | None
    order: int
    description: str


class StoryArcRead(CamelModel):
    id: str
    name: str
    level_range: str
    description: str


class SummonRead(CamelModel):
    id: str
    name: str
    name_pt: str | None
    village: str
    stage_young: str
    stage_teen: str
    stage_adult: str
