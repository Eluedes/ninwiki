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
from typing import Literal
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
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class AttributeRowSchema(CamelModel):
    """Uma linha da ficha de atributos (ex: {"label": "Health", "value": "45"})."""
    label: str
    value: str


class AttackEntrySchema(CamelModel):
    """
    Um ataque/jutsu de um Mob: um jutsu do catalogo (`jutsu_id`; o nome vem dele) OU texto livre (ex: "Katon: Bola de Fogo").
    Precisa de um dos dois.
    """
    name: str = Field(default="", max_length=150)
    jutsu_id: str | None = Field(default=None, max_length=80)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        """Tira espacos extras do nome digitado."""
        return " ".join(value.split())

    @model_validator(mode="after")
    def _needs_name_or_jutsu(self):
        """Sem jutsu ligado o nome e' obrigatorio."""
        if not self.jutsu_id and not self.name.strip():
            raise ValueError("An attack needs a name or a linked jutsu")
        return self


class AttackEntryRead(AttackEntrySchema):
    """
    Ataque devolvido pela API: com jutsu ligado, `name`/`name_pt` vem do jutsu (ao vivo, a ficha acompanha renomeacoes) e `mastery_id` serve
    para o link. Mesmo padrao de DropEntryRead (a relacao do ORM vira campos planos).
    """
    name_pt: str | None = None
    mastery_id: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _from_linked_jutsu(cls, data):
        """Preenche nome/traducao/mastery a partir do jutsu ligado (carregado junto com o ataque)."""
        if hasattr(data, "jutsu") and not isinstance(data, dict):
            j = data.jutsu
            return {"name": j.name if j is not None else data.name, "jutsu_id": j.id if j is not None else None,
                    "name_pt": j.name_pt if j is not None else None, "mastery_id": j.mastery_id if j is not None else None}
        return data


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
    # Raridade do drop: NAO se escolhe mais no editor - vem do item ligado (dropped_item_id). Sem item ligado fica Common. Se o cliente
    # mandar um valor ele e' aceito mas, com item ligado, a raridade do item vence (ver content_items.py e DropEntryRead).
    rarity: Rarity | None = None
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
            out = {
                **{f: getattr(data, f, None) for f in cls.model_fields if f != "dropped_item_slug"},
                "dropped_item_slug": slug,
            }
            if linked is not None:   # raridade "ao vivo": acompanha o item ligado (mudou a raridade do item, o drop muda junto)
                out["rarity"] = linked.rarity
            return out
        return data


class DroppedByEntry(CamelModel):
    """
    Um mob que dropa este item (lado INVERSO do drop): calculado na leitura a partir das paginas de mob que ligam
    (ou citam pelo nome) este item - ninguem cadastra isso a mao. So' mobs publicados entram.
    """
    slug: str
    name: str
    name_pt: str | None = None
    image: str | None = None
    icon: str
    chance: float
    chance_qualifier: DropChanceQualifier | None = None


class LocationEntrySchema(CamelModel):
    """
    Um lugar onde o mob aparece (ex.: "Larva Road", zona "safe"). A ficha mostra um lugar por linha, com um ponto na cor da zona e o nome da zona.
    `name_pt` e' opcional (sem ele o site mostra o nome em ingles tambem em portugues).
    """
    name: str = Field(min_length=1, max_length=120)
    name_pt: str | None = Field(default=None, max_length=120)
    zone: Literal["safe", "danger", "war", "arena", "parkour", "none"] | None = None

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        """Tira espacos extras; nome so' com espacos e' recusado."""
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("The place name cannot be blank")
        return cleaned

    @field_validator("name_pt")
    @classmethod
    def _clean_name_pt(cls, value: str | None) -> str | None:
        """Tira espacos extras; em branco vira vazio (sem traducao)."""
        return (" ".join(value.split()) or None) if value is not None else None


