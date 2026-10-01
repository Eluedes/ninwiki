"""
Equipe (staff) do painel admin e log geral do sistema - Fase 2.

A tabela `users` guarda SOMENTE a equipe (S.Adm / Adm / Creator): o
site publico nao tem conta de leitor, entao quem nao esta' aqui nao
entra no painel (mesmo tendo um Discord valido).
"""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import StaffRole


class User(Base, TimestampMixin):
    """Um membro da equipe. Ver StaffRole (app/models/enums.py) pros cargos."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Snowflake do Discord (ex: "123456789012345678") - BigInteger e
    # nao String, porque e' um numero de verdade e cabe num int64.
    # unique=True: um Discord ID so' pode estar ligado a UM usuario.
    discord_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[StaffRole] = mapped_column(Enum(StaffRole, name="staff_role"), default=StaffRole.CREATOR)

    # Desativar = a pessoa perde o acesso NA HORA (a API confere isso a
    # cada requisicao), mas o registro e o historico dela continuam - por
    # isso desativa em vez de apagar.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # "Versao" da sessao: a cada mudanca de cargo/desativacao ela sobe, e
    # todo login antigo (que carrega a versao velha) deixa de valer sozinho.
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Quem cadastrou (NULL = veio do SUPER_ADMIN_DISCORD_IDS do .env ou de antes desse campo existir).
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLogEntry(Base):
    """
    Log GERAL do sistema: quem fez o que, quando, de onde. Guarda tanto
    o trabalho de conteudo (entity_type = content_item, jutsu, mastery)
    quanto eventos de seguranca (entity_type = auth, staff, security).

    `diff` guarda o que mudou em formato JSON (ex: {"field": "level",
    "before": 5, "after": 8}) - JSONB (nao JSON puro) porque o
    Postgres consegue indexar/consultar dentro dele se um dia precisar.

    actor_name/actor_role sao uma FOTOGRAFIA do momento: se a pessoa for
    renomeada ou promovida depois, o log continua mostrando quem ela
    era quando fez a acao (e, se o usuario for apagado, o log nao perde
    a informacao - user_id vira NULL mas o nome fica).
    """
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(50))  # ex: "create", "update", "delete", "login", "permission_denied"
    entity_type: Mapped[str] = mapped_column(String(50))  # ex: "content_item", "mastery", "auth", "staff", "security"
    entity_id: Mapped[str] = mapped_column(String(100))  # guarda como texto pra caber tanto UUID quanto id-texto
    diff: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # index=True: o log geral so' cresce, e a tela sempre pede "os mais recentes primeiro".
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), index=True)

    actor_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # De onde veio a acao: "panel" (painel web), "bot" (Discord), "auth"
    # (login/logout), "system" (rotina automatica). Linhas antigas, de
    # antes desse campo existir, todas vieram do painel.
    source: Mapped[str] = mapped_column(String(20), default="panel", server_default="panel")
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    user: Mapped["User | None"] = relationship()
