"""
Edicao das permissoes de cada cargo pelo PAINEL - so' o S.Adm (permissao roles.manage, que e'
SUPER_ONLY: quem nao e' S.Adm recebe 404, como se a rota nao existisse).

  GET  /roles/permissions                      catalogo + o que cada cargo tem hoje
  PUT  /roles/{role}/permissions               define as permissoes do cargo (admin/creator)
  POST /roles/{role}/permissions/reset         volta o cargo ao padrao "de fabrica"

O S.Adm nao e' editavel (sempre tem tudo) e permissoes exclusivas dele nao podem ser dadas a
ninguem - assim nao existe jeito de trancar o proprio acesso ou de promover alguem por fora.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import role_config
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import (
    DEFAULT_ROLE_PERMISSIONS, EDITABLE_ROLES, ROLE_LABEL, ROLE_PERMISSIONS, SUPER_ONLY_PERMISSIONS, Permission,
)
from app.core.permissions import custom_permissions
from app.models.enums import StaffRole
from app.models.roles import CustomRole
from app.models.users import User
from app.schemas.roles import (
    CustomRoleRead, CustomRoleWrite, PermissionInfo, RolePermissionsRead, RolePermissionsWrite, RolesOverview,
)

router = APIRouter(prefix="/roles", tags=["roles"])

_GROUPS = {"content": "content", "posts": "posts", "lore": "lore", "uploads": "tools", "media": "tools", "translation": "tools",
           "notices": "notices", "announcement": "notices", "staff": "staff", "roles": "staff", "audit": "audit", "errors": "audit", "comments": "posts", "reports": "posts", "analytics": "audit"}


def _group(p: Permission) -> str:
    """Grupo (secao da tela) a que uma permissao pertence."""
    if p.value.startswith("media.cat."):
        return "imagecats"
    return _GROUPS.get(p.value.split(".")[0], "other")


MAX_CUSTOM_ROLES = 25
RESERVED_NAMES = {"s.adm", "adm", "admin", "administrator", "super admin", "super_admin", "creator", "owner", "dono"}


async def _custom_roles(db: AsyncSession) -> list[CustomRoleRead]:
    """Cargos personalizados (mais antigos primeiro) com a contagem de pessoas em cada um."""
    counts = dict((await db.execute(
        select(User.custom_role_id, func.count()).where(User.custom_role_id.is_not(None)).group_by(User.custom_role_id))).all())
    rows = (await db.execute(select(CustomRole).order_by(CustomRole.created_at, CustomRole.name))).scalars().all()
    return [CustomRoleRead(id=r.id, name=r.name, color=r.color, description=r.description,
                           permissions=sorted(p.value for p in custom_permissions(r.permissions)), members=counts.get(r.id, 0)) for r in rows]


async def _overview(db: AsyncSession) -> RolesOverview:
    """Monta a visao completa: catalogo de permissoes + o que cada cargo tem hoje + cargos personalizados."""
    return RolesOverview(
        custom_roles=await _custom_roles(db),
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
        raise HTTPException(status_code=400, detail="The S.Adm role always has every permission and cannot be edited")
    return role


@router.get("/permissions", response_model=RolesOverview)
async def get_overview(
    staff: User = Depends(require_permission(Permission.ROLES_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Tela de permissoes: devolve catalogo e permissoes atuais de cada cargo (so' S.Adm)."""
    await role_config.load_overrides(db)
    return await _overview(db)


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
        raise HTTPException(status_code=422, detail=f"Unknown permission: {unknown[0]}")
    wanted = {by_name[n] for n in payload.permissions}
    forbidden = wanted & SUPER_ONLY_PERMISSIONS
    if forbidden:
        raise HTTPException(status_code=400, detail=f"The permission '{sorted(p.value for p in forbidden)[0]}' is exclusive to S.Adm")
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
    return await _overview(db)


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
    return await _overview(db)


# ---------------- cargos personalizados ----------------

