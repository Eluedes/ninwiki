"""
Ligacao Discord -> perfil do leitor (vila e rank ninja preenchidos sozinhos a partir dos cargos do servidor).

O BOT so' informa FATOS (servidores onde esta', cargos de cada servidor e os cargos de cada leitor); quem DECIDE vila/rank
e' a API (app/core/discord_profile.py), a partir do mapeamento configurado pelo painel (/admin/discord-links):
  - servidor -> vila (DiscordGuild.village_id);
  - cargo do servidor -> rank ninja (DiscordRole.ninja_rank_id). Sem mapeamento explicito vale o NOME do cargo igual ao do rank.
"""
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DiscordGuild(Base):
    """Servidor do Discord onde o bot esta'. `active` = false quando o bot deixou de informar esse servidor (some das decisoes, mas o mapeamento fica)."""
    __tablename__ = "discord_guilds"

    guild_id: Mapped[str] = mapped_column(String(32), primary_key=True)   # Discord ID sempre texto
    name: Mapped[str] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    member_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")   # membros do servidor, como o bot informou (so' para o painel do bot)
    village_id: Mapped[str | None] = mapped_column(ForeignKey("villages.id", ondelete="SET NULL", name="fk_discord_guilds_village_id"), nullable=True)
    members_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)   # fim da ultima sincronizacao COMPLETA da lista de membros (None = nunca)
    members_partial: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")   # true = passou do teto: so' os primeiros membros foram guardados
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


class DiscordGuildMember(Base):
    """Membro de um servidor, como o bot informou (so' para o painel do bot; so' quem tem discord.links ve').
    Privacidade: guarda SO' ID, nome de usuario, nome de exibicao, se e' bot, data de entrada e IDs de cargos - nada de e-mail nem mensagens."""
    __tablename__ = "discord_guild_members"

    guild_id: Mapped[str] = mapped_column(ForeignKey("discord_guilds.guild_id", ondelete="CASCADE", name="fk_discord_guild_members_guild_id"), primary_key=True)
    discord_id: Mapped[str] = mapped_column(String(32), primary_key=True)   # Discord ID sempre texto
    username: Mapped[str] = mapped_column(String(100), default="", server_default="")
    display_name: Mapped[str] = mapped_column(String(100), default="", server_default="")
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    roles: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")   # IDs (texto) dos cargos; o nome vem de discord_roles
    sync_token: Mapped[str] = mapped_column(String(40), default="", server_default="")   # carimbo da sincronizacao que viu o membro (carimbo velho no fim = saiu)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
