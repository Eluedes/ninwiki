"""
Torneios (estilo Challonge) e perfis de jogadores.

Quem faz o que:
  - VISITANTE sem login so' LE (lista, torneio, perfil). Torneio em rascunho, oculto pelo organizador (`organizerHidden`, o padrao ao criar) ou escondido pela equipe: 404 (so' o organizador ve').
  - LEITOR logado com o Discord (cookie proprio, ver app/core/reader_auth.py) cria torneio e e' o ORGANIZADOR do que criou:
    so' ele edita, abre/fecha inscricao, monta fases/chaves, lanca placar e encerra (outro leitor recebe 403).
  - EQUIPE so' MODERA (permissao tournaments.manage): esconde, apaga e corrige nome/descricao. Nao joga nem lanca placar.

Publico/leitor (prefixo /tournaments):
  GET    /tournaments                              lista publica (status, busca q, mine=true = os meus) + paginacao
  GET    /tournaments/{id}                         torneio completo (inscritos, fases, chaves)
  POST   /tournaments                              cria (limites por dia / ativos por pessoa)
  PATCH  /tournaments/{id}  DELETE /tournaments/{id}
  POST|DELETE /tournaments/{id}/join               o proprio leitor entra / sai (so' com inscricoes abertas)
  POST   /tournaments/{id}/entries                 organizador inscreve participante "sem conta" (so' nome)
  POST   /tournaments/{id}/entries/bulk            organizador importa uma lista de nomes de uma vez (duplicados/invalidos voltam em `skipped`)
  DELETE /tournaments/{id}/entries/{entry_id}      organizador remove inscrito
  PUT    /tournaments/{id}/entries/order           organizador reordena as sementes
  POST   /tournaments/{id}/phases                  cria fase;  PATCH|DELETE .../phases/{pid} (so' fase ainda sem chave)
  POST   /tournaments/{id}/phases/{pid}/start      monta os competidores e gera a chave
  POST   /tournaments/{id}/phases/{pid}/reset      desfaz a chave (so' se nenhuma partida real foi jogada)
  POST   /tournaments/{id}/phases/{pid}/finish     conclui a fase;  .../reopen reabre (se a proxima ainda nao comecou)
  PUT    /tournaments/{id}/matches/{mid}/result    lanca ou corrige o placar
  POST   /tournaments/{id}/finish                  encerra (define campeao e colocacoes);  /reopen reabre
Perfil (prefixo /players): GET /players/me, PUT /players/me (so' o proprio; so' o nome no jogo - vila e rank vem do Discord), GET /players/{id} (publico).
Equipe (prefixo /tournaments-moderation, permissao tournaments.manage): lista, PATCH (esconder / corrigir texto), DELETE.

REGRA DE CORRECAO DE PLACAR (decisao): corrigir uma partida cujo VENCEDOR muda e que ja' alimentou a proxima partida JA' JOGADA e'
RECUSADO (409): o organizador corrige primeiro a partida seguinte. Se a seguinte ainda nao foi jogada, o novo vencedor a substitui sozinho.

Defesas: origem/CSRF conferida em todo metodo que grava (get_optional_reader), limite de escritas por minuto por leitor, no maximo
MAX_CREATED_PER_DAY torneios criados por dia e MAX_ACTIVE_PER_READER ativos por pessoa, MAX_ENTRIES inscritos e MAX_PHASES fases por
torneio, textos curtos e em texto simples (o site os mostra escapados).
"""
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import brackets
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.rate_limit import limiter, retry_message
from app.core.reader_auth import get_current_reader, get_optional_reader
from app.core.text import escape_like
from app.models.discord_links import DiscordGuild
from app.models.guide import NinjaRank
from app.models.readers import Reader
from app.models.tournaments import (
    PhaseFormat, PhaseStatus, Tournament, TournamentCompetitor, TournamentEntry, TournamentMatch, TournamentPhase,
    TournamentStatus, TournamentTeamMember, TournamentVisibility,
)
from app.models.users import User
from app.models.villages import Village
from app.schemas.tournaments import (
    BulkEntriesResult, BulkEntriesWrite, BulkSkipped, BulkTeam, CompetitorRead, EntryOrder, EntryRead, GuestWrite, HistoryItem, MatchRead, ModerationPatch, ModerationRow, PhaseRead, PhaseStart,
    PhaseWrite, PlayerProfile, PlayerRef, PlayerStats, ProfileSource, ProfileWrite, ResultWrite, StandingRead, TournamentDetail, TournamentList,
    TournamentPatch, TournamentSummary, TournamentWrite, VillageRef,
)

router = APIRouter(prefix="/tournaments", tags=["tournaments"])
players_router = APIRouter(prefix="/players", tags=["players"])
moderation_router = APIRouter(prefix="/tournaments-moderation", tags=["tournaments-moderation"])

# Limites anti-abuso (ajuste aqui).
MAX_CREATED_PER_DAY = 5        # torneios que UMA pessoa pode criar a cada 24 h
MAX_ACTIVE_PER_READER = 10     # torneios nao encerrados por pessoa
MAX_ENTRIES = 256              # inscritos por torneio
MAX_PHASES = 8                 # fases por torneio
WRITES_PER_MINUTE = 120        # escritas por leitor por minuto (placar de varias partidas seguidas cabe folgado)
SOURCE = "site"                # origem do log quando quem age e' um leitor (nao da equipe)


def _throttle(reader: Reader, bucket: str = "tournament-write", limit: int = WRITES_PER_MINUTE, window: float = 60) -> None:
    """Estoura o limite por leitor -> 429 com 'tente de novo em N segundos'."""
    wait = limiter.hit(bucket, str(reader.id), limit, window)
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})


# ---------------- acesso ----------------

async def _visible(db: AsyncSession, tid: UUID, reader: Reader | None) -> Tournament:
    """Torneio que ESTE visitante pode ver: rascunho, oculto pelo organizador e escondido pela equipe so' para o organizador; senao 404 (nao revela que existe)."""
    t = await db.get(Tournament, tid)
    mine = t is not None and reader is not None and t.owner_id == reader.id
    if t is None or (not mine and (t.hidden or t.organizer_hidden or t.status == TournamentStatus.DRAFT)):
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


