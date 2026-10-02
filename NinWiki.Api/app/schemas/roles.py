"""Schemas de /roles (edicao de permissoes por cargo, so' S.Adm) e /notices (quadro de avisos)."""
import uuid
from datetime import datetime

import re

from pydantic import Field, field_validator

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


class CustomRoleRead(CamelModel):
    """Cargo personalizado como a tela mostra: nome, cor, o que pode e quantas pessoas tem este cargo."""
    id: uuid.UUID
    name: str
    color: str
    description: str
    permissions: list[str]
    members: int


class RolesOverview(CamelModel):
    """Visao completa da tela de permissoes (cargos + catalogo + cargos personalizados)."""
    roles: list[RolePermissionsRead]
    permissions: list[PermissionInfo]
    custom_roles: list[CustomRoleRead] = []


class CustomRoleWrite(CamelModel):
    """Corpo de criar/editar um cargo personalizado."""
    name: str = Field(min_length=1, max_length=30)
    color: str = "#64748b"
    description: str = Field(default="", max_length=200)
    permissions: list[str] = Field(default_factory=list, max_length=60)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        """Nome sem caracteres de controle nem espacos extras (1 a 30 caracteres)."""
        name = " ".join("".join(ch if ch.isprintable() else " " for ch in v).split())
        if not name:
            raise ValueError("The role name cannot be empty")
        return name[:30]

    @field_validator("color")
    @classmethod
    def _check_color(cls, v: str) -> str:
        """Cor no formato #rrggbb (vai para um estilo na tela, entao nada alem disso)."""
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", v.strip()):
            raise ValueError("Color must look like #rrggbb")
        return v.strip().lower()

    @field_validator("description")
    @classmethod
    def _clean_description(cls, v: str) -> str:
        """Descricao em uma linha so', sem caracteres de controle."""
        return " ".join("".join(ch if ch.isprintable() else " " for ch in v).split())


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