def _validated_permissions(names: list[str]) -> list[str]:
    """Confere a lista de permissoes de um cargo personalizado: so' as que existem e que podem ser dadas (nada exclusivo do S.Adm)."""
    by_name = {p.value: p for p in Permission}
    for n in names:
        if n not in by_name:
            raise HTTPException(status_code=422, detail=f"Unknown permission: {n}")
        if by_name[n] in SUPER_ONLY_PERMISSIONS:
            raise HTTPException(status_code=400, detail=f"The permission '{n}' is exclusive to S.Adm")
    return sorted(set(names))


async def _check_name_free(db: AsyncSession, name: str, own_id: UUID | None = None) -> None:
    """Recusa (409) nome ja' usado por outro cargo personalizado ou igual a um cargo de fabrica (sem diferenciar maiusculas)."""
    if name.lower() in RESERVED_NAMES:
        raise HTTPException(status_code=409, detail="This name is reserved for a built-in role")
    clash = (await db.execute(select(CustomRole).where(func.lower(CustomRole.name) == name.lower()))).scalars().first()
    if clash is not None and clash.id != own_id:
        raise HTTPException(status_code=409, detail="There is already a role with this name")


@router.post("/custom", response_model=RolesOverview, status_code=201)
async def create_custom_role(
    payload: CustomRoleWrite,
    staff: User = Depends(require_permission(Permission.ROLES_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Cria um cargo personalizado (so' S.Adm): nome, cor, descricao e permissoes."""
    total = (await db.execute(select(func.count()).select_from(CustomRole))).scalar_one()
    if total >= MAX_CUSTOM_ROLES:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_CUSTOM_ROLES} custom roles")
    await _check_name_free(db, payload.name)
    perms = _validated_permissions(payload.permissions)
    role = CustomRole(name=payload.name, color=payload.color, description=payload.description, permissions=perms)
    db.add(role)
    await db.flush()
    await log_action(db, action="create", entity_type="roles", entity_id=payload.name,
                     diff={"customRole": payload.name, "permissions": perms}, actor=staff)
    await db.commit()
    return await _overview(db)


@router.put("/custom/{role_id}", response_model=RolesOverview)
async def update_custom_role(
    role_id: UUID, payload: CustomRoleWrite,
    staff: User = Depends(require_permission(Permission.ROLES_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Edita nome, cor, descricao e permissoes de um cargo personalizado; vale na hora para quem tem o cargo."""
    role = await db.get(CustomRole, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Custom role not found")
    await _check_name_free(db, payload.name, role.id)
    perms = _validated_permissions(payload.permissions)
    before = {p.value for p in custom_permissions(role.permissions)}
    renamed_from = role.name if role.name != payload.name else None
    role.name, role.color, role.description, role.permissions = payload.name, payload.color, payload.description, perms
    await log_action(db, action="update", entity_type="roles", entity_id=payload.name,
                     diff={"customRole": payload.name, "renamedFrom": renamed_from,
                           "added": sorted(set(perms) - before), "removed": sorted(before - set(perms))}, actor=staff)
    await db.commit()
    return await _overview(db)


@router.delete("/custom/{role_id}", response_model=RolesOverview)
async def delete_custom_role(
    role_id: UUID,
    staff: User = Depends(require_permission(Permission.ROLES_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Apaga um cargo personalizado - so' se ninguem o tiver (senao 409: mude essas pessoas de cargo antes)."""
    role = await db.get(CustomRole, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Custom role not found")
    members = (await db.execute(select(func.count()).select_from(User).where(User.custom_role_id == role_id))).scalar_one()
    if members:
        raise HTTPException(status_code=409, detail=f"{members} {'person has' if members == 1 else 'people have'} this role. Move them to another role first")
    name = role.name
    await db.delete(role)
    await log_action(db, action="delete", entity_type="roles", entity_id=name, diff={"customRole": name}, actor=staff)
    await db.commit()
    return await _overview(db)