async def _owned(db: AsyncSession, tid: UUID, reader: Reader) -> Tournament:
    """Torneio onde o leitor e' o ORGANIZADOR e pode escrever (outro leitor: 403; escondido pela equipe: 403)."""
    t = await _visible(db, tid, reader)
    if t.owner_id != reader.id:
        raise HTTPException(status_code=403, detail="Only the organizer can do this")
    if t.hidden:
        raise HTTPException(status_code=403, detail="This tournament was hidden by the moderators")
    return t


def _need_not_finished(t: Tournament) -> None:
    """Torneio encerrado so' aceita editar nome/descricao/visibilidade (ou ser reaberto)."""
    if t.status == TournamentStatus.FINISHED:
        raise HTTPException(status_code=409, detail="This tournament is finished")


# ---------------- leitura ----------------

async def _owners(db: AsyncSession, ids: set[UUID]) -> dict[UUID, Reader]:
    """Leitores (donos) pelos ids."""
    if not ids:
        return {}
    return {r.id: r for r in (await db.execute(select(Reader).where(Reader.id.in_(ids)))).scalars()}


def _player_ref(r: Reader) -> PlayerRef:
    """Dados publicos do leitor (nunca o Discord ID)."""
    return PlayerRef(id=r.id, username=r.username, avatar_url=r.avatar_url, game_name=r.game_name)


async def _summaries(db: AsyncSession, rows: list[Tournament]) -> list[TournamentSummary]:
    """Monta os cartoes da lista (dono + contagem de inscritos e fases em consultas agrupadas)."""
    ids = [t.id for t in rows]
    owners = await _owners(db, {t.owner_id for t in rows})
    entries = dict((await db.execute(select(TournamentEntry.tournament_id, func.count()).where(TournamentEntry.tournament_id.in_(ids)).group_by(TournamentEntry.tournament_id))).all()) if ids else {}
    phases = dict((await db.execute(select(TournamentPhase.tournament_id, func.count()).where(TournamentPhase.tournament_id.in_(ids)).group_by(TournamentPhase.tournament_id))).all()) if ids else {}
    return [TournamentSummary(
        id=t.id, name=t.name, status=t.status, visibility=t.visibility, starts_at=t.starts_at, created_at=t.created_at,
        champion_name=t.champion_name, hidden=t.hidden, organizer_hidden=t.organizer_hidden, owner=_player_ref(owners[t.owner_id]),
        entry_count=entries.get(t.id, 0), phase_count=phases.get(t.id, 0)) for t in rows]


