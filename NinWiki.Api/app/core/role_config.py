"""
Carrega/salva os ajustes de permissao por cargo (tabela role_permissions).

As permissoes efetivas vivem em memoria (app/core/permissions.py::ROLE_PERMISSIONS) pra
has_permission() continuar sincrona e rapida. Este modulo as mantem em dia:
  - refresh_if_stale(): chamado a cada requisicao autenticada, relê o banco no maximo
    a cada TTL segundos (cobre mais de uma instancia da API rodando);
  - save_role_permissions(): grava o que o S.Adm escolheu e recarrega na hora.
"""
import time

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import (
    DEFAULT_ROLE_PERMISSIONS, EDITABLE_ROLES, Permission, apply_overrides, grantable_permissions,
)
from app.models.enums import StaffRole
from app.models.roles import RolePermission

TTL_SECONDS = 15
_loaded_at: float = 0.0


async def load_overrides(db: AsyncSession) -> None:
    global _loaded_at
    rows = (await db.execute(select(RolePermission))).scalars().all()
    overrides: dict[StaffRole, dict[str, bool]] = {}
    for r in rows:
        overrides.setdefault(r.role, {})[r.permission] = r.granted
    apply_overrides(overrides)
    _loaded_at = time.monotonic()


async def refresh_if_stale(db: AsyncSession) -> None:
    if time.monotonic() - _loaded_at >= TTL_SECONDS:
        await load_overrides(db)


def invalidate() -> None:
    """Forca a proxima requisicao a reler o banco (usado pelos testes)."""
    global _loaded_at
    _loaded_at = 0.0


async def save_role_permissions(db: AsyncSession, role: StaffRole, granted: set[Permission]) -> None:
    """
    Define EXATAMENTE quais permissoes `role` passa a ter. Guarda so' as DIFERENCAS em relacao ao
    padrao (assim, se o padrao mudar no codigo, o que nao foi tocado acompanha). Nao faz commit.
    """
    if role not in EDITABLE_ROLES:
        raise ValueError("Esse cargo não pode ser editado")
    allowed = set(grantable_permissions())
    granted = granted & allowed
    default = set(DEFAULT_ROLE_PERMISSIONS[role]) & allowed
    await db.execute(delete(RolePermission).where(RolePermission.role == role))
    for perm in allowed:
        if (perm in granted) != (perm in default):
            db.add(RolePermission(role=role, permission=perm.value, granted=perm in granted))


async def reset_role(db: AsyncSession, role: StaffRole) -> None:
    if role not in EDITABLE_ROLES:
        raise ValueError("Esse cargo não pode ser editado")
    await db.execute(delete(RolePermission).where(RolePermission.role == role))
