"""Schemas de /roles (edicao de permissoes por cargo, so' S.Adm) e /notices (quadro de avisos)."""
import uuid
from datetime import datetime

from pydantic import Field

from app.models.enums import StaffRole
from app.schemas.content import CamelModel


class PermissionInfo(CamelModel):
    name: str
    group: str
    super_only: bool            # exclusiva do S.Adm: nao pode ser dada a outro cargo
    defaults: dict[str, bool]   # padrao "de fabrica" por cargo editavel


class RolePermissionsRead(CamelModel):
    role: StaffRole
    label: str
    editable: bool
    permissions: list[str]      # o que o cargo tem HOJE


class RolesOverview(CamelModel):
    roles: list[RolePermissionsRead]
    permissions: list[PermissionInfo]


class RolePermissionsWrite(CamelModel):
    permissions: list[str]


class NoticeFileRead(CamelModel):
    id: uuid.UUID
    filename: str
    size: int


class NoticeRead(CamelModel):
    id: uuid.UUID
    title: str
    body: str
    pinned: bool
    author_name: str | None
    created_at: datetime
    updated_at: datetime
    files: list[NoticeFileRead] = []


class NoticeWrite(CamelModel):
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(default="", max_length=5000)
    pinned: bool = False
