"""
Tabelas de Vilas, Clas e Organizacoes. Espelha lib/village-data.ts.
Mesmo padrao de id=texto explicado em models/masteries.py.
"""
from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Village(Base):
    __tablename__ = "villages"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "leaf"
    name: Mapped[str] = mapped_column(String(100))
    # Mesmo padrao de Content/Mastery/Jutsu: `name` e' o INGLES (principal) e
    # `name_pt` a traducao (antes: name = portugues, english_name = ingles).
    name_pt: Mapped[str | None] = mapped_column(String(100), nullable=True)
    element: Mapped[str] = mapped_column(String(50))
    motto: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    long_description: Mapped[str] = mapped_column(Text)
    emblem: Mapped[str] = mapped_column(String(20))  # emoji
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    accent_color: Mapped[str] = mapped_column(String(20))
    climate: Mapped[str] = mapped_column(String(200))
    leader: Mapped[str] = mapped_column(String(100))
    # Posicao do marcador no Mapa (ver app/(wiki)/(lore)/map no front) -
    # percentual de largura/altura, nao coordenada geografica real.
    map_x: Mapped[float] = mapped_column(Numeric(5, 2), default=50)
    map_y: Mapped[float] = mapped_column(Numeric(5, 2), default=50)

    clans: Mapped[list["Clan"]] = relationship(back_populates="village", cascade="all, delete-orphan")
    organizations: Mapped[list["Organization"]] = relationship(secondary="organization_villages")


class Clan(Base):
    """Escolhido na criacao do personagem - pertence a UMA vila so'."""
    __tablename__ = "clans"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "yagyu"
    name: Mapped[str] = mapped_column(String(100))
    village_id: Mapped[str] = mapped_column(ForeignKey("villages.id", ondelete="CASCADE"))
    description: Mapped[str] = mapped_column(Text)
    # Imagem do cla' (logo + roupa que o cla' usa, tudo numa imagem so'), enviada
    # pelo painel via POST /uploads/image.
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)

    village: Mapped["Village"] = relationship(back_populates="clans")


class Organization(Base):
    """
    Corpo especializado (ANBU, Hunter Nin, etc) - diferente de Clan,
    pode existir em MAIS de uma vila ao mesmo tempo (N:N via
    organization_villages), por isso nao tem village_id direto aqui.
    """
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # ex: "anbu"
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)


class OrganizationVillage(Base):
    """Tabela de associacao N:N entre Organization e Village."""
    __tablename__ = "organization_villages"

    organization_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    village_id: Mapped[str] = mapped_column(ForeignKey("villages.id", ondelete="CASCADE"), primary_key=True)
