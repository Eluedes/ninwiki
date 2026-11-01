"""Schemas de torneios e perfis de jogadores (entrada do organizador e leitura publica). JSON em camelCase."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from app.models.tournaments import PhaseFormat, PhaseStatus, TournamentStatus, TournamentVisibility
from app.schemas.content import CamelModel

MAX_TEAM_SIZE = 10


def _plain(v: str, keep_newlines: bool = False) -> str:
    """Texto simples: tira caracteres de controle (e quebra de linha, a menos que permitida) e espacos nas pontas."""
    return "".join(ch for ch in v if (keep_newlines and ch == "\n") or ch.isprintable()).strip()


class PlayerRef(CamelModel):
    """Dono do torneio / dono do perfil, so' com dados publicos (nunca o Discord ID)."""
    id: uuid.UUID
    username: str
    avatar_url: str | None
    game_name: str | None


# ---------------- entrada ----------------

class TournamentWrite(CamelModel):
    """Criar torneio."""
    name: str = Field(min_length=3, max_length=80)
    description: str = Field(default="", max_length=2000)
    starts_at: datetime | None = None
    visibility: TournamentVisibility = TournamentVisibility.PUBLIC

    @field_validator("name", mode="after")
    @classmethod
    def _name(cls, v: str) -> str:
        """Nome limpo e com pelo menos 3 caracteres de verdade."""
        v = _plain(v)
        if len(v) < 3:
            raise ValueError("Name too short")
        return v

    @field_validator("description", mode="after")
    @classmethod
    def _desc(cls, v: str) -> str:
        """Descricao em texto simples (mantem quebras de linha)."""
        return _plain(v, keep_newlines=True)


