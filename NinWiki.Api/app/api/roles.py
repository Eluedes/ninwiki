"""
Edicao das permissoes de cada cargo pelo PAINEL - so' o S.Adm (permissao roles.manage, que e'
SUPER_ONLY: quem nao e' S.Adm recebe 404, como se a rota nao existisse).

  GET  /roles/permissions                      catalogo + o que cada cargo tem hoje
  PUT  /roles/{role}/permissions               define as permissoes do cargo (admin/creator)
  POST /roles/{role}/permissions/reset         volta o cargo ao padrao "de fabrica"

O S.Adm nao e' editavel (sempre tem tudo) e permissoes exclusivas dele nao podem ser dadas a
ninguem - assim nao existe jeito de trancar o proprio acesso ou de promover alguem por fora.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import role_config
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import (
    DEFAULT_ROLE_PERMISSIONS, EDITABLE_ROLES, ROLE_LABEL, ROLE_PERMISSIONS, SUPER_ONLY_PERMISSIONS, Permission,
)
from app.models.enums import StaffRole
from app.models.users import User
from app.schemas.roles import PermissionInfo, RolePermissionsRead, RolePermissionsWrite, RolesOverview

router = APIRouter(prefix="/roles", tags=["roles"])

_GROUPS = {"content": "content", "posts": "posts", "lore": "lore", "uploads": "tools", "translation": "tools",
           "notices": "notices", "staff": "staff", "roles": "staff", "audit": "audit"}


def _group(p: Permission) -> str:
    """Grupo (secao da tela) a que uma permissao pertence."""
    return _GROUPS.get(p.value.split(".")[0], "other")


def _overview() -> RolesOverview:
    """Monta a visao completa: catalogo de permissoes + o que cada cargo tem hoje."""
    return RolesOverview(
        roles=[
            RolePermissionsRead(
                role=r, label=ROLE_LABEL[r], editable=r in EDITABLE_ROLES,
                permissions=sorted(p.value for p in ROLE_PERMISSIONS[r]),
            )
            for r in (StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.CREATOR)
        ],
        permissions=[
            PermissionInfo(
                name=p.value, group=_group(p), super_only=p in SUPER_ONLY_PERMISSIONS,
                defaults={r.value: p in DEFAULT_ROLE_PERMISSIONS[r] for r in EDITABLE_ROLES},
            )
            for p in Permission
        ],
    )


def _editable_role(role: StaffRole) -> StaffRole:
    """Recusa (400) editar o cargo S.Adm - ele sempre tem tudo."""
    if role not in EDITABLE_ROLES:
        raise HTTPException(status_code=400, detail="O cargo S.Adm sempre tem todas as permissões e não pode ser editado")
    return role


@router.get("/permissions", response_model=RolesOverview)
async def get_overview(
    staff: User = Depends(require_permission(Permission.ROLES_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Tela de permissoes: devolve catalogo e permissoes atuais de cada cargo (so' S.Adm)."""
    await role_config.load_overrides(db)
    return _overview()


@router.put("/{role}/permissions", response_model=RolesOverview)
async def set_permissions(
    role: StaffRole, payload: RolePermissionsWrite,
    staff: User = Depends(require_permission(Permission.ROLES_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Define exatamente as permissoes de um cargo (Adm/Creator) e registra a mudanca no log."""
    _editable_role(role)
    by_name = {p.value: p for p in Permission}
    unknown = [n for n in payload.permissions if n not in by_name]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Permissão desconhecida: {unknown[0]}")
    wanted = {by_name[n] for n in payload.permissions}
    forbidden = wanted & SUPER_ONLY_PERMISSIONS
    if forbidden:
        raise HTTPException(status_code=400, detail=f"A permissão '{sorted(p.value for p in forbidden)[0]}' é exclusiva do S.Adm")
    await role_config.load_overrides(db)
    before = {p.value for p in ROLE_PERMISSIONS[role]}
    await role_config.save_role_permissions(db, role, wanted)
    after = {p.value for p in wanted}
    await log_action(
        db, action="update", entity_type="roles", entity_id=role.value,
        diff={"added": sorted(after - before), "removed": sorted(before - after)}, actor=staff,
    )
    await db.commit()
    await role_config.load_overrides(db)
    return _overview()


@router.post("/{role}/permissions/reset", response_model=RolesOverview)
async def reset_permissions(
    role: StaffRole,
    staff: User = Depends(require_permission(Permission.ROLES_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Volta as permissoes de um cargo ao padrao de fabrica."""
    _editable_role(role)
    await role_config.reset_role(db, role)
    await log_action(db, action="reset", entity_type="roles", entity_id=role.value, diff=None, actor=staff)
    await db.commit()
    await role_config.load_overrides(db)
    return _overview()
