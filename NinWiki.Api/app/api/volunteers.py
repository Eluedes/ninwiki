"""
Inscricoes de voluntarios do projeto.

Publico (sem login, com defesas):
  POST   /volunteers/apply        envia uma inscricao (resposta generica, sem eco dos dados)

Painel (permissao volunteers.manage):
  GET    /volunteers              lista (filtros: status, busca q, paginacao limit/offset) + total + contador de novas
  GET    /volunteers/{id}         uma inscricao
  PATCH  /volunteers/{id}         muda status e/ou notas internas
  DELETE /volunteers/{id}         apaga (direito do voluntario de ter os dados excluidos)

Defesas do endpoint publico (como app/api/reports.py): so' a origem do nosso site, limite por IP (hora e dia, em memoria: o IP
NUNCA vai para o banco), campo "isca" anti-robo, consentimento obrigatorio, tamanhos maximos e um teto geral por dia.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.rate_limit import client_key, limiter, retry_message
from app.core.security import ensure_same_origin
from app.models.users import User
from app.models.volunteers import VolunteerApplication, VolunteerStatus
from app.schemas.volunteers import VolunteerApply, VolunteerListRead, VolunteerRead, VolunteerUpdate

router = APIRouter(prefix="/volunteers", tags=["volunteers"])

APPLY_PER_HOUR = 5       # por IP
APPLY_PER_DAY = 10       # por IP
MAX_NEW_PER_DAY = 100    # no site todo (um ataque nao consegue encher o painel)


@router.post("/apply", status_code=204)
async def apply(payload: VolunteerApply, request: Request, db: AsyncSession = Depends(get_db)):
    """Visitante se inscreve como voluntario. Publico: com todas as defesas descritas no topo do arquivo. Responde 204 sem eco."""
    ensure_same_origin(request)
    key = client_key()
    for bucket, limit, window in (("volunteers-hour", APPLY_PER_HOUR, 3600), ("volunteers-day", APPLY_PER_DAY, 86400)):
        wait = limiter.hit(bucket, key, limit, window)
        if wait is not None:
            raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    if payload.website.strip():
        return Response(status_code=204)   # robo preencheu a isca: finge que deu certo e descarta
    since = datetime.now(timezone.utc) - timedelta(days=1)
    recent = (await db.execute(select(func.count()).select_from(VolunteerApplication).where(VolunteerApplication.created_at > since))).scalar_one()
    if recent >= MAX_NEW_PER_DAY:
        raise HTTPException(status_code=503, detail="Applications are temporarily closed. Please try again tomorrow.")
    db.add(VolunteerApplication(
        name=payload.name, discord=payload.discord, game_nick=payload.game_nick, languages=payload.languages,
        areas=list(dict.fromkeys(payload.areas)), availability=payload.availability, experience=payload.experience,
        motivation=payload.motivation, contact_email=payload.contact_email, consent=True,
    ))
    await db.commit()
    return Response(status_code=204)


@router.get("", response_model=VolunteerListRead)
async def list_volunteers(
    status: VolunteerStatus | None = None,
    q: str | None = Query(None, max_length=80),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    staff: User = Depends(require_permission(Permission.VOLUNTEERS_MANAGE)),
    db: AsyncSession = Depends(get_db),
):
    """Lista as inscricoes (mais recentes primeiro), com filtro de status e busca por nome / Discord / nick."""
    where = []
    if status is not None:
        where.append(VolunteerApplication.status == status)
    if q and q.strip():
        like = "%" + q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        where.append(or_(*(c.ilike(like, escape="\\") for c in (VolunteerApplication.name, VolunteerApplication.discord, VolunteerApplication.game_nick))))
    total = (await db.execute(select(func.count()).select_from(VolunteerApplication).where(*where))).scalar_one()
    new_count = (await db.execute(select(func.count()).select_from(VolunteerApplication).where(VolunteerApplication.status == VolunteerStatus.NEW))).scalar_one()
    rows = (await db.execute(
        select(VolunteerApplication).where(*where).order_by(VolunteerApplication.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    return VolunteerListRead(items=[VolunteerRead.model_validate(r) for r in rows], total=total, new_count=new_count)


async def _get_or_404(db: AsyncSession, application_id: UUID) -> VolunteerApplication:
    """Acha a inscricao pelo id ou responde 404."""
    row = await db.get(VolunteerApplication, application_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return row


@router.get("/{application_id}", response_model=VolunteerRead)
async def get_volunteer(
    application_id: UUID, staff: User = Depends(require_permission(Permission.VOLUNTEERS_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Uma inscricao completa."""
    return await _get_or_404(db, application_id)


@router.patch("/{application_id}", response_model=VolunteerRead)
async def update_volunteer(
    application_id: UUID, body: VolunteerUpdate,
    staff: User = Depends(require_permission(Permission.VOLUNTEERS_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Muda o status e/ou as notas internas; registra quem avaliou e quando. O log guarda so' o que mudou (sem o texto das notas)."""
    row = await _get_or_404(db, application_id)
    diff: dict = {}
    if body.status is not None and body.status != row.status:
        diff["status"] = [row.status.value, body.status.value]
        row.status = body.status
    if body.staff_notes is not None:
        notes = body.staff_notes.strip() or None
        if notes != row.staff_notes:
            diff["notesChanged"] = True
            row.staff_notes = notes
    if diff:
        row.reviewed_by, row.reviewed_at = staff.username, datetime.now(timezone.utc)
        await log_action(db, action="update", entity_type="volunteer", entity_id=str(row.id), diff=diff, actor=staff)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{application_id}", status_code=204)
async def delete_volunteer(
    application_id: UUID, staff: User = Depends(require_permission(Permission.VOLUNTEERS_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Apaga a inscricao (pedido de exclusao de dados). O log nao guarda nome nem contato, so' o id."""
    row = await _get_or_404(db, application_id)
    await db.delete(row)
    await log_action(db, action="delete", entity_type="volunteer", entity_id=str(row.id), actor=staff)
    await db.commit()
    return Response(status_code=204)