class SaleEntrySchema(CamelModel):
    """
    Uma loja de NPC que vende o item: nome da loja, onde ela fica (lugares ou NPCs), quantas unidades por esse preco, o preco e a moeda
    (o nome de um item, ex.: "Ryo" ou "Halloween Token").
    """
    shop: str = Field(min_length=1, max_length=120)
    places: list[str] = Field(default_factory=list, max_length=30)
    qty: int = Field(default=1, ge=1, le=100000)
    price: int = Field(default=0, ge=0, le=1_000_000_000)
    currency: str = Field(default="Ryo", min_length=1, max_length=80)

    @field_validator("shop", "currency")
    @classmethod
    def _clean_text(cls, value: str) -> str:
        """Tira espacos extras; texto so' com espacos e' recusado."""
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("This field cannot be blank")
        return cleaned

    @field_validator("places")
    @classmethod
    def _clean_places(cls, value: list[str]) -> list[str]:
        """Tira espacos e descarta lugares em branco ou repetidos (cada um com no maximo 120 caracteres)."""
        out: list[str] = []
        for place in value:
            cleaned = " ".join(str(place).split())[:120]
            if cleaned and cleaned not in out:
                out.append(cleaned)
        return out


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
    # Lugares onde o mob aparece, em lista (um por linha na ficha, com a zona). Se vier vazia, a ficha usa o texto livre acima.
    spawn_locations: list[LocationEntrySchema] = Field(default_factory=list, max_length=60)
    # Lojas de NPC que vendem este item/arma, com o preco (uma linha por loja na ficha).
    sold_at: list[SaleEntrySchema] = Field(default_factory=list, max_length=60)
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
    weapon_requirement: str | None = None   # ate' 3 requisitos para usar, um por LINHA (ver _clean_requirements)
    weapon_npc: str | None = None
    weapon_npc_id: UUID | None = None   # liga o NPC a uma pagina do wiki (o nome mostrado acompanha a pagina; ver ContentItemRead)
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

    @field_validator("spawn_locations", "sold_at", mode="before")
    @classmethod
    def _no_locations(cls, value):
        """Coluna nula no banco (mob antigo) vira lista vazia."""
        return value or []

    @field_validator("weapon_requirement")
    @classmethod
    def _clean_requirements(cls, value: str | None) -> str | None:
        """Ate' 3 requisitos (um por linha, ex.: "60 Agility" e "20 Chakra"), sem espacos extras nem linhas vazias; cada um com no maximo 100 caracteres."""
        if value is None:
            return None
        lines = [" ".join(line.split()) for line in value.splitlines()]
        lines = [line for line in lines if line]
        if len(lines) > 3:
            raise ValueError("A weapon can have at most 3 requirements to use")
        if any(len(line) > 100 for line in lines):
            raise ValueError("Each requirement can have at most 100 characters")
        return "\n".join(lines) or None

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
    attacks: list[AttackEntryRead] = []   # leitura: com o nome/traducao do jutsu ligado
    # Nome de exibicao da vila do cast_village_id (ex: "Vila da Névoa")
    # - calculado a partir da relacao `cast_village` do ORM, mesmo
    # padrao/motivo de DropEntryRead.dropped_item_slug logo acima (o
    # campo nao existe com esse nome no banco, so' a relacao).
    cast_village_name: str | None = None
    # NPC da arma ligado a uma pagina (calculado da relacao `weapon_npc_item`): o slug so' vem se a pagina esta' PUBLICADA (link seguro);
    # `weapon_npc` (nome) passa a ser o da pagina ligada, e o `_pt` e' o nome dela em portugues.
    weapon_npc_slug: str | None = None
    weapon_npc_name_pt: str | None = None
    # Mobs que dropam este item (automatico, ver DroppedByEntry); preenchido pelos GETs de ficha - nas demais respostas fica [].
    dropped_by: list[DroppedByEntry] = []
    updated_at: datetime | None = None    # ultima edicao (o site mostra 'Atualizado em')
    translation_auto: bool = False        # portugues veio da traducao automatica e ninguem revisou (ver ContentItem.translation_auto)

    @model_validator(mode="before")
    @classmethod
    def _compute_cast_village_name(cls, data):
        """Preenche o nome da vila do item Cast a partir da relacao carregada do banco."""
        if hasattr(data, "cast_village") and not isinstance(data, dict):
            village = data.cast_village
            npc = getattr(data, "weapon_npc_item", None)
            out = {
                **{f: getattr(data, f, None) for f in cls.model_fields if f not in ("cast_village_name", "dropped_by", "weapon_npc_slug", "weapon_npc_name_pt")},
                "cast_village_name": village.name if village is not None else None,
                "weapon_npc_slug": npc.slug if (npc is not None and npc.status == ContentStatus.PUBLISHED) else None,
                "weapon_npc_name_pt": npc.name_pt if npc is not None else None,
            }
            if npc is not None:   # nome "ao vivo": acompanha a pagina ligada
                out["weapon_npc"] = npc.name
            return out
        return data

    # from_attributes=True: deixa o Pydantic ler direto de um objeto
    # SQLAlchemy (ContentItem.name, ContentItem.slug, etc.) em vez de
    # exigir um dicionario - sem isso, `ContentItemRead.model_validate(item)`
    # nao funcionaria com o resultado de uma query.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ContentVersionRead(CamelModel):
    """Uma versao anterior da entry na lista do historico (o JSON completo fica so' no servidor ate' restaurar)."""
    id: UUID
    created_at: datetime
    saved_by: str | None
    name: str
    status: str


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
