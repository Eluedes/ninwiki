"""Ajustes de permissao por cargo feitos pelo S.Adm no painel (ver app/core/role_config.py)."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
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


class CustomRole(Base):
    """
    Cargo CRIADO pelo S.Adm no painel (ex.: "Tradutor", "Moderador", "Redator"). Fica no mesmo nivel do Creator na hierarquia (nunca
    gerencia a equipe) e tem as permissoes escolhidas aqui. Quem recebe este cargo continua com `users.role = creator` por baixo:
    se o cargo for apagado/ignorado, a pessoa nunca ganha mais poder do que um Creator.
    """
    __tablename__ = "custom_roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(30), unique=True)
    color: Mapped[str] = mapped_column(String(7), default="#64748b", server_default="#64748b")  # "#rrggbb"
    description: Mapped[str] = mapped_column(String(200), default="", server_default="")
    permissions: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")        # nomes das permissoes liberadas
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