class TournamentPatch(CamelModel):
    """Editar torneio (so' o que vier muda). `status`: o organizador alterna rascunho/inscricoes abertas/em andamento; encerrar e' pela rota propria."""
    name: str | None = Field(default=None, min_length=3, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    starts_at: datetime | None = None
    clear_starts_at: bool = False
    visibility: TournamentVisibility | None = None
    status: Literal["draft", "open", "running"] | None = None

    @field_validator("name", mode="after")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        """Nome limpo."""
        if v is None:
            return v
        v = _plain(v)
        if len(v) < 3:
            raise ValueError("Name too short")
        return v

    @field_validator("description", mode="after")
    @classmethod
    def _desc(cls, v: str | None) -> str | None:
        """Descricao em texto simples."""
        return None if v is None else _plain(v, keep_newlines=True)


class GuestWrite(CamelModel):
    """Inscrever um participante 'sem conta' (so' o nome)."""
    display_name: str = Field(min_length=1, max_length=60)

    @field_validator("display_name", mode="after")
    @classmethod
    def _name(cls, v: str) -> str:
        """Nome limpo, nao vazio."""
        v = _plain(v)
        if not v:
            raise ValueError("Required")
        return v


class EntryOrder(CamelModel):
    """Nova ordem de sementes: todos os ids dos inscritos, do cabeca 1 para o ultimo."""
    ids: list[uuid.UUID] = Field(max_length=256)


class PhaseWrite(CamelModel):
    """Criar/editar fase. team_size: 1 (1v1), 2 (2v2), 3 (3v3) ou qualquer valor ate' 10 (custom)."""
    name: str = Field(min_length=1, max_length=60)
    team_size: int = Field(default=1, ge=1, le=MAX_TEAM_SIZE)
    format: PhaseFormat = PhaseFormat.SINGLE_ELIMINATION

    @field_validator("name", mode="after")
    @classmethod
    def _name(cls, v: str) -> str:
        """Nome limpo, nao vazio."""
        v = _plain(v)
        if not v:
            raise ValueError("Required")
        return v


class CompetitorWrite(CamelModel):
    """Um competidor da fase: integrantes (ids de inscritos; exatamente team_size) e nome opcional da equipe."""
    name: str | None = Field(default=None, max_length=60)
    entry_ids: list[uuid.UUID] = Field(min_length=1, max_length=MAX_TEAM_SIZE)


class PhaseStart(CamelModel):
    """Monta a chave da fase com estes competidores, NA ORDEM de semente (o primeiro e' o cabeca 1)."""
    competitors: list[CompetitorWrite] = Field(min_length=2, max_length=256)


class ResultWrite(CamelModel):
    """Lancar/corrigir o resultado: placar dos dois lados e/ou o vencedor ('a' ou 'b')."""
    score_a: int | None = Field(default=None, ge=0, le=999)
    score_b: int | None = Field(default=None, ge=0, le=999)
    winner: Literal["a", "b"] | None = None


class ProfileWrite(CamelModel):
    """Perfil do proprio leitor. Campo vazio = limpa."""
    game_name: str | None = Field(default=None, max_length=40)
    village_id: str | None = Field(default=None, max_length=50)
    ninja_rank_id: str | None = Field(default=None, max_length=50)

    @field_validator("game_name", mode="after")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        """Nome no jogo limpo (vazio vira None)."""
        v = _plain(v or "")
        return v or None

    @field_validator("village_id", "ninja_rank_id", mode="after")
    @classmethod
    def _blank(cls, v: str | None) -> str | None:
        """Texto vazio vira None."""
        return (v or "").strip() or None


class ModerationPatch(CamelModel):
    """Moderacao da equipe: esconder/mostrar e/ou corrigir nome/descricao ofensivos."""
    hidden: bool | None = None
    name: str | None = Field(default=None, min_length=3, max_length=80)
    description: str | None = Field(default=None, max_length=2000)


# ---------------- saida ----------------

class EntryRead(CamelModel):
    """Um inscrito (reader_id leva ao perfil publico; vazio = convidado)."""
    id: uuid.UUID
    display_name: str
    seed: int
    reader_id: uuid.UUID | None
    avatar_url: str | None
    village_id: str | None
    ninja_rank_id: str | None
    placement: int | None


class CompetitorRead(CamelModel):
    """Um competidor da fase e os ids dos inscritos que o formam."""
    id: uuid.UUID
    name: str
    seed: int
    entry_ids: list[uuid.UUID]


class MatchRead(CamelModel):
    """Uma partida da chave."""
    id: uuid.UUID
    round: int
    slot: int
    competitor_a_id: uuid.UUID | None
    competitor_b_id: uuid.UUID | None
    score_a: int | None
    score_b: int | None
    winner_id: uuid.UUID | None
    done: bool


class StandingRead(CamelModel):
    """Linha da tabela do todos-contra-todos."""
    competitor_id: uuid.UUID
    played: int
    wins: int
    draws: int
    losses: int
    points_for: int
    points_against: int
    points: int


class PhaseRead(CamelModel):
    """Uma fase com seus competidores e partidas (suggested_entry_ids so' vai para o organizador, em fases ainda sem chave)."""
    id: uuid.UUID
    position: int
    name: str
    team_size: int
    format: PhaseFormat
    status: PhaseStatus
    competitors: list[CompetitorRead]
    matches: list[MatchRead]
    standings: list[StandingRead] | None = None
    suggested_entry_ids: list[uuid.UUID] | None = None


class TournamentSummary(CamelModel):
    """Cartao da lista."""
    id: uuid.UUID
    name: str
    status: TournamentStatus
    visibility: TournamentVisibility
    starts_at: datetime | None
    created_at: datetime
    champion_name: str | None
    hidden: bool
    owner: PlayerRef
    entry_count: int
    phase_count: int


class TournamentList(CamelModel):
    """Pagina da lista."""
    items: list[TournamentSummary]
    total: int


class TournamentDetail(TournamentSummary):
    """Pagina completa do torneio, ja' com o que o visitante/organizador logado pode fazer."""
    description: str
    is_organizer: bool
    my_entry_id: uuid.UUID | None
    entries: list[EntryRead]
    phases: list[PhaseRead]


class VillageRef(CamelModel):
    """Vila/rank do perfil nos dois idiomas (o site escolhe)."""
    id: str
    name: str
    name_pt: str | None


class HistoryItem(CamelModel):
    """Uma participacao no historico do perfil."""
    tournament_id: uuid.UUID
    name: str
    status: TournamentStatus
    placement: int | None
    wins: int
    losses: int
    date: datetime


class PlayerStats(CamelModel):
    """Totais do perfil (so' torneios publicos, ja' iniciados, nao escondidos)."""
    tournaments: int
    wins: int
    losses: int
    titles: int


class PlayerProfile(CamelModel):
    """Perfil publico de um jogador."""
    id: uuid.UUID
    username: str
    avatar_url: str | None
    game_name: str | None
    village: VillageRef | None
    ninja_rank: VillageRef | None
    stats: PlayerStats
    history: list[HistoryItem]
    trophies: list[HistoryItem]


class ModerationRow(CamelModel):
    """Linha da lista do painel (/admin/tournaments)."""
    id: uuid.UUID
    name: str
    status: TournamentStatus
    visibility: TournamentVisibility
    hidden: bool
    hidden_by: str | None
    created_at: datetime
    owner_id: uuid.UUID
    owner_name: str
    owner_banned: bool
    entry_count: int
