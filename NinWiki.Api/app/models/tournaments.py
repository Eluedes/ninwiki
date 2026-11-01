"""
Torneios (estilo Challonge, focados no Nin Online): criados e administrados por LEITORES logados com o Discord (o organizador);
a equipe so' modera (esconder/apagar). Estrutura:

  Tournament  1-N  TournamentEntry   (inscritos: leitor logado ou "convidado" so' com nome)
  Tournament  1-N  TournamentPhase   (fases: cada uma com tamanho de equipe e formato de chave)
  Phase       1-N  TournamentCompetitor (quem disputa a fase: 1 pessoa ou uma equipe) N-N Entry (TournamentTeamMember)
  Phase       1-N  TournamentMatch   (partidas; a posicao na chave vem de round/slot, ver app/core/brackets.py)
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TournamentStatus(str, enum.Enum):
    """Andamento do torneio (no banco os rotulos ficam em MAIUSCULAS: DRAFT, OPEN...)."""
    DRAFT = "draft"          # rascunho: so' o organizador ve'
    OPEN = "open"            # inscricoes abertas
    RUNNING = "running"      # em andamento (inscricoes fechadas)
    FINISHED = "finished"    # encerrado


class TournamentVisibility(str, enum.Enum):
    """Publico (aparece na lista) ou nao listado (so' quem tem o link)."""
    PUBLIC = "public"
    UNLISTED = "unlisted"


class PhaseFormat(str, enum.Enum):
    """Formato da chave de uma fase."""
    SINGLE_ELIMINATION = "single_elimination"
    ROUND_ROBIN = "round_robin"


class PhaseStatus(str, enum.Enum):
    """Fase em montagem (sem chave), em andamento ou concluida."""
    SETUP = "setup"
    RUNNING = "running"
    FINISHED = "finished"


class Tournament(Base):
    """Um torneio. `hidden` = escondido pela moderacao (some do publico; o organizador ainda ve' e nao consegue editar)."""
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("readers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")   # texto simples
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)   # data prevista (opcional)
    status: Mapped[TournamentStatus] = mapped_column(
        Enum(TournamentStatus, name="tournament_status"), default=TournamentStatus.DRAFT, server_default="DRAFT", index=True)
    visibility: Mapped[TournamentVisibility] = mapped_column(
        Enum(TournamentVisibility, name="tournament_visibility"), default=TournamentVisibility.PUBLIC, server_default="PUBLIC")
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    hidden_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Oculto pelo ORGANIZADOR (ainda esta' arrumando): so' ele ve'. Independe do `hidden` da moderacao, que o organizador nao desfaz.
    organizer_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    champion_name: Mapped[str | None] = mapped_column(String(120), nullable=True)   # preenchido ao encerrar
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TournamentEntry(Base):
    """Um inscrito. `reader_id` vazio = convidado (o organizador digitou so' o nome). `placement` so' existe depois de encerrar."""
    __tablename__ = "tournament_entries"
    __table_args__ = (UniqueConstraint("tournament_id", "reader_id", name="uq_tournament_entry_reader"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tournaments.id", ondelete="CASCADE"), index=True)
    reader_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("readers.id", ondelete="SET NULL"), nullable=True, index=True)
    display_name: Mapped[str] = mapped_column(String(60))   # nome no jogo (ou Discord) na hora da inscricao
    seed: Mapped[int] = mapped_column(Integer, default=0)   # ordem de semente (0 = primeiro)
    placement: Mapped[int | None] = mapped_column(Integer, nullable=True)   # 1 = campeao
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TournamentPhase(Base):
    """Uma fase: tamanho da equipe (1 = 1v1, 2 = 2v2, 3 = 3v3... ate' 10) e formato da chave."""
    __tablename__ = "tournament_phases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tournaments.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)   # 1, 2, 3...
    name: Mapped[str] = mapped_column(String(60))
    team_size: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    format: Mapped[PhaseFormat] = mapped_column(
        Enum(PhaseFormat, name="tournament_phase_format"), default=PhaseFormat.SINGLE_ELIMINATION, server_default="SINGLE_ELIMINATION")
    status: Mapped[PhaseStatus] = mapped_column(
        Enum(PhaseStatus, name="tournament_phase_status"), default=PhaseStatus.SETUP, server_default="SETUP")


class TournamentCompetitor(Base):
    """Quem disputa uma fase: uma pessoa (team_size 1) ou uma equipe. `seed` 1..n define o lugar na chave."""
    __tablename__ = "tournament_competitors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phase_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tournament_phases.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    seed: Mapped[int] = mapped_column(Integer)


class TournamentTeamMember(Base):
    """Integrante (inscrito) de um competidor."""
    __tablename__ = "tournament_team_members"

    competitor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tournament_competitors.id", ondelete="CASCADE"), primary_key=True)
    entry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tournament_entries.id", ondelete="CASCADE"), primary_key=True)


class TournamentMatch(Base):
    """
    Uma partida. Eliminatoria: o vencedor de (round, slot) vai para o lado a/b de (round+1, slot // 2). `done` = resultado lancado
    (ou folga ja' resolvida). Todos-contra-todos: `winner_id` vazio com `done` = empate.
    """
    __tablename__ = "tournament_matches"
    __table_args__ = (UniqueConstraint("phase_id", "round", "slot", name="uq_tournament_match_pos"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phase_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tournament_phases.id", ondelete="CASCADE"), index=True)
    round: Mapped[int] = mapped_column(Integer)
    slot: Mapped[int] = mapped_column(Integer)
    competitor_a_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tournament_competitors.id", ondelete="SET NULL"), nullable=True)
    competitor_b_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tournament_competitors.id", ondelete="SET NULL"), nullable=True)
    score_a: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score_b: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tournament_competitors.id", ondelete="SET NULL"), nullable=True)
    done: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
