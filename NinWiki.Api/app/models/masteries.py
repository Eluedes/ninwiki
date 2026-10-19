"""
Tabelas de Masteries, Atributos, Caminhos de Mastery e Jutsus. Espelha
lib/masteries-data.ts do front.

Aqui, diferente de content_items, o `id` das tabelas pequenas e
curadas (masteries, atributos, caminhos) e' TEXTO (o proprio slug, ex:
"fire", "taijutsu-agility") em vez de UUID. Motivo: sao poucas linhas,
escolhidas a dedo pela equipe (nao criadas em volume por usuarios), e
um id legivel facilita ler o banco direto no Adminer sem precisar
decorar UUIDs. jutsus continua com esse padrao tambem, pelo mesmo motivo.
"""
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ContentStatus, MasteryType


class Attribute(Base):
    """Um atributo do personagem (Forca, Agilidade, etc)."""
    __tablename__ = "attributes"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "strength"
    # Mesmo padrao de Mastery/Jutsu (name=ingles principal, name_pt=
    # traducao) - unificado em 27/09 depois que uma migracao externa
    # (rodada com outra ferramenta de IA, fora deste chat) ja' tinha
    # apagado a coluna english_name do banco real do Rafael sem
    # renomear pra name/name_pt direito - ver a migracao
    # 3d246e008370 (dela) e a que vem logo depois dela aqui (nossa,
    # de correcao) pro historico completo dessa reconciliacao.
    name: Mapped[str] = mapped_column(String(100))
    name_pt: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    description_pt: Mapped[str | None] = mapped_column(Text, nullable=True)  # traducao (DeepL)
    icon: Mapped[str] = mapped_column(String(50))


class Mastery(Base):
    """Uma das masteries fixas do jogo (nome, tipo, cor, imagem, caminhos)."""
    __tablename__ = "masteries"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "fire"
    # Rafael pediu (28/09) pra' Mastery/Jutsu seguirem o MESMO padrao
    # do Conteudo: um so' campo "name" (ingles, principal) + a
    # traducao dentro da secao propria (name_pt) - nao mais um campo
    # "English name" fixo e separado no formulario principal. name_pt
    # substitui o que era `name` (portugues) antes dessa mudanca; o
    # que era `english_name` virou o novo `name` (renomeado via
    # migracao, nao apagado - ver alembic pra' essa troca).
    name: Mapped[str] = mapped_column(String(100))
    name_pt: Mapped[str | None] = mapped_column(String(100), nullable=True)
    type: Mapped[MasteryType] = mapped_column(Enum(MasteryType, name="mastery_type"))
    element: Mapped[str] = mapped_column(String(50))  # nome japones, ex: "Katon"
    description: Mapped[str] = mapped_column(Text)
    long_description: Mapped[str] = mapped_column(Text)
    # Traducao automatica via DeepL (mesmo padrao/motivo de content_items -
    # ver app/core/translation.py), EN->PT.
    description_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    long_description_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(20))  # hex, ex: "#ef4444"
    # Imagem oficial do seletor de mastery do jogo (ex: ElementSelect_Fire.png).
    # Nullable pelo mesmo motivo de ContentItem.image: o front cai pro
    # `icon` como fallback quando vazio.
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Adicionado esta linha gif: no dia 27/09/2026 as 22:56
    gif: Mapped[str | None] = mapped_column(String(500), nullable=True)

    paths: Mapped[list["MasteryPath"]] = relationship(back_populates="mastery", cascade="all, delete-orphan")
    jutsus: Mapped[list["Jutsu"]] = relationship(back_populates="mastery", cascade="all, delete-orphan")
    # secondary=: tabela de associacao pura (so' duas FKs, sem coluna
    # propria) para o relacionamento N:N mastery <-> attributes.
    attributes: Mapped[list["Attribute"]] = relationship(secondary="mastery_attributes")


class MasteryAttribute(Base):
    """
    Tabela de associacao pura (N:N) entre Mastery e Attribute -
    equivalente ao array `attributes: AttributeId[]` dentro de Mastery
    no front. Sem coluna extra alem das duas FKs, entao nao precisa de
    um `id` proprio - a chave primaria composta (as duas FKs juntas)
    ja' garante que o mesmo par nao se repete.
    """
    __tablename__ = "mastery_attributes"

    mastery_id: Mapped[str] = mapped_column(ForeignKey("masteries.id", ondelete="CASCADE"), primary_key=True)
    attribute_id: Mapped[str] = mapped_column(ForeignKey("attributes.id", ondelete="CASCADE"), primary_key=True)


