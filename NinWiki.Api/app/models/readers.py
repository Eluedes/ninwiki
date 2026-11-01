"""
Leitores do site (quem comenta e curte posts) - SEPARADOS da equipe (tabela users) de proposito.

Um leitor entra com o Discord (so' pra provar quem e'; ter conta aqui NAO da' acesso nenhum ao painel) e pode comentar e
curtir posts do blog. A equipe modera: esconde/apaga comentarios e bane leitores (banned).
"""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Reader(Base):
    """Um leitor logado com o Discord (comenta e curte)."""
    __tablename__ = "readers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discord_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Banido: nao consegue mais entrar, comentar nem curtir (a sessao cai na hora - e' conferido a cada requisicao).
    banned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Perfil publico: nome no jogo (editavel pelo proprio leitor); vila e rank vem do Discord via bot (app/core/discord_profile.py). Nunca guarda dado privado.
    game_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    village_id: Mapped[str | None] = mapped_column(ForeignKey("villages.id", ondelete="SET NULL"), nullable=True)
    ninja_rank_id: Mapped[str | None] = mapped_column(ForeignKey("ninja_ranks.id", ondelete="SET NULL"), nullable=True)
    # De onde vieram vila e rank: "discord:<id do servidor>" (cargo lido pelo bot) ou "default" (padrao Takumi/Rogue). Ninguem edita a mao.
    profile_source: Mapped[str | None] = mapped_column(String(64), nullable=True)


class PostComment(Base):
    """Comentario de um leitor num post. Texto simples (nunca HTML). `hidden` = escondido pela moderacao (some pro publico)."""
    __tablename__ = "post_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    reader_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("readers.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    hidden_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    reader: Mapped[Reader] = relationship(lazy="joined")


class PostLike(Base):
    """Curtida: UM leitor curte UM post uma vez (chave composta impede duplicar)."""
    __tablename__ = "post_likes"

    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    reader_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("readers.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
