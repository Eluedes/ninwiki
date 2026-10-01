"""
Schemas Pydantic de content_items (mobs/itens/armas/missoes/guias).

Um "schema" Pydantic NAO e' o modelo do banco (ver app/models/content.py) -
e' o formato de dado que ENTRA e SAI pela API. Separar os dois evita
expor colunas internas por acidente (ex: nunca queremos aceitar um
`id` vindo do cliente na criacao) e deixa a validacao de entrada
explicita (ex: `rarity` so' aceita um dos 5 valores do enum).

CAMELCASE: o front (TypeScript) usa camelCase (mobType, minQty, itemName -
ver lib/types.ts) mas o Python/banco usa snake_case (mob_type, min_qty,
item_name - convencao normal de cada linguagem). `alias_generator`
abaixo faz o Pydantic aceitar E devolver os dois formatos automaticamente,
sem precisar de nenhum "traducao" manual em cada endpoint.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.schemas.validators import validate_rich_content

from app.models.enums import ContentCategory, ContentStatus, DropChanceQualifier, ItemType, MobType, Rarity


class CamelModel(BaseModel):
    """
    Base para todo schema deste arquivo. populate_by_name=True e' o que
    permite os DOIS formatos funcionarem: o codigo Python interno pode
    construir com `ContentItemRead(mob_type=...)` (nome real do campo),
    e o JSON que entra/sai pela rede usa `mobType` (o alias camelCase) -
    sem essa flag, so' um dos dois formatos seria aceito.
    """
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class AttributeRowSchema(CamelModel):
    """Uma linha da ficha de atributos (ex: {"label": "Health", "value": "45"})."""
    label: str
    value: str


class AttackEntrySchema(CamelModel):
    """Um ataque/jutsu de um Mob (texto livre, ex: "Katon: Bola de Fogo")."""
    name: str = Field(min_length=1, max_length=150)


class DropEntrySchema(CamelModel):
    """
    Um item que pode dropar de um mob - aceito em criar/editar (POST/PUT).

    dropped_item_id (opcional): liga esse drop a uma entry de verdade
    do catalogo (ex: a entry do proprio "Broad Sword" em Armas), pra'
    a pagina publica poder linkar pra' ela. item_name continua sendo o
    texto exibido sempre (drop pode nao ter uma entry cadastrada ainda -
    ver nota de design em app/models/content.py::ContentItemDrop).
    """
    item_name: str
    rarity: Rarity
    chance: float = Field(ge=0, le=100)  # ge/le: valida que fica entre 0 e 100
    # Ver DropChanceQualifier em app/models/enums.py - None mostra o
    # numero exato, "over"/"below" mostra "Over X%"/"Below X%" na
    # ficha publica, igual a ficha do proprio jogo.
    chance_qualifier: DropChanceQualifier | None = None
    min_qty: int | None = None
    max_qty: int | None = None
    dropped_item_id: UUID | None = None


class DropEntryRead(DropEntrySchema):
    """
    Mesma coisa que DropEntrySchema, so' que devolvida pela API com um
    campo a mais: dropped_item_slug, calculado a partir da relacao
    `dropped_item` do ORM (nao existe uma coluna com esse nome no
    banco - ver o model_validator abaixo).
    """
    dropped_item_slug: str | None = None

    # Mesmo padrao usado em app/schemas/masteries.py::MasteryRead pro
    # bug de attribute_ids: from_attributes so' entrega pro validator o
    # que ele ACHOU no objeto ORM procurando um atributo com o MESMO
    # nome do campo - e ContentItemDrop nao tem nenhum campo chamado
    # "dropped_item_slug", so' tem a relacao `dropped_item` (o objeto
    # ContentItem inteiro, quando ligado). Sem esse model_validator, o
    # campo sempre voltaria None mesmo quando o drop esta' ligado a um
    # item de verdade.
    #
    # REGRA DE NEGOCIO embutida aqui: so' devolve o slug (e portanto so'
    # a pagina publica so' cria o link) quando o item ligado esta'
    # PUBLICADO - um drop apontando pra um rascunho fica so' com o
    # texto, sem link, pra' nunca levar o visitante numa pagina que
    # ainda nao existe pra ele.
    @model_validator(mode="before")
    @classmethod
    def _compute_dropped_item_slug(cls, data):
        """Preenche o slug do item ligado ao drop a partir da relacao carregada do banco."""
        if hasattr(data, "dropped_item") and not isinstance(data, dict):
            linked = data.dropped_item
            slug = linked.slug if (linked is not None and linked.status == ContentStatus.PUBLISHED) else None
            return {
                **{f: getattr(data, f, None) for f in cls.model_fields if f != "dropped_item_slug"},
                "dropped_item_slug": slug,
            }
        return data


class ContentItemBase(CamelModel):
    """Campos compartilhados entre criar e editar - o "miolo" do formulario."""
    slug: str = Field(min_length=1, max_length=150)
    category: ContentCategory
    name: str = Field(min_length=1, max_length=200)
    level: int = Field(default=0, ge=0)
    icon: str = Field(min_length=1, max_length=20)
    image: str | None = None
    rarity: Rarity
    description: str
    lore: str | None = None
    synergy: str | None = None
    # So' usado quando category == MOBS - onde o mob spawna no mapa
    # (ex: "Floresta Negra, Campos Iniciais"). Texto livre por enquanto
    # (sem marcador de mapa clicavel ainda - o Mapa em si ainda e' so'
    # um placeholder, ver Fase 5 do roadmap).
    spawn_location: str | None = None
    # ---- Versoes em portugues (traducao automatica via DeepL, EN->PT) ----
    # Sempre editaveis a mao, mesmo depois de preenchidos pela DeepL -
    # ver app/core/translation.py pro fluxo completo (quando traduz,
    # quando NAO sobrescreve uma correcao manual).
    name_pt: str | None = None
    description_pt: str | None = None
    lore_pt: str | None = None
    synergy_pt: str | None = None
    spawn_location_pt: str | None = None
    # ---- Fixos so' de MOBS (substituem a lista generica de Atributos
    # pra essa categoria - ver nota completa em models/content.py) ----
    mob_health: str | None = None
    mob_damage: str | None = None
    mob_experience: str | None = None
    mob_range: str | None = None
    mob_respawn_time: str | None = None
    attacks: list[AttackEntrySchema] = []
    # ---- Fixos so' de ARMAS (categoria WEAPONS) ----
    weapon_speed: str | None = None
    weapon_requirement: str | None = None
    weapon_npc: str | None = None
    weapon_type: str | None = None
    weapon_base_damage: str | None = None
    weapon_special_ability: str | None = None
    weapon_knockback_distance: str | None = None
    # ---- Fixos so' de ITEM tipo Currency/Cast ----
    max_stack: int | None = Field(default=None, ge=0)
    cast_village_id: str | None = None
    mob_type: MobType | None = None
    item_type: ItemType | None = None
    attributes: list[AttributeRowSchema] = []
    drops: list[DropEntrySchema] = []

    @field_validator("description", "lore", "synergy")
    @classmethod
    def _validate_rich_content(cls, value: str | None) -> str | None:
        """Ver app/schemas/validators.py::validate_rich_content pro detalhe das regras."""
        return validate_rich_content(value)


class ContentItemCreate(ContentItemBase):
    """Corpo esperado no POST /content-items - status sempre nasce DRAFT."""
    pass


class ContentItemUpdate(ContentItemBase):
    """
    Corpo esperado no PUT /content-items/{id}. Igual ao Create, mas
    tambem aceita mudar o status (ex: publicar um rascunho).
    """
    status: ContentStatus = ContentStatus.DRAFT


class ContentItemRead(ContentItemBase):
    """O que a API DEVOLVE - inclui campos gerados pelo banco (id, status,
    datas) que o cliente nunca envia."""
    id: UUID
    status: ContentStatus
    # Sobrescreve o `drops` herdado de ContentItemBase (que so' aceita
    # escrita) pela variante de LEITURA, que inclui dropped_item_slug.
    drops: list[DropEntryRead] = []
    # Nome de exibicao da vila do cast_village_id (ex: "Vila da Névoa")
    # - calculado a partir da relacao `cast_village` do ORM, mesmo
    # padrao/motivo de DropEntryRead.dropped_item_slug logo acima (o
    # campo nao existe com esse nome no banco, so' a relacao).
    cast_village_name: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _compute_cast_village_name(cls, data):
        """Preenche o nome da vila do item Cast a partir da relacao carregada do banco."""
        if hasattr(data, "cast_village") and not isinstance(data, dict):
            village = data.cast_village
            return {
                **{f: getattr(data, f, None) for f in cls.model_fields if f != "cast_village_name"},
                "cast_village_name": village.name if village is not None else None,
            }
        return data

    # from_attributes=True: deixa o Pydantic ler direto de um objeto
    # SQLAlchemy (ContentItem.name, ContentItem.slug, etc.) em vez de
    # exigir um dicionario - sem isso, `ContentItemRead.model_validate(item)`
    # nao funcionaria com o resultado de uma query.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ContentItemSummary(CamelModel):
    """
    Versao enxuta usada na LISTAGEM (sem lore/synergy/attributes/drops
    inteiros) - listar 100 mobs nao precisa trazer a ficha completa de
    cada um, so' o suficiente pra montar um card/linha de tabela.
    """
    id: UUID
    slug: str
    category: ContentCategory
    name: str
    level: int
    icon: str
    image: str | None
    rarity: Rarity
    mob_type: MobType | None
    item_type: ItemType | None
    status: ContentStatus
    updated_at: datetime
    # Adicionado pro catalogo publico poder buscar por texto (nome OU
    # descricao) sem precisar da ficha completa de cada entry - custo
    # baixo (e' so' o texto CURTO, nunca lore/synergy que sao mais
    # pesados) pelo beneficio de manter a busca funcionando igual a
    # versao antiga baseada no mock.
    description: str
    # name_pt/description_pt: pro catalogo publico mostrar o nome/resumo
    # certo quando o idioma escolhido e' portugues, sem precisar buscar a
    # ficha completa so' pra isso. Nao inclui lore_pt/synergy_pt aqui -
    # esses so' aparecem na pagina de detalhe (ContentItemRead),
    # nao no card resumido da listagem.
    name_pt: str | None
    description_pt: str | None

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
