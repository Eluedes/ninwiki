"""
Ligacao Discord -> perfil do leitor (vila e rank ninja preenchidos sozinhos a partir dos cargos do servidor).

O BOT so' informa FATOS (servidores onde esta', cargos de cada servidor e os cargos de cada leitor); quem DECIDE vila/rank
e' a API (app/core/discord_profile.py), a partir do mapeamento configurado pelo painel (/admin/discord-links):
  - servidor -> vila (DiscordGuild.village_id);
  - cargo do servidor -> rank ninja (DiscordRole.ninja_rank_id). Sem mapeamento explicito vale o NOME do cargo igual ao do rank.
"""
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DiscordGuild(Base):
    """Servidor do Discord onde o bot esta'. `active` = false quando o bot deixou de informar esse servidor (some das decisoes, mas o mapeamento fica)."""
    __tablename__ = "discord_guilds"

    guild_id: Mapped[str] = mapped_column(String(32), primary_key=True)   # Discord ID sempre texto
    name: Mapped[str] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    village_id: Mapped[str | None] = mapped_column(ForeignKey("villages.id", ondelete="SET NULL", name="fk_discord_guilds_village_id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DiscordRole(Base):
    """Cargo de um servidor (informado pelo bot) e, se a equipe quiser, o rank ninja que ele representa."""
    __tablename__ = "discord_roles"

    guild_id: Mapped[str] = mapped_column(ForeignKey("discord_guilds.guild_id", ondelete="CASCADE", name="fk_discord_roles_guild_id"), primary_key=True)
    role_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    ninja_rank_id: Mapped[str | None] = mapped_column(ForeignKey("ninja_ranks.id", ondelete="SET NULL", name="fk_discord_roles_ninja_rank_id"), nullable=True)


class DiscordMemberRoles(Base):
    """Cargos (lista de {id, name}) que UM leitor tem num servidor, como o bot informou. Saiu do servidor / perdeu tudo = a linha e' apagada."""
    __tablename__ = "discord_member_roles"

    discord_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    guild_id: Mapped[str] = mapped_column(ForeignKey("discord_guilds.guild_id", ondelete="CASCADE", name="fk_discord_member_roles_guild_id"), primary_key=True, index=True)
    roles: Mapped[list] = mapped_column(JSONB, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
