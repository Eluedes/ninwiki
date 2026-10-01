"""Schemas de /roles (edicao de permissoes por cargo, so' S.Adm) e /notices (quadro de avisos)."""
import uuid
from datetime import datetime

from pydantic import Field

from app.models.enums import StaffRole
from app.schemas.content import CamelModel


class PermissionInfo(CamelModel):
    """Uma permissao do catalogo, com o padrao de fabrica de cada cargo."""
    name: str
    group: str
    super_only: bool            # exclusiva do S.Adm: nao pode ser dada a outro cargo
    defaults: dict[str, bool]   # padrao "de fabrica" por cargo editavel


class RolePermissionsRead(CamelModel):
    """Um cargo e as permissoes que ele tem hoje."""
    role: StaffRole
    label: str
    editable: bool
    permissions: list[str]      # o que o cargo tem HOJE


class RolesOverview(CamelModel):
    """Visao completa da tela de permissoes (cargos + catalogo)."""
    roles: list[RolePermissionsRead]
    permissions: list[PermissionInfo]


class RolePermissionsWrite(CamelModel):
    """Corpo de definir as permissoes de um cargo."""
    permissions: list[str]


class NoticeFileRead(CamelModel):
    """Arquivo anexado como a API devolve (id, nome e tamanho)."""
    id: uuid.UUID
    filename: str
    size: int


class NoticeRead(CamelModel):
    """Aviso do quadro como a API devolve."""
    id: uuid.UUID
    title: str
    body: str
    pinned: bool
    author_name: str | None
    created_at: datetime
    updated_at: datetime
    files: list[NoticeFileRead] = []


class NoticeWrite(CamelModel):
    """Corpo de criar/editar um aviso."""
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(default="", max_length=5000)
    pinned: bool = False
