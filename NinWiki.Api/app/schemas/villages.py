"""
Schemas de Vilas, Clas e Organizacoes: leitura (Read) e escrita (Write).

Padrao de idioma (mesmo de Content/Mastery/Jutsu): `name` e' o INGLES
(principal) e `name_pt` a traducao.
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.schemas.validators import validate_rich_content

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------------- leitura ----------------

class ClanRead(CamelModel):
    id: str
    name: str
    village_id: str
    description: str
    image: str | None = None


class OrganizationRead(CamelModel):
    id: str
    name: str
    description: str


class OrganizationAdminRead(OrganizationRead):
    """Organizacao + em quais vilas ela atua (usado pelo painel)."""
    village_ids: list[str] = []


class VillageRead(CamelModel):
    id: str
    name: str
    name_pt: str | None
    element: str
    motto: str
    description: str
    long_description: str
    emblem: str
    image: str | None
    accent_color: str
    climate: str
    leader: str
    map_x: float
    map_y: float
    clans: list[ClanRead] = []
    organizations: list[OrganizationRead] = []


# ---------------- escrita ----------------

class ClanWrite(CamelModel):
    id: str = Field(min_length=1, max_length=50, pattern=SLUG_PATTERN, description="Slug unico, ex: yagyu")
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    image: str | None = Field(default=None, max_length=500)


class VillageWrite(CamelModel):
    """Corpo de criar/editar uma vila. Os cla's vao junto e SUBSTITUEM a lista atual."""
    id: str = Field(min_length=1, max_length=50, pattern=SLUG_PATTERN, description="Slug unico, ex: leaf")
    name: str = Field(min_length=1, max_length=100)
    name_pt: str | None = Field(default=None, max_length=100)
    element: str = Field(min_length=1, max_length=50)
    motto: str = Field(default="", max_length=200)
    description: str = ""
    long_description: str = ""
    emblem: str = Field(min_length=1, max_length=20)
    image: str | None = Field(default=None, max_length=500)
    # Vai direto pra um `style` inline no site: so' aceita hex (#RRGGBB), nunca texto livre.
    accent_color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    climate: str = Field(default="", max_length=200)
    leader: str = Field(default="", max_length=100)
    map_x: float = Field(default=50, ge=0, le=100)
    map_y: float = Field(default=50, ge=0, le=100)
    clans: list[ClanWrite] = []

    @field_validator("long_description")
    @classmethod
    def _rich(cls, v: str) -> str:
        return validate_rich_content(v) or ""

    @field_validator("clans")
    @classmethod
    def _unique_clans(cls, v: list[ClanWrite]) -> list[ClanWrite]:
        ids = [c.id for c in v]
        if len(ids) != len(set(ids)):
            raise ValueError("Dois clãs com o mesmo id na mesma vila")
        return v


class OrganizationWrite(CamelModel):
    id: str = Field(min_length=1, max_length=50, pattern=SLUG_PATTERN, description="Slug unico, ex: anbu")
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    village_ids: list[str] = []

    @field_validator("village_ids")
    @classmethod
    def _unique_villages(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))
