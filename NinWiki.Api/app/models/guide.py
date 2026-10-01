"""
Tabelas exclusivas da secao Guia: Profissoes, Ranks Ninja, Story Arcs
e Summons. Espelha lib/guide-data.ts. Mesmo padrao de id=texto
explicado em models/masteries.py.
"""
from sqlalchemy import Enum, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import ProfessionGroup


class Profession(Base):
    """Profissao do jogo (aba do Guia)."""
    __tablename__ = "professions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "mining"
    name: Mapped[str] = mapped_column(String(100))
    # Mesmo padrao de Content/Mastery/Jutsu: `name` e' o INGLES (principal) e
    # `name_pt` a traducao (antes: name = portugues, english_name = ingles).
    name_pt: Mapped[str | None] = mapped_column(String(100), nullable=True)
    group: Mapped[ProfessionGroup] = mapped_column(Enum(ProfessionGroup, name="profession_group"))
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(20))  # emoji


class NinjaRank(Base):
    """Rank ninja (Genin ate' Kage) - aba do Guia."""
    __tablename__ = "ninja_ranks"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "genin"
    name: Mapped[str] = mapped_column(String(100))
    # Mesmo padrao de Content/Mastery/Jutsu: `name` e' o INGLES (principal) e
    # `name_pt` a traducao (antes: name = portugues, english_name = ingles).
    name_pt: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order: Mapped[int] = mapped_column(Integer)  # posicao na hierarquia, 1 = mais baixo
    description: Mapped[str] = mapped_column(Text)


class StoryArc(Base):
    """Arco de historia do jogo - aba do Guia."""
    __tablename__ = "story_arcs"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    level_range: Mapped[str] = mapped_column(String(20))  # ex: "60-70"
    description: Mapped[str] = mapped_column(Text)


class Summon(Base):
    """Invocacao (summon) do jogo - aba do Guia."""
    __tablename__ = "summons"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "toad"
    name: Mapped[str] = mapped_column(String(100))
    # Mesmo padrao de Content/Mastery/Jutsu: `name` e' o INGLES (principal) e
    # `name_pt` a traducao (antes: name = portugues, english_name = ingles).
    name_pt: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village: Mapped[str] = mapped_column(String(100))  # texto livre, ex: "Vila da Folha" ou "Universal"
    # Os 3 estagios (Jovem/Adolescente/Adulta) - colunas separadas em vez
    # de um array, porque sao SEMPRE exatamente 3 (mesma regra do
    # `stages: [string, string, string]` no front) e cada um tem um
    # significado fixo, nao uma lista de tamanho variavel.
    stage_young: Mapped[str] = mapped_column(Text)
    stage_teen: Mapped[str] = mapped_column(Text)
    stage_adult: Mapped[str] = mapped_column(Text)
