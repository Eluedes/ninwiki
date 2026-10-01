"""
Schemas de Masteries e Jutsus.

Masteries agora tem escrita tambem (PUT) - os 8 elementos em si sao
fixos (nao da' pra criar/apagar uma mastery inteira por aqui), mas o
CONTEUDO de cada uma (textos, icone, cor, atributos ligados, e os
Paths aninhados) e' editavel, pensando numa hierarquia de permissao
futura onde nem todo editor vai ter acesso a tudo do painel.
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.schemas.validators import validate_rich_content


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AttributeRead(CamelModel):
    """Um atributo do personagem (Forca, Agilidade...) - lista fixa de 5, so' leitura."""
    id: str
    name: str
    name_pt: str | None
    description: str
    icon: str

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class MasteryPathRead(CamelModel):
    id: str
    label: str
    description: str
    requirement: str | None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class MasteryRead(CamelModel):
    """Ficha completa de uma mastery, com os caminhos aninhados."""
    id: str
    name: str
    name_pt: str | None
    type: str
    element: str
    description: str
    long_description: str
    description_pt: str | None
    long_description_pt: str | None
    icon: str
    color: str
    image: str | None
    gif: str | None = None # Adicionado esta linha gif: no dia 27/09/2026 as 22:56
    paths: list[MasteryPathRead] = []
    # so' os ids - o front ja' tem a lista completa de atributos via
    # GET /attributes, nao precisa repetir nome/descricao de cada um aqui.
    attribute_ids: list[str] = []

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    # BUG QUE JA' ACONTECEU AQUI, pra' nao repetir: o jeito "obvio" de
    # fazer isso seria um field_validator(mode="before") em
    # "attribute_ids" - mas from_attributes so' entrega pro validator o
    # que ele CONSEGUIU achar no objeto ORM procurando por um atributo
    # chamado literalmente "attribute_ids" (ou "attributeIds", o alias) -
    # e o modelo Mastery nao tem NENHUM dos dois, so' tem `.attributes`
    # (a relacao de verdade, com os objetos Attribute inteiros). Sem
    # achar nada, o Pydantic usava soo' o default ([]) e o validator
    # nunca chegava a rodar em cima do dado real - por isso salvava
    # certinho no banco mas voltava sempre vazio na resposta.
    #
    # model_validator(mode="before") roda ANTES de qualquer mapeamento
    # campo-a-campo, com acesso ao objeto ORM inteiro - da' pra' ler
    # `.attributes` (o nome certo) e injetar o resultado como
    # "attribute_ids" (o nome que o resto da classe espera) antes do
    # Pydantic tentar montar os campos.
    @model_validator(mode="before")
    @classmethod
    def _pull_attribute_ids_from_orm(cls, data):
        if hasattr(data, "attributes") and not isinstance(data, dict):
            ids = [a.id for a in data.attributes]
            # Mastery e' um objeto ORM, nao um dict - nao da' pra' so'
            # fazer data["attribute_ids"] = ids. Um dict novo, combinando
            # os campos que o Pydantic ainda vai ler do ORM (via
            # from_attributes normalmente) com o valor calculado aqui,
            # resolve sem precisar mexer no modelo do banco.
            return {**{f: getattr(data, f, None) for f in cls.model_fields if f != "attribute_ids"}, "attribute_ids": ids}
        return data


class MasteryPathWrite(CamelModel):
    """
    Um Path dentro do corpo de PUT /masteries/{id}. Path NOVO (que voce'
    esta' adicionando agora, nao um que ja' existia): manda um id novo,
    unico, nesse formato de slug (ex: "wind-fan-leque"). Path que ja'
    existia: manda o MESMO id de antes, pra' o backend saber que e'
    uma edicao, nao uma criacao.
    """
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=150)
    description: str
    requirement: str | None = None


class MasteryWrite(CamelModel):
    """
    Corpo aceito em PUT /masteries/{id}. Substitui os campos da mastery
    E a lista de Paths inteira (mesmo padrao de attributes/drops do
    content_items: manda a lista completa de como deve ficar, o backend
    calcula sozinho o que criar/atualizar/apagar).

    NAO inclui id/type/element - esses 3 continuam fixos (sao a propria
    identidade do elemento do jogo, editar mudaria qual mastery e' essa).
    """
    name: str = Field(min_length=1, max_length=100)
    name_pt: str | None = None
    description: str
    long_description: str
    description_pt: str | None = None
    long_description_pt: str | None = None
    icon: str = Field(min_length=1, max_length=50)
    color: str = Field(min_length=1, max_length=20)
    image: str | None = None
    gif: str | None = None # Adicionado esta linha gif: no dia 27/09/2026 as 22:56
    attribute_ids: list[str] = []
    paths: list[MasteryPathWrite] = []

    @field_validator("description", "long_description")
    @classmethod
    def _validate_rich_content(cls, value: str | None) -> str | None:
        """Ver app/schemas/validators.py::validate_rich_content pro detalhe das regras."""
        return validate_rich_content(value)


class JutsuRead(CamelModel):
    id: str
    name: str
    name_pt: str | None
    mastery_id: str
    path_id: str | None
    tier: int
    chakra_cost: int
    description: str
    long_description: str
    description_pt: str | None
    long_description_pt: str | None
    effect: str
    range: str
    cast_time: str
    cooldown: str
    icon: str
    gif: str | None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class JutsuWrite(CamelModel):
    """Corpo aceito em criar/editar um jutsu."""
    id: str = Field(min_length=1, max_length=80, description="Slug único, ex: katon-goukakyuu")
    name: str
    name_pt: str | None = None
    mastery_id: str
    path_id: str | None = None
    tier: int = Field(ge=1, le=5)
    chakra_cost: int = Field(ge=0)
    description: str
    long_description: str
    description_pt: str | None = None
    long_description_pt: str | None = None
    effect: str
    range: str
    cast_time: str
    cooldown: str
    icon: str
    gif: str | None = None

    @field_validator("description", "long_description")
    @classmethod
    def _validate_rich_content(cls, value: str | None) -> str | None:
        """Ver app/schemas/validators.py::validate_rich_content pro detalhe das regras."""
        return validate_rich_content(value)