class MasteryPath(Base):
    """
    Um sub-caminho de uma mastery (ex: Fan-Leque dentro de Vento).
    Estrutura real confirmada em lib/masteries-data.ts: usa `label`
    (nao `name`/`englishName` como os outros modelos) e tem sua propria
    lista de atributos relacionados, igual a Mastery.
    """
    __tablename__ = "mastery_paths"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)  # ex: "wind-fan-leque"
    mastery_id: Mapped[str] = mapped_column(ForeignKey("masteries.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    # Opcional: requisito extra pra desbloquear o caminho (ex: "Nivel 50").
    requirement: Mapped[str | None] = mapped_column(String(200), nullable=True)

    mastery: Mapped["Mastery"] = relationship(back_populates="paths")
    jutsus: Mapped[list["Jutsu"]] = relationship(back_populates="path")
    attributes: Mapped[list["Attribute"]] = relationship(secondary="mastery_path_attributes")


class MasteryPathAttribute(Base):
    """Tabela de associacao N:N entre MasteryPath e Attribute (mesmo padrao de MasteryAttribute)."""
    __tablename__ = "mastery_path_attributes"

    path_id: Mapped[str] = mapped_column(ForeignKey("mastery_paths.id", ondelete="CASCADE"), primary_key=True)
    attribute_id: Mapped[str] = mapped_column(ForeignKey("attributes.id", ondelete="CASCADE"), primary_key=True)


class Jutsu(Base):
    """Um jutsu, ligado a uma mastery e a um caminho dela."""
    __tablename__ = "jutsus"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)  # ex: "katon-goukakyuu"
    name: Mapped[str] = mapped_column(String(150))
    name_pt: Mapped[str | None] = mapped_column(String(150), nullable=True)
    # Nullable = jutsu de UTILIDADE (categoria "Utility"): nao pertence a nenhuma mastery, qualquer pessoa pode usar.
    mastery_id: Mapped[str | None] = mapped_column(ForeignKey("masteries.id", ondelete="CASCADE"), nullable=True)
    # Nullable: nem toda mastery tem caminhos (ver MAESTRIAS.md/comentarios
    # do front) - um jutsu de uma mastery SEM caminhos deixa isso vazio.
    path_id: Mapped[str | None] = mapped_column(ForeignKey("mastery_paths.id", ondelete="SET NULL"), nullable=True)
    tier: Mapped[int]  # 1 a 5 (maximo 5)
    chakra_cost: Mapped[int]
    description: Mapped[str] = mapped_column(Text)
    long_description: Mapped[str] = mapped_column(Text)
    # Mesmo padrao/motivo de Mastery.description_pt logo acima.
    description_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    long_description_pt: Mapped[str | None] = mapped_column(Text, nullable=True)
    effect: Mapped[str] = mapped_column(String(200))           # "Special Effect" na ficha
    range: Mapped[str] = mapped_column(String(100))
    cast_time: Mapped[str] = mapped_column(String(100))
    cooldown: Mapped[str] = mapped_column(String(100))         # texto unico; se cooldown_by_level existir, a ficha mostra ele
    # ---- Ficha do jutsu (secoes Requirements / Acquisition / Technique Details / Battle Data) ----
    # Texto vazio = a linha nao aparece na pagina. Valores em ingles (termos do jogo), como effect/range.
    required_level: Mapped[str] = mapped_column(String(50), default="", server_default="")     # nivel exigido (texto livre)
    required_stat: Mapped[str] = mapped_column(String(100), default="", server_default="")     # requisito de atributo (texto livre)
    scroll_type: Mapped[str] = mapped_column(String(100), default="", server_default="")       # tipo de pergaminho (a ficha junta o numero romano do tier)
    shop: Mapped[str] = mapped_column(String(100), default="", server_default="")              # onde comprar (texto livre)
    max_level: Mapped[int] = mapped_column(Integer, default=1, server_default="1")             # nivel maximo do jutsu (1-10)
    damage_by_level: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")    # um valor de dano por nivel
    cooldown_by_level: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")  # um valor de recarga por nivel
    name_by_level_pt: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")   # traducao (DeepL) do nome por nivel, mesma ordem de name_by_level
    name_by_level: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")      # nome do jutsu em cada nivel (vazio = igual ao nome principal; ex.: muda no nivel 4)
    cast_type: Mapped[str] = mapped_column(String(100), default="", server_default="")         # tipo de conjuracao (texto livre)
    jutsu_class: Mapped[str] = mapped_column(String(100), default="", server_default="")       # classe do jutsu (texto livre)
    debuff: Mapped[str] = mapped_column(String(150), default="", server_default="")            # debuff aplicado (texto livre)
    # Jutsu NPC: a versao do jutsu ensinada/usada por NPC (mesmo nome do jutsu de mastery ou de Utilidade, mas com detalhes um pouco diferentes). Fica numa secao propria no site.
    is_npc: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Rascunho (so' a equipe ve) ou publicado. Os jutsus criados em massa a partir da lista do jogo nascem como rascunho.
    status: Mapped[ContentStatus] = mapped_column(Enum(ContentStatus, name="content_status", create_type=False),
                                                  default=ContentStatus.PUBLISHED, server_default="PUBLISHED")
    allowed_weapons: Mapped[str] = mapped_column(String(100), default="", server_default="")   # "Allowed weapons" da ficha (ex.: Blunt) - texto livre
    icon: Mapped[str] = mapped_column(String(50))
    # Demonstracao em GIF, opcional - ver components/lore/jutsu-gif.tsx
    # no front, que ja trata o caso desse arquivo nao existir ainda.
    gif: Mapped[str | None] = mapped_column(String(500), nullable=True)

    mastery: Mapped["Mastery"] = relationship(back_populates="jutsus")
    path: Mapped["MasteryPath | None"] = relationship(back_populates="jutsus")