def _suggest(phase: TournamentPhase, prev: TournamentPhase | None, entries: list[EntryRead], comps: dict[UUID, list[TournamentCompetitor]],
             members: dict[UUID, list[UUID]], matches: dict[UUID, list[TournamentMatch]], stand: dict[UUID, list[StandingRead]]) -> list[UUID]:
    """
    Sugestao de quem entra na fase: fase 1 = todos os inscritos (ordem de semente). Depois de uma fase de ELIMINATORIA = quem venceu
    pelo menos uma partida (ou teve folga); depois de TODOS-CONTRA-TODOS = a metade de cima da tabela. O organizador ajusta como quiser.
    A ORDEM da sugestao e' o desempenho na fase anterior (campeao primeiro, depois quem foi mais longe; empate = a semente anterior), porque o construtor
    usa essa ordem como sementes da fase seguinte: quem foi melhor entra como cabeca de chave mais alta. Os integrantes de cada equipe ficam juntos.
    """
    everyone = [e.id for e in entries]
    if prev is None or not comps.get(prev.id):
        return everyone
    if prev.format == PhaseFormat.SINGLE_ELIMINATION:
        wins: dict[UUID, int] = {}
        for m in matches.get(prev.id, []):
            if m.done and m.winner_id:
                wins[m.winner_id] = wins.get(m.winner_id, 0) + 1   # folga conta como vitoria
        ordered = sorted((c for c in comps[prev.id] if c.id in wins), key=lambda c: (-wins[c.id], c.seed))
    else:
        table = stand.get(prev.id) or []
        pos = {s.competitor_id: i for i, s in enumerate(table[: (len(table) + 1) // 2])}
        ordered = sorted((c for c in comps[prev.id] if c.id in pos), key=lambda c: pos[c.id])
    picked = [eid for c in ordered for eid in members.get(c.id, [])]
    return picked or everyone


async def _detail(db: AsyncSession, t: Tournament, reader: Reader | None) -> TournamentDetail:
    """Torneio completo: inscritos, fases, competidores, partidas e (todos-contra-todos) a tabela."""
    is_org = reader is not None and t.owner_id == reader.id
    rows = (await db.execute(
        select(TournamentEntry, Reader).outerjoin(Reader, Reader.id == TournamentEntry.reader_id)
        .where(TournamentEntry.tournament_id == t.id).order_by(TournamentEntry.seed, TournamentEntry.created_at))).all()
    entries = [EntryRead(id=e.id, display_name=e.display_name, seed=e.seed, reader_id=e.reader_id, avatar_url=r.avatar_url if r else None,
                         village_id=r.village_id if r else None, ninja_rank_id=r.ninja_rank_id if r else None, placement=e.placement,
                         team_name=e.team_name, team_group=e.team_group) for e, r in rows]
    phases = (await db.execute(select(TournamentPhase).where(TournamentPhase.tournament_id == t.id).order_by(TournamentPhase.position))).scalars().all()
    pids = [p.id for p in phases]
    comps: dict[UUID, list[TournamentCompetitor]] = {}
    matches: dict[UUID, list[TournamentMatch]] = {}
    members: dict[UUID, list[UUID]] = {}
    if pids:
        for c in (await db.execute(select(TournamentCompetitor).where(TournamentCompetitor.phase_id.in_(pids)).order_by(TournamentCompetitor.seed))).scalars():
            comps.setdefault(c.phase_id, []).append(c)
        for m in (await db.execute(select(TournamentMatch).where(TournamentMatch.phase_id.in_(pids)).order_by(TournamentMatch.round, TournamentMatch.slot))).scalars():
            matches.setdefault(m.phase_id, []).append(m)
        cids = [c.id for cs in comps.values() for c in cs]
        if cids:
            for mem in (await db.execute(select(TournamentTeamMember).where(TournamentTeamMember.competitor_id.in_(cids)))).scalars():
                members.setdefault(mem.competitor_id, []).append(mem.entry_id)
    seed_of = {e.id: e.seed for e in entries}
    stand: dict[UUID, list[StandingRead]] = {}
    for p in phases:
        if p.format == PhaseFormat.ROUND_ROBIN and comps.get(p.id):
            stand[p.id] = [StandingRead(**row) for row in brackets.standings([str(c.id) for c in comps[p.id]], _rr_results(matches.get(p.id, [])))]
    out: list[PhaseRead] = []
    for i, p in enumerate(phases):
        suggested = _suggest(p, phases[i - 1] if i else None, entries, comps, members, matches, stand) if is_org and p.status == PhaseStatus.SETUP else None
        out.append(PhaseRead(
            id=p.id, position=p.position, name=p.name, team_size=p.team_size, format=p.format, status=p.status,
            competitors=[CompetitorRead(id=c.id, name=c.name, seed=c.seed, entry_ids=sorted(members.get(c.id, []), key=lambda x: seed_of.get(x, 0))) for c in comps.get(p.id, [])],
            matches=[MatchRead.model_validate(m) for m in matches.get(p.id, [])], standings=stand.get(p.id), suggested_entry_ids=suggested))
    mine = next((e.id for e in entries if reader is not None and e.reader_id == reader.id), None)
    summary = (await _summaries(db, [t]))[0]
    return TournamentDetail(**summary.model_dump(), description=t.description, is_organizer=is_org, my_entry_id=mine, entries=entries, phases=out)


def _rr_results(ms: list[TournamentMatch]) -> list[tuple[str, str, int | None, int | None]]:
    """Resultados jogados do todos-contra-todos para a tabela (sem placar, o vencedor conta 1 x 0)."""
    out = []
    for m in ms:
        if not m.done or m.competitor_a_id is None or m.competitor_b_id is None:
            continue
        sa, sb = m.score_a, m.score_b
        if sa is None or sb is None:
            sa, sb = (1, 0) if m.winner_id == m.competitor_a_id else (0, 1)
        out.append((str(m.competitor_a_id), str(m.competitor_b_id), sa, sb))
    return out


@router.get("", response_model=TournamentList)
async def list_tournaments(
    status: TournamentStatus | None = None, q: str | None = Query(None, max_length=80), mine: bool = False,
    limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0),
    reader: Reader | None = Depends(get_optional_reader), db: AsyncSession = Depends(get_db),
):
    """Lista publica (so' torneios 'publicos', ja' publicados e nao escondidos). `mine=true`: os que EU criei ou disputo (exige login)."""
    if mine:
        if reader is None:
            raise HTTPException(status_code=401, detail="Sign in with Discord to do this")
        joined = select(TournamentEntry.tournament_id).where(TournamentEntry.reader_id == reader.id)
        where = [or_(Tournament.owner_id == reader.id, (Tournament.id.in_(joined) & Tournament.organizer_hidden.is_(False) & Tournament.hidden.is_(False)))]
    else:
        where = [Tournament.visibility == TournamentVisibility.PUBLIC, Tournament.hidden.is_(False), Tournament.organizer_hidden.is_(False), Tournament.status != TournamentStatus.DRAFT]
    if status is not None:
        where.append(Tournament.status == status)
    if q and q.strip():
        where.append(Tournament.name.ilike("%" + escape_like(q.strip()[:60]) + "%", escape="\\"))
    total = (await db.execute(select(func.count()).select_from(Tournament).where(*where))).scalar_one()
    rows = (await db.execute(select(Tournament).where(*where).order_by(Tournament.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    return TournamentList(items=await _summaries(db, list(rows)), total=total)


@router.get("/{tournament_id}", response_model=TournamentDetail)
async def get_tournament(tournament_id: UUID, reader: Reader | None = Depends(get_optional_reader), db: AsyncSession = Depends(get_db)):
    """Torneio completo. Nao listado: qualquer pessoa com o link ve'."""
    return await _detail(db, await _visible(db, tournament_id, reader), reader)


# ---------------- torneio (organizador) ----------------

@router.post("", response_model=TournamentDetail, status_code=201)
async def create_tournament(payload: TournamentWrite, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Cria um torneio em RASCUNHO; quem cria vira o organizador. Limites: por dia e ativos por pessoa."""
    _throttle(reader)
    _throttle(reader, "tournament-create", 10, 3600)
    since = datetime.now(timezone.utc) - timedelta(days=1)
    today = (await db.execute(select(func.count()).select_from(Tournament).where(Tournament.owner_id == reader.id, Tournament.created_at > since))).scalar_one()
    if today >= MAX_CREATED_PER_DAY:
        raise HTTPException(status_code=429, detail=f"You can create up to {MAX_CREATED_PER_DAY} tournaments per day. Try again tomorrow.")
    active = (await db.execute(select(func.count()).select_from(Tournament).where(Tournament.owner_id == reader.id, Tournament.status != TournamentStatus.FINISHED))).scalar_one()
    if active >= MAX_ACTIVE_PER_READER:
        raise HTTPException(status_code=429, detail=f"You already have {MAX_ACTIVE_PER_READER} active tournaments. Finish or delete one first.")
    t = Tournament(owner_id=reader.id, name=payload.name, description=payload.description, starts_at=payload.starts_at, visibility=payload.visibility,
                   organizer_hidden=payload.organizer_hidden)   # padrao True: nasce OCULTO ate o organizador publicar
    db.add(t)
    await db.flush()
    await log_action(db, action="create", entity_type="tournament", entity_id=str(t.id), diff={"reader": reader.username, "name": t.name}, source=SOURCE)
    await db.commit()
    return await _detail(db, t, reader)


@router.patch("/{tournament_id}", response_model=TournamentDetail)
async def update_tournament(tournament_id: UUID, payload: TournamentPatch, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador: nome, descricao, data, visibilidade e estado (rascunho / inscricoes abertas / em andamento)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    if payload.name is not None:
        t.name = payload.name
    if payload.description is not None:
        t.description = payload.description
    if payload.clear_starts_at:
        t.starts_at = None
    elif payload.starts_at is not None:
        t.starts_at = payload.starts_at
    if payload.visibility is not None:
        t.visibility = payload.visibility
    if payload.organizer_hidden is not None:
        t.organizer_hidden = payload.organizer_hidden   # _owned ja' barra quando a EQUIPE escondeu (o organizador nao reexibe)
    if payload.status is not None:
        _need_not_finished(t)
        new = TournamentStatus(payload.status)
        started = (await db.execute(select(func.count()).select_from(TournamentPhase).where(TournamentPhase.tournament_id == t.id, TournamentPhase.status != PhaseStatus.SETUP))).scalar_one()
        if started and new != TournamentStatus.RUNNING:
            raise HTTPException(status_code=409, detail="A phase already started: the tournament must stay in progress")
        t.status = new
    await db.commit()
    return await _detail(db, t, reader)


@router.delete("/{tournament_id}", status_code=204)
async def delete_tournament(tournament_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador apaga o proprio torneio (leva inscritos, fases e partidas junto)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    await log_action(db, action="delete", entity_type="tournament", entity_id=str(t.id), diff={"reader": reader.username, "name": t.name}, source=SOURCE)
    await db.delete(t)
    await db.commit()
    return Response(status_code=204)


# ---------------- inscritos ----------------

async def _entries(db: AsyncSession, t: Tournament) -> list[TournamentEntry]:
    """Inscritos na ordem de semente."""
    return list((await db.execute(select(TournamentEntry).where(TournamentEntry.tournament_id == t.id).order_by(TournamentEntry.seed, TournamentEntry.created_at))).scalars())


@router.post("/{tournament_id}/join", response_model=TournamentDetail)
async def join_tournament(tournament_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """O leitor logado se inscreve (so' com inscricoes abertas). A identificacao e' o nome no jogo do perfil (ou o nome do Discord)."""
    _throttle(reader)
    t = await _visible(db, tournament_id, reader)
    if t.hidden or t.status != TournamentStatus.OPEN:
        raise HTTPException(status_code=409, detail="Registration is not open")
    entries = await _entries(db, t)
    if any(e.reader_id == reader.id for e in entries):
        return await _detail(db, t, reader)   # ja' inscrito: nao faz nada
    if len(entries) >= MAX_ENTRIES:
        raise HTTPException(status_code=409, detail=f"This tournament is full ({MAX_ENTRIES} entries)")
    db.add(TournamentEntry(tournament_id=t.id, reader_id=reader.id, display_name=(reader.game_name or reader.username)[:60], seed=len(entries)))
    await db.commit()
    return await _detail(db, t, reader)


@router.delete("/{tournament_id}/join", response_model=TournamentDetail)
async def leave_tournament(tournament_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """O leitor sai do torneio (so' enquanto as inscricoes estao abertas)."""
    _throttle(reader)
    t = await _visible(db, tournament_id, reader)
    if t.status != TournamentStatus.OPEN:
        raise HTTPException(status_code=409, detail="Registration is closed")
    await db.execute(delete(TournamentEntry).where(TournamentEntry.tournament_id == t.id, TournamentEntry.reader_id == reader.id))
    await _renumber(db, t)
    await db.commit()
    return await _detail(db, t, reader)


async def _renumber(db: AsyncSession, t: Tournament) -> None:
    """Refaz as sementes 0..n-1 mantendo a ordem atual."""
    for i, e in enumerate(await _entries(db, t)):
        e.seed = i


def _entries_editable(t: Tournament) -> None:
    """Inscritos so' mudam em rascunho ou com inscricoes abertas (depois a chave ja' usa os nomes)."""
    if t.status not in (TournamentStatus.DRAFT, TournamentStatus.OPEN):
        raise HTTPException(status_code=409, detail="Entries can only change before the tournament starts")


@router.post("/{tournament_id}/entries", response_model=TournamentDetail, status_code=201)
async def add_guest(tournament_id: UUID, payload: GuestWrite, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador inscreve alguem 'sem conta' (so' o nome)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    _entries_editable(t)
    count = (await db.execute(select(func.count()).select_from(TournamentEntry).where(TournamentEntry.tournament_id == t.id))).scalar_one()
    if count >= MAX_ENTRIES:
        raise HTTPException(status_code=409, detail=f"This tournament is full ({MAX_ENTRIES} entries)")
    db.add(TournamentEntry(tournament_id=t.id, reader_id=None, display_name=payload.display_name, seed=count))
    await db.commit()
    return await _detail(db, t, reader)


def _name_key(name: str) -> str:
    """Chave para comparar nomes sem diferenciar maiusculas, acentos nem espacos repetidos."""
    base = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))
    return " ".join(base.casefold().split())


@router.post("/{tournament_id}/entries/bulk", response_model=BulkEntriesResult, status_code=201)
async def add_guests_bulk(tournament_id: UUID, payload: BulkEntriesWrite, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador importa varios convidados de uma vez (mesma regra de estado do add_guest), numa transacao so'.
    Linhas vazias sao ignoradas; duplicados (dentro da lista ou ja' inscritos), nomes longos/invalidos e excesso alem de MAX_ENTRIES voltam em `skipped`.
    Equipes (`teams`): os integrantes viram inscritos com o mesmo `team_group` (e o `team_name` opcional); equipe que ficou com menos de 2 integrantes
    (por duplicados/invalidos) e sem nome volta a ser inscrito individual."""
    _throttle(reader)
    _throttle(reader, "tournament-bulk", 10, 60)
    t = await _owned(db, tournament_id, reader)
    _entries_editable(t)
    current = await _entries(db, t)
    seen = {_name_key(e.display_name) for e in current}
    room = MAX_ENTRIES - len(current)
    new: list[tuple[str, str | None, int | None]] = []   # (nome, nome da equipe, grupo da equipe)
    skipped: list[BulkSkipped] = []
    next_group = max((e.team_group or 0 for e in current), default=0) + 1
    # individuais (`names`) primeiro; depois as equipes/individuais de `teams`, na ordem da lista
    items = [BulkTeam(name=None, members=[n]) for n in payload.names if n.strip()] + list(payload.teams)
    for item in items:
        team_name = ("".join(ch for ch in (item.name or "") if ch.isprintable()).strip())[:60] or None
        ok: list[str] = []
        for raw in item.members:
            name = " ".join(raw.split())          # tira controles/quebras e espacos repetidos
            if not name:
                continue
            reason = "too_long" if len(name) > 60 else "invalid" if not name.isprintable() or not any(c.isalnum() for c in name) else None
            if reason is None:
                key = _name_key(name)
                reason = "duplicate" if key in seen else "full" if len(new) + len(ok) >= room else None
            if reason:
                skipped.append(BulkSkipped(name=name[:80], reason=reason))
                continue
            seen.add(key)
            ok.append(name)
        if not ok:
            continue
        is_team = len(ok) >= 2 or (team_name is not None and len(item.members) >= 2)
        group = next_group if is_team else None
        next_group += 1 if is_team else 0
        new.extend((n, team_name if is_team else None, group) for n in ok)
    if new:
        if payload.position == "start":
            for e in current:
                e.seed += len(new)
        base = 0 if payload.position == "start" else len(current)
        db.add_all(TournamentEntry(tournament_id=t.id, reader_id=None, display_name=n, seed=base + i, team_name=tn, team_group=g) for i, (n, tn, g) in enumerate(new))
        await log_action(db, action="update", entity_type="tournament", entity_id=str(t.id), diff={"reader": reader.username, "bulkEntries": len(new)}, source=SOURCE)
    await db.commit()
    return BulkEntriesResult(added=len(new), skipped=skipped, tournament=await _detail(db, t, reader))


@router.delete("/{tournament_id}/entries/{entry_id}", response_model=TournamentDetail)
async def remove_entry(tournament_id: UUID, entry_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador remove um inscrito."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    _entries_editable(t)
    e = await db.get(TournamentEntry, entry_id)
    if e is None or e.tournament_id != t.id:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(e)
    await db.flush()
    await _renumber(db, t)
    await db.commit()
    return await _detail(db, t, reader)


@router.put("/{tournament_id}/entries/order", response_model=TournamentDetail)
async def reorder_entries(tournament_id: UUID, payload: EntryOrder, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador define a ordem das sementes (a lista tem que trazer TODOS os inscritos, sem repetir)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    entries = {e.id: e for e in await _entries(db, t)}
    if set(payload.ids) != set(entries) or len(payload.ids) != len(entries):
        raise HTTPException(status_code=422, detail="The list must contain every entry exactly once")
    for i, eid in enumerate(payload.ids):
        entries[eid].seed = i
    await db.commit()
    return await _detail(db, t, reader)


# ---------------- fases ----------------

async def _phase(db: AsyncSession, t: Tournament, pid: UUID) -> TournamentPhase:
    """Fase do torneio ou 404."""
    p = await db.get(TournamentPhase, pid)
    if p is None or p.tournament_id != t.id:
        raise HTTPException(status_code=404, detail="Phase not found")
    return p


async def _phases(db: AsyncSession, t: Tournament) -> list[TournamentPhase]:
    """Fases em ordem."""
    return list((await db.execute(select(TournamentPhase).where(TournamentPhase.tournament_id == t.id).order_by(TournamentPhase.position))).scalars())


@router.post("/{tournament_id}/phases", response_model=TournamentDetail, status_code=201)
async def create_phase(tournament_id: UUID, payload: PhaseWrite, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador cria uma fase (vai para o fim da lista)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    _need_not_finished(t)
    phases = await _phases(db, t)
    if len(phases) >= MAX_PHASES:
        raise HTTPException(status_code=409, detail=f"At most {MAX_PHASES} phases per tournament")
    db.add(TournamentPhase(tournament_id=t.id, position=len(phases) + 1, name=payload.name, team_size=payload.team_size, format=payload.format))
    await db.commit()
    return await _detail(db, t, reader)


@router.patch("/{tournament_id}/phases/{phase_id}", response_model=TournamentDetail)
async def update_phase(tournament_id: UUID, phase_id: UUID, payload: PhaseWrite, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador edita nome / tamanho de equipe / formato (so' enquanto a fase nao tem chave)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    p = await _phase(db, t, phase_id)
    if p.status != PhaseStatus.SETUP:
        raise HTTPException(status_code=409, detail="This phase already has a bracket. Reset it first")
    p.name, p.team_size, p.format = payload.name, payload.team_size, payload.format
    await db.commit()
    return await _detail(db, t, reader)


@router.delete("/{tournament_id}/phases/{phase_id}", response_model=TournamentDetail)
async def delete_phase(tournament_id: UUID, phase_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador apaga uma fase ainda sem chave (as seguintes sobem de posicao)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    p = await _phase(db, t, phase_id)
    if p.status != PhaseStatus.SETUP:
        raise HTTPException(status_code=409, detail="This phase already has a bracket. Reset it first")
    await db.delete(p)
    await db.flush()
    for i, ph in enumerate(await _phases(db, t)):
        ph.position = i + 1
    await db.commit()
    return await _detail(db, t, reader)


@router.post("/{tournament_id}/phases/{phase_id}/start", response_model=TournamentDetail)
async def start_phase(tournament_id: UUID, phase_id: UUID, payload: PhaseStart, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """
    Organizador monta os competidores da fase (na ordem de semente) e a chave e' gerada: eliminatoria com folgas (bye) quando o numero nao
    e' potencia de 2, ou todos-contra-todos. Cada competidor tem exatamente `team_size` integrantes, vindos dos inscritos, sem repetir.
    A fase anterior precisa estar concluida. Iniciar a 1a fase fecha as inscricoes (torneio 'em andamento').
    """
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    _need_not_finished(t)
    phases = await _phases(db, t)
    p = await _phase(db, t, phase_id)
    if p.status != PhaseStatus.SETUP:
        raise HTTPException(status_code=409, detail="This phase already has a bracket")
    if any(o.position < p.position and o.status != PhaseStatus.FINISHED for o in phases):
        raise HTTPException(status_code=409, detail="Finish the previous phase first")
    valid = {e.id for e in await _entries(db, t)}
    entry_name = {e.id: e.display_name for e in await _entries(db, t)}
    used: set[UUID] = set()
    for c in payload.competitors:
        if len(c.entry_ids) != p.team_size:
            raise HTTPException(status_code=422, detail=f"Each team needs exactly {p.team_size} member(s)")
        for eid in c.entry_ids:
            if eid not in valid:
                raise HTTPException(status_code=422, detail="Unknown entry")
            if eid in used:
                raise HTTPException(status_code=422, detail="A person can only be in one team per phase")
            used.add(eid)
    comps: list[TournamentCompetitor] = []
    for i, c in enumerate(payload.competitors):
        # Sem nome de equipe aparecem os nomes dos integrantes ("A & B & C"); passando de 60 caracteres corta com reticencias.
        joined = " & ".join(entry_name[eid] for eid in c.entry_ids)
        name = ("".join(ch for ch in (c.name or "") if ch.isprintable()).strip())[:60] or (joined if len(joined) <= 60 else joined[:59].rstrip() + "…")
        comps.append(TournamentCompetitor(id=uuid.uuid4(), phase_id=p.id, name=name, seed=i + 1))
    db.add_all(comps)
    await db.flush()
    db.add_all(TournamentTeamMember(competitor_id=comp.id, entry_id=eid) for comp, c in zip(comps, payload.competitors) for eid in c.entry_ids)
    by_seed = {c.seed: c.id for c in comps}
    specs = brackets.single_elimination(len(comps)) if p.format == PhaseFormat.SINGLE_ELIMINATION else brackets.round_robin(len(comps))
    ms = {(s.round, s.slot): TournamentMatch(
        id=uuid.uuid4(), phase_id=p.id, round=s.round, slot=s.slot,
        competitor_a_id=by_seed.get(s.seed_a) if s.seed_a else None, competitor_b_id=by_seed.get(s.seed_b) if s.seed_b else None) for s in specs}
    if p.format == PhaseFormat.SINGLE_ELIMINATION:
        for m in [m for m in ms.values() if m.round == 1 and (m.competitor_a_id is None) != (m.competitor_b_id is None)]:
            m.done, m.winner_id = True, m.competitor_a_id or m.competitor_b_id   # folga: passa direto
            _, nslot, side = brackets.next_match(m.round, m.slot)
            setattr(ms[(2, nslot)], f"competitor_{side}_id", m.winner_id)
    db.add_all(ms.values())
    p.status = PhaseStatus.RUNNING
    t.status = TournamentStatus.RUNNING
    await db.commit()
    return await _detail(db, t, reader)


async def _phase_matches(db: AsyncSession, p: TournamentPhase) -> list[TournamentMatch]:
    """Partidas da fase."""
    return list((await db.execute(select(TournamentMatch).where(TournamentMatch.phase_id == p.id).order_by(TournamentMatch.round, TournamentMatch.slot))).scalars())


@router.post("/{tournament_id}/phases/{phase_id}/reset", response_model=TournamentDetail)
async def reset_phase(tournament_id: UUID, phase_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador desfaz a chave (volta a fase para a montagem) - so' se nenhuma partida de verdade foi jogada (folgas nao contam)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    p = await _phase(db, t, phase_id)
    if p.status != PhaseStatus.RUNNING:
        raise HTTPException(status_code=409, detail="This phase has no running bracket")
    if any(m.done and m.competitor_a_id and m.competitor_b_id for m in await _phase_matches(db, p)):
        raise HTTPException(status_code=409, detail="Matches were already played in this phase")
    await db.execute(delete(TournamentMatch).where(TournamentMatch.phase_id == p.id))
    await db.execute(delete(TournamentCompetitor).where(TournamentCompetitor.phase_id == p.id))
    p.status = PhaseStatus.SETUP
    await db.commit()
    return await _detail(db, t, reader)


def _phase_complete(p: TournamentPhase, ms: list[TournamentMatch]) -> bool:
    """Todas as partidas decididas? (na eliminatoria basta a final estar feita, pois ela depende das outras)."""
    if not ms:
        return False
    if p.format == PhaseFormat.SINGLE_ELIMINATION:
        return all(m.done for m in ms if m.round == max(x.round for x in ms))
    return all(m.done for m in ms)


@router.post("/{tournament_id}/phases/{phase_id}/finish", response_model=TournamentDetail)
async def finish_phase(tournament_id: UUID, phase_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador conclui a fase (todas as partidas precisam ter resultado)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    p = await _phase(db, t, phase_id)
    if p.status != PhaseStatus.RUNNING:
        raise HTTPException(status_code=409, detail="This phase is not running")
    if not _phase_complete(p, await _phase_matches(db, p)):
        raise HTTPException(status_code=409, detail="Some matches still have no result")
    p.status = PhaseStatus.FINISHED
    await db.commit()
    return await _detail(db, t, reader)


@router.post("/{tournament_id}/phases/{phase_id}/reopen", response_model=TournamentDetail)
async def reopen_phase(tournament_id: UUID, phase_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador reabre uma fase concluida (para corrigir placar) - so' se a proxima ainda nao tem chave e o torneio nao foi encerrado."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    _need_not_finished(t)
    p = await _phase(db, t, phase_id)
    if p.status != PhaseStatus.FINISHED:
        raise HTTPException(status_code=409, detail="This phase is not finished")
    if any(o.position > p.position and o.status != PhaseStatus.SETUP for o in await _phases(db, t)):
        raise HTTPException(status_code=409, detail="The next phase already started")
    p.status = PhaseStatus.RUNNING
    await db.commit()
    return await _detail(db, t, reader)


# ---------------- partidas ----------------

@router.put("/{tournament_id}/matches/{match_id}/result", response_model=TournamentDetail)
async def set_result(tournament_id: UUID, match_id: UUID, payload: ResultWrite, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """
    Organizador lanca (ou corrige) o resultado. Na eliminatoria o vencedor avanca sozinho. Corrigir mudando o vencedor de uma partida que
    ja' alimentou uma partida seguinte JA' JOGADA e' recusado (409); se a seguinte ainda nao foi jogada, o novo vencedor a substitui.
    """
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    _need_not_finished(t)
    m = await db.get(TournamentMatch, match_id)
    p = await db.get(TournamentPhase, m.phase_id) if m else None
    if m is None or p is None or p.tournament_id != t.id:
        raise HTTPException(status_code=404, detail="Match not found")
    if p.status != PhaseStatus.RUNNING:
        raise HTTPException(status_code=409, detail="This phase is not running")
    if m.competitor_a_id is None or m.competitor_b_id is None:
        raise HTTPException(status_code=409, detail="Waiting for the opponent")
    try:
        side = brackets.resolve_winner(payload.score_a, payload.score_b, payload.winner, allow_draw=p.format == PhaseFormat.ROUND_ROBIN)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    winner_id = None if side is None else (m.competitor_a_id if side == "a" else m.competitor_b_id)
    if p.format == PhaseFormat.SINGLE_ELIMINATION:
        nxt = (await db.execute(select(TournamentMatch).where(TournamentMatch.phase_id == p.id, TournamentMatch.round == m.round + 1, TournamentMatch.slot == m.slot // 2))).scalar_one_or_none()
        if nxt is not None:
            if nxt.done and winner_id != m.winner_id:
                raise HTTPException(status_code=409, detail="The next match already has a result. Correct it first")
            setattr(nxt, f"competitor_{brackets.next_match(m.round, m.slot)[2]}_id", winner_id)
    m.score_a, m.score_b, m.winner_id, m.done = payload.score_a, payload.score_b, winner_id, True
    await db.commit()
    return await _detail(db, t, reader)


# ---------------- encerrar ----------------

@router.post("/{tournament_id}/finish", response_model=TournamentDetail)
async def finish_tournament(tournament_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """
    Organizador encerra: todas as fases precisam estar concluidas. A ULTIMA fase define o campeao e a colocacao dos participantes
    (eliminatoria: campeao 1, finalista 2, semifinalistas 3...; todos-contra-todos: ordem da tabela) e entra no historico dos perfis.
    """
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    _need_not_finished(t)
    phases = await _phases(db, t)
    if not phases or any(p.status != PhaseStatus.FINISHED for p in phases):
        raise HTTPException(status_code=409, detail="Finish every phase first (delete the ones you will not use)")
    last = phases[-1]
    comps = list((await db.execute(select(TournamentCompetitor).where(TournamentCompetitor.phase_id == last.id).order_by(TournamentCompetitor.seed))).scalars())
    ms = await _phase_matches(db, last)
    place: dict[UUID, int] = {}
    if last.format == PhaseFormat.SINGLE_ELIMINATION:
        total = brackets.rounds_count(len(comps))
        for c in comps:
            lost = [x.round for x in ms if x.done and c.id in (x.competitor_a_id, x.competitor_b_id) and x.winner_id != c.id]
            place[c.id] = brackets.elimination_placement(total, lost[0] if lost else None)
    else:
        for i, row in enumerate(brackets.standings([str(c.id) for c in comps], _rr_results(ms))):
            place[UUID(row["competitorId"])] = i + 1
    members = (await db.execute(select(TournamentTeamMember).where(TournamentTeamMember.competitor_id.in_(list(place))))).scalars().all()
    for mem in members:
        e = await db.get(TournamentEntry, mem.entry_id)
        if e is not None:
            e.placement = place[mem.competitor_id]
    champ = next((c for c in comps if place.get(c.id) == 1), None)
    t.champion_name = champ.name if champ else None
    t.status = TournamentStatus.FINISHED
    await log_action(db, action="finish", entity_type="tournament", entity_id=str(t.id), diff={"reader": reader.username, "champion": t.champion_name}, source=SOURCE)
    await db.commit()
    return await _detail(db, t, reader)


@router.post("/{tournament_id}/reopen", response_model=TournamentDetail)
async def reopen_tournament(tournament_id: UUID, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Organizador reabre um torneio encerrado (apaga campeao e colocacoes; a ultima fase continua concluida - reabra-a para corrigir)."""
    _throttle(reader)
    t = await _owned(db, tournament_id, reader)
    if t.status != TournamentStatus.FINISHED:
        raise HTTPException(status_code=409, detail="This tournament is not finished")
    for e in await _entries(db, t):
        e.placement = None
    t.champion_name, t.status = None, TournamentStatus.RUNNING
    await db.commit()
    return await _detail(db, t, reader)


# ---------------- perfil dos jogadores ----------------

async def _ref(db: AsyncSession, model, ref_id: str | None) -> VillageRef | None:
    """Vila ou rank (id + nome nos dois idiomas) ou None."""
    row = await db.get(model, ref_id) if ref_id else None
    return VillageRef(id=row.id, name=row.name, name_pt=row.name_pt) if row else None


async def _profile(db: AsyncSession, r: Reader) -> PlayerProfile:
    """Perfil publico: dados do leitor + historico (so' torneios publicos ja' iniciados e nao escondidos) com vitorias/derrotas e trofeus."""
    rows = (await db.execute(
        select(TournamentEntry, Tournament).join(Tournament, Tournament.id == TournamentEntry.tournament_id)
        .where(TournamentEntry.reader_id == r.id, Tournament.hidden.is_(False), Tournament.organizer_hidden.is_(False), Tournament.visibility == TournamentVisibility.PUBLIC,
               Tournament.status.in_([TournamentStatus.RUNNING, TournamentStatus.FINISHED]))
        .order_by(Tournament.created_at.desc()).limit(200))).all()
    entry_ids = [e.id for e, _ in rows]
    comp_entry: dict[UUID, UUID] = {}
    if entry_ids:
        comp_entry = {c: e for c, e in (await db.execute(select(TournamentTeamMember.competitor_id, TournamentTeamMember.entry_id).where(TournamentTeamMember.entry_id.in_(entry_ids)))).all()}
    wins: dict[UUID, int] = {}
    losses: dict[UUID, int] = {}
    if comp_entry:
        cids = list(comp_entry)
        for m in (await db.execute(select(TournamentMatch).where(TournamentMatch.done.is_(True), TournamentMatch.winner_id.is_not(None),
                                                                 or_(TournamentMatch.competitor_a_id.in_(cids), TournamentMatch.competitor_b_id.in_(cids))))).scalars():
            if m.competitor_a_id is None or m.competitor_b_id is None:
                continue   # folga nao e' vitoria
            for cid in (m.competitor_a_id, m.competitor_b_id):
                if cid in comp_entry:
                    bucket = wins if m.winner_id == cid else losses
                    bucket[comp_entry[cid]] = bucket.get(comp_entry[cid], 0) + 1
    history = [HistoryItem(tournament_id=t.id, name=t.name, status=t.status, placement=e.placement, wins=wins.get(e.id, 0), losses=losses.get(e.id, 0), date=t.created_at) for e, t in rows]
    return PlayerProfile(
        id=r.id, username=r.username, avatar_url=r.avatar_url, game_name=r.game_name,
        village=await _ref(db, Village, r.village_id), ninja_rank=await _ref(db, NinjaRank, r.ninja_rank_id),
        stats=PlayerStats(tournaments=len(history), wins=sum(h.wins for h in history), losses=sum(h.losses for h in history), titles=sum(1 for h in history if h.placement == 1)),
        history=history, trophies=[h for h in history if h.placement == 1])


async def _my_profile(db: AsyncSession, r: Reader) -> PlayerProfile:
    """Perfil + de onde vieram vila e rank ("discord:<servidor>" vira o nome do servidor; o resto e' o padrao)."""
    p = await _profile(db, r)
    guild = await db.get(DiscordGuild, r.profile_source.removeprefix("discord:")) if (r.profile_source or "").startswith("discord:") else None
    p.source = ProfileSource(kind="discord", guild_name=guild.name) if guild else ProfileSource(kind="default")
    return p


@players_router.get("/me", response_model=PlayerProfile)
async def my_profile(reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """O perfil de quem esta' logado (com a origem de vila/rank)."""
    return await _my_profile(db, reader)


@players_router.put("/me", response_model=PlayerProfile)
async def update_my_profile(payload: ProfileWrite, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Edita o PROPRIO perfil: so' o nome no jogo. Vila e rank vem do Discord (cargo lido pelo bot) e o schema recusa esses campos."""
    _throttle(reader, "profile-write", 30, 60)
    reader.game_name = payload.game_name
    await db.commit()
    return await _my_profile(db, reader)


@players_router.get("/{player_id}", response_model=PlayerProfile)
async def get_profile(player_id: UUID, db: AsyncSession = Depends(get_db)):
    """Perfil publico (identificador = UUID do leitor; nunca expoe o Discord ID). Leitor banido: 404."""
    r = await db.get(Reader, player_id)
    if r is None or r.banned:
        raise HTTPException(status_code=404, detail="Player not found")
    return await _profile(db, r)


# ---------------- moderacao (equipe) ----------------

@moderation_router.get("", response_model=list[ModerationRow])
async def list_for_moderation(
    q: str | None = Query(None, max_length=60), hidden: bool | None = None, status: TournamentStatus | None = None,
    staff: User = Depends(require_permission(Permission.TOURNAMENTS_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Todos os torneios (inclusive rascunho, nao listados e escondidos), mais recentes primeiro, ate' 200."""
    stmt = select(Tournament, Reader).join(Reader, Reader.id == Tournament.owner_id)
    if q and q.strip():
        like = "%" + escape_like(q.strip()) + "%"
        stmt = stmt.where(or_(Tournament.name.ilike(like, escape="\\"), Reader.username.ilike(like, escape="\\"), Reader.game_name.ilike(like, escape="\\")))
    if hidden is not None:
        stmt = stmt.where(Tournament.hidden.is_(hidden))
    if status is not None:
        stmt = stmt.where(Tournament.status == status)
    rows = (await db.execute(stmt.order_by(Tournament.created_at.desc()).limit(200))).all()
    ids = [t.id for t, _ in rows]
    counts = dict((await db.execute(select(TournamentEntry.tournament_id, func.count()).where(TournamentEntry.tournament_id.in_(ids)).group_by(TournamentEntry.tournament_id))).all()) if ids else {}
    return [ModerationRow(id=t.id, name=t.name, status=t.status, visibility=t.visibility, hidden=t.hidden, organizer_hidden=t.organizer_hidden, hidden_by=t.hidden_by, created_at=t.created_at,
                          owner_id=r.id, owner_name=r.game_name or r.username, owner_banned=r.banned, entry_count=counts.get(t.id, 0)) for t, r in rows]


async def _moderated(db: AsyncSession, tid: UUID) -> Tournament:
    """Torneio pelo id (a equipe ve' todos) ou 404."""
    t = await db.get(Tournament, tid)
    if t is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return t


@moderation_router.patch("/{tournament_id}")
async def moderate_tournament(tournament_id: UUID, payload: ModerationPatch, staff: User = Depends(require_permission(Permission.TOURNAMENTS_MANAGE)), db: AsyncSession = Depends(get_db)):
    """Esconde/mostra e/ou corrige nome e descricao. O log guarda so' o que mudou."""
    t = await _moderated(db, tournament_id)
    diff: dict = {}
    if payload.hidden is not None and payload.hidden != t.hidden:
        diff["hidden"] = [t.hidden, payload.hidden]
        t.hidden, t.hidden_by = payload.hidden, (staff.username if payload.hidden else None)
    if payload.name is not None and payload.name.strip() and payload.name.strip() != t.name:
        diff["name"] = [t.name, payload.name.strip()]
        t.name = payload.name.strip()
    if payload.description is not None and payload.description != t.description:
        diff["descriptionChanged"] = True
        t.description = payload.description
    if diff:
        await log_action(db, action="hide" if diff.get("hidden", [0, 0])[1] is True else "update", entity_type="tournament", entity_id=str(t.id), diff=diff, actor=staff)
    await db.commit()
    return {"ok": True}


@moderation_router.delete("/{tournament_id}", status_code=204)
async def moderate_delete(tournament_id: UUID, staff: User = Depends(require_permission(Permission.TOURNAMENTS_MANAGE)), db: AsyncSession = Depends(get_db)):
    """Apaga o torneio de vez (fica no log de auditoria)."""
    t = await _moderated(db, tournament_id)
    await log_action(db, action="delete", entity_type="tournament", entity_id=str(t.id), diff={"name": t.name}, actor=staff)
    await db.delete(t)
    await db.commit()
    return Response(status_code=204)
