"""
Tabelas do conteudo "generico" do wiki: mobs, itens, armas, missoes e
guias. Espelha WikiEntry em lib/types.ts do front.

NAO cobre Masteries/Jutsus (ver models/masteries.py) nem Vilas/Clas/
Organizacoes (ver models/villages.py) - esses tem campos especificos
demais para caber num "content_items" generico, exatamente como
decidido no desenho de schema do roadmap (Fase 1).
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import ContentCategory, ContentStatus, DropChanceQualifier, ItemType, MobType, Rarity


class ContentItem(Base, TimestampMixin):
    """
    Uma "pagina" do catalogo generico (um mob, item, arma, missao ou
    guia). Equivalente a um objeto do array `entries` em lib/data.ts.
    """
    __tablename__ = "content_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # True quando o texto em portugues foi preenchido pela traducao AUTOMATICA (DeepL) e nenhuma pessoa corrigiu/escreveu a mao
    # depois. O site mostra o selo "Traducao automatica" so' nesse caso (e o visitante pode reportar erro). False = revisado ou sem dado.
    translation_auto: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Identificador amigavel usado na URL (ex: "larva", "ring-of-vigor").
    # Unico no banco inteiro, nao so' dentro da categoria - evita duas
    # entries com o mesmo slug colidirem na mesma rota /detail/[slug].
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True)

    category: Mapped[ContentCategory] = mapped_column(Enum(ContentCategory, name="content_category"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    level: Mapped[int] = mapped_column(default=0)
    icon: Mapped[str] = mapped_column(String(20))  # emoji

    # Caminho local ou URL devolvida por um servico de storage. Nullable
    # porque o front cai para `icon` como fallback quando vazio (mesma
    # logica de components/wiki/wiki-image.tsx).
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)

    rarity: Mapped[Rarity] = mapped_column(Enum(Rarity, name="rarity"))
    description: Mapped[str] = mapped_column(Text)
    lore: Mapped[str | None] = mapped_column(Text, nullable=True)
    synergy: Mapped[str | None] = mapped_column(Text, nullable=True)
    # So' usado quando category == MOBS - texto livre com onde o mob
    # spawna (ex: "Floresta Negra, Campos Iniciais"). Sem marcador de
    # mapa clicavel ainda - o Mapa em si ainda e' so' um placeholder
    # (Fase 5), fica pra quando ele tiver a imagem real do jogo.
    spawn_location: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # ---- Versoes em PORTUGUES dos campos acima (traducao automatica,
    # invertida em 25/09 - decisao final do Rafael: o padrao do site e
    # do painel e' INGLES, entao o que a pessoa digita nos campos SEM
    # sufixo (name/description/lore/synergy/spawn_location) e' sempre
    # INGLES - e' a lingua "principal" de escrita a partir de agora.
    # Estas colunas gemeas guardam a versao em portugues, preenchida
    # automaticamente pela DeepL ao criar/editar (ver
    # app/core/translation.py, que traduz EN -> PT) - mas continuam
    # 100% editaveis a mao, pra corrigir erro de traducao. Nullable no
    # banco pra nao quebrar linhas antigas que nasceram antes dessa
    # coluna existir, ate a proxima edicao preencher.
    name_pt: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    lore_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    synergy_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    spawn_location_pt: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Lugares onde o mob aparece, em lista: [{name, name_pt, zone}] (zone: safe/danger/war/arena/parkour/none). Quando existe, a ficha mostra a lista (um lugar por linha, com a zona);
    # vazia/nula = mostra o texto livre `spawn_location` de antes.
    spawn_locations: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # ---- Campos fixos so' de MOBS (melhoria da ficha, 24/09) ----
    # Espelham a ficha do proprio jogo (Health/Damage/Experience/Range/
    # Respawn Time) - TEXT (nao numero) pelo mesmo motivo de
    # ContentItemAttribute.value logo abaixo: Damage pode vir em faixa
    # ("3-5"), Range pode ter unidade, etc. Substituem a lista generica
    # de Atributos PRA MOB especificamente - outras categorias sem
    # campo fixo proprio (Missao, Guia, a maioria dos tipos de Item)
    # continuam usando `attributes` normalmente.
    mob_health: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mob_damage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mob_experience: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mob_range: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mob_respawn_time: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ---- Campos fixos so' de ARMAS (categoria WEAPONS, nao um item_type) ----
    # "Lv. 10" que aparece na ficha do jogo NAO precisa de campo novo -
    # e' o mesmo `level` que toda entry ja tem.
    weapon_speed: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Requisito pra' usar a arma, como texto unico (ex: "23 Strength") -
    # nome do atributo + valor juntos, igual aparece na ficha do jogo,
    # em vez de duas colunas separadas pra' algo que so' e' mostrado
    # junto mesmo.
    weapon_requirement: Mapped[str | None] = mapped_column(String(320), nullable=True)   # ate' 3 requisitos, um por LINHA (separados por \n)
    # Campos novos da ficha de Arma redesenhada (26/09), pra' bater com
    # a ficha do proprio jogo (secoes Requirements/Acquisition/Weapon
    # Details/Battle Data - ver DetailSidebar no front pro layout
    # completo). "Class" da ficha do jogo = rarity (ja existe); "Stat
    # Bonus" = a lista generica de Atributos (ja existe, reaproveitada
    # aqui) - nenhum dos dois precisou de coluna nova.
    weapon_npc: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # NPC da arma LIGADO a uma pagina do wiki (opcional): ligado, o nome mostrado acompanha a pagina e o visitante clica para ir a' ela; sem ligacao vale o texto de `weapon_npc`.
    weapon_npc_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="SET NULL"), nullable=True)
    weapon_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weapon_base_damage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weapon_special_ability: Mapped[str | None] = mapped_column(String(150), nullable=True)
    weapon_knockback_distance: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ---- Campos fixos so' de ITEM tipo CURRENCY ----
    max_stack: Mapped[int | None] = mapped_column(nullable=True)

    # ---- Campo fixo so' de ITEM tipo CAST ----
    # Vila que pode usar o item (ex: Boar Whistle -> "Mist") - FK de
    # verdade pra' villages.id (nao texto solto: ja' temos as vilas
    # reais cadastradas, usar a referencia de verdade evita "Mist"
    # digitado errado nao bater com a Vila da Nevoa de verdade, e abre
    # a porta pra' um link clicavel no futuro, igual fizemos com drops).
    cast_village_id: Mapped[str | None] = mapped_column(
        String(50), ForeignKey("villages.id", ondelete="SET NULL"), nullable=True
    )
    cast_village: Mapped["Village | None"] = relationship(foreign_keys=[cast_village_id])
    # selectin: sempre carregado junto (a ficha le o nome/slug dele; sem isso daria erro de carga preguicosa em contexto async)
    weapon_npc_item: Mapped["ContentItem | None"] = relationship(foreign_keys=[weapon_npc_id], remote_side="ContentItem.id", lazy="selectin", join_depth=1)

    # So' preenchido quando category == MOBS / ITEMS respectivamente.
    # Nao ha' um CHECK constraint aqui garantindo essa regra - fica a
    # cargo da validacao Pydantic na camada da API (Fase 3).
    mob_type: Mapped[MobType | None] = mapped_column(Enum(MobType, name="mob_type"), nullable=True)
    item_type: Mapped[ItemType | None] = mapped_column(Enum(ItemType, name="item_type"), nullable=True)

    # Fluxo editorial do painel admin - toda entry nasce como rascunho.
    status: Mapped[ContentStatus] = mapped_column(
        Enum(ContentStatus, name="content_status"), default=ContentStatus.DRAFT
    )

    # relationship(): NAO cria coluna nenhuma no banco - e' so' um atalho
    # do Python pra acessar `item.attributes` / `item.drops` sem escrever
    # a query manualmente. cascade="all, delete-orphan": apagar um
    # ContentItem apaga junto os attributes/drops dele (nao deixa lixo
    # orfao no banco).
    attributes: Mapped[list["ContentItemAttribute"]] = relationship(
        back_populates="content_item", cascade="all, delete-orphan", order_by="ContentItemAttribute.sort_order"
    )
    # Lista de ataques do Mob (texto livre, ex: "Katon: Bola de Fogo") -
    # so' usado quando category == MOBS. Mesmo padrao de attributes/drops:
    # tabela separada com FK + cascade, nao um array/JSON na propria
    # coluna, pra' poder ordenar e editar linha por linha igual o resto.
    attacks: Mapped[list["ContentItemAttack"]] = relationship(
        back_populates="content_item", cascade="all, delete-orphan", order_by="ContentItemAttack.sort_order"
    )
    # foreign_keys= explicito: ContentItemDrop tem duas FKs pra
    # content_items (a dona do drop, e o item ligado que ela dropa) -
    # sem isso, o SQLAlchemy nao sabe qual das duas usar pra popular
    # ESTA lista (a de "quem sao os drops desta entry").
    drops: Mapped[list["ContentItemDrop"]] = relationship(
        back_populates="content_item", cascade="all, delete-orphan", foreign_keys="ContentItemDrop.content_item_id"
    )


class ContentItemAttribute(Base):
    """
    Uma linha da ficha de atributos (ex: "Health: 45"). Equivalente a
    um item do array `attributes` em WikiEntry.
    """
    __tablename__ = "content_item_attributes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE")
    )
    label: Mapped[str] = mapped_column(String(100))
    # value e' TEXT (nao numero) porque no front AttributeRow.value
    # aceita string OU numero (ex: "3-5" para um dano em faixa) - guardar
    # como texto sempre evita ter duas colunas (uma numerica, uma texto).
    value: Mapped[str] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(default=0)

    content_item: Mapped["ContentItem"] = relationship(back_populates="attributes")


class ContentItemAttack(Base):
    """
    Um ataque/jutsu de um Mob, exibido na secao "Jutsu/Attacks" da
    ficha. Texto livre OU ligado a um Jutsu do catalogo (jutsu_id): ligado, o nome vem do jutsu e o visitante clica para ir a' skill.
    """
    __tablename__ = "content_item_attacks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(150))
    sort_order: Mapped[int] = mapped_column(default=0)
    # Jutsu de verdade do catalogo ligado a este ataque (opcional): a pagina do monstro mostra o nome (ao vivo, nos dois idiomas) e
    # leva para a pagina da skill. Sem jutsu ligado vale o texto livre de `name`. Apagou o jutsu: volta a ser so' texto (SET NULL).
    jutsu_id: Mapped[str | None] = mapped_column(String(80), ForeignKey("jutsus.id", ondelete="SET NULL"), nullable=True)

    content_item: Mapped["ContentItem"] = relationship(back_populates="attacks")
    jutsu = relationship("Jutsu", lazy="selectin")


class ContentItemDrop(Base):
    """
    Um item que pode "dropar" de um mob. Equivalente a um item do
    array `drops` em WikiEntry.

    dropped_item_id: FK NULLABLE pra content_items.id - liga o drop a
    uma entry de verdade do catalogo (ex: a entry do "Broad Sword" em
    Armas), pra' a pagina publica poder linkar direto pra' ela. Fica
    NULL pra drops sem entry cadastrada ainda - `item_name` (texto
    solto) continua sendo o que sempre aparece, o link e' so' um extra
    quando da' pra oferecer.
    """
    __tablename__ = "content_item_drops"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE")
    )
    item_name: Mapped[str] = mapped_column(String(200))
    rarity: Mapped[Rarity] = mapped_column(Enum(Rarity, name="rarity"))
    chance: Mapped[float] = mapped_column(Numeric(5, 2))  # percentual, ex: 25.00
    # Como o `chance` acima deve ser EXIBIDO - ver DropChanceQualifier
    # em app/models/enums.py pra' o porque disso existir. None = mostra
    # o numero exato (comportamento de antes desse campo existir).
    chance_qualifier: Mapped[DropChanceQualifier | None] = mapped_column(
        Enum(DropChanceQualifier, name="drop_chance_qualifier"), nullable=True
    )
    min_qty: Mapped[int | None] = mapped_column(nullable=True)
    max_qty: Mapped[int | None] = mapped_column(nullable=True)
    # ondelete=SET NULL: se o item ligado for apagado, o drop nao
    # quebra nem some - so' volta a ficar como texto solto, igual
    # estava antes de alguem ligar ele a uma entry.
    dropped_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="SET NULL"), nullable=True
    )

    content_item: Mapped["ContentItem"] = relationship(back_populates="drops", foreign_keys=[content_item_id])
    # foreign_keys= explicito aqui: ContentItemDrop agora tem DUAS FKs
    # pra content_items (content_item_id E dropped_item_id) - sem
    # dizer qual e' qual, o SQLAlchemy nao sabe qual coluna usar pra
    # cada relationship e da' erro de ambiguidade na inicializacao.
    dropped_item: Mapped["ContentItem | None"] = relationship(foreign_keys=[dropped_item_id])


class ContentVersion(Base):
    """
    Uma VERSAO ANTERIOR de uma entry (historico para desfazer): antes de cada edicao pelo painel, o estado ate' ali e' guardado
    aqui como JSON (o mesmo formato que a API devolve, camelCase). Restaurar uma versao = aplicar esse JSON de volta pela
    edicao normal (por isso restaurar tambem entra no historico e pode ser desfeito). Mantem so' as ultimas
    MAX_VERSIONS_PER_ITEM de cada entry; apagar a entry apaga as versoes.
    """
    __tablename__ = "content_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE"), index=True
    )
    snapshot: Mapped[dict] = mapped_column(JSONB)
    saved_by: Mapped[str | None] = mapped_column(String(100), nullable=True)   # quem fez a edicao que SUBSTITUIU esta versao
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
