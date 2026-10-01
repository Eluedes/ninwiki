"""Ajustes de permissao por cargo feitos pelo S.Adm no painel (ver app/core/role_config.py)."""
from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import StaffRole


class RolePermission(Base):
    """
    Uma linha = "para este cargo, esta permissao esta' liberada (True) ou bloqueada (False)",
    DIFERENTE do padrao de app/core/permissions.py. Sem linha = vale o padrao.
    """
    __tablename__ = "role_permissions"

    role: Mapped[StaffRole] = mapped_column(Enum(StaffRole, name="staff_role"), primary_key=True)
    permission: Mapped[str] = mapped_column(String(50), primary_key=True)
    granted: Mapped[bool] = mapped_column(Boolean)
