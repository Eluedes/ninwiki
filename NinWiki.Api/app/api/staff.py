"""
Gerenciamento da equipe pelo PAINEL. Toda regra (hierarquia, dono, ultimo
S.Adm...) mora em app/core/staff_service.py - aqui so' traduz HTTP <-> servico.
O BOT usa o mesmo servico (ver app/api/bot.py).
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import staff_service
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.users import User
from app.schemas.staff import StaffCreate, StaffRead, StaffRoleUpdate

router = APIRouter(prefix="/staff", tags=["staff"])


def to_read(u: User) -> StaffRead:
    return StaffRead(
        id=u.id, discord_id=str(u.discord_id), username=u.username, avatar_url=u.avatar_url,
        role=u.role, is_active=u.is_active, is_owner=staff_service.is_owner(u),
        created_at=u.created_at, last_login_at=u.last_login_at,
    )


async def _get_or_404(db: AsyncSession, staff_id: UUID) -> User:
    target = await db.get(User, staff_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Membro da equipe não encontrado")
    return target


@router.get("", response_model=list[StaffRead])
async def list_staff(actor: User = Depends(require_permission(Permission.STAFF_VIEW)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return [to_read(u) for u in rows]


@router.post("", response_model=StaffRead, status_code=201)
async def create_staff(
    payload: StaffCreate, actor: User = Depends(require_permission(Permission.STAFF_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    user = await staff_service.add_staff(db, actor, int(payload.discord_id), payload.role, payload.username)
    await db.commit()
    return to_read(user)


@router.patch("/{staff_id}/role", response_model=StaffRead)
async def update_role(
    staff_id: UUID, payload: StaffRoleUpdate,
    actor: User = Depends(require_permission(Permission.STAFF_EDIT)), db: AsyncSession = Depends(get_db),
):
    target = await _get_or_404(db, staff_id)
    await staff_service.change_role(db, actor, target, payload.role)
    await db.commit()
    return to_read(target)


@router.post("/{staff_id}/deactivate", response_model=StaffRead)
async def deactivate(
    staff_id: UUID, actor: User = Depends(require_permission(Permission.STAFF_DEACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_or_404(db, staff_id)
    await staff_service.set_active(db, actor, target, False)
    await db.commit()
    return to_read(target)


@router.post("/{staff_id}/activate", response_model=StaffRead)
async def activate(
    staff_id: UUID, actor: User = Depends(require_permission(Permission.STAFF_DEACTIVATE)),
    db: AsyncSession = Depends(get_db),
):
    target = await _get_or_404(db, staff_id)
    await staff_service.set_active(db, actor, target, True)
    await db.commit()
    return to_read(target)
