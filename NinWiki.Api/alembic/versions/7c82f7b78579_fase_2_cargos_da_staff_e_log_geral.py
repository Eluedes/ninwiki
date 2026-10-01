"""fase 2: cargos da staff (S.Adm/Adm/Creator) e log geral

Revision ID: 7c82f7b78579
Revises: f2be3e177c6f
Create Date: 2026-09-28 12:00:00.000000

O QUE FAZ:
1. Troca o enum de cargos antigo (user_role: ADMIN/EDITOR/VIEWER, nunca
   usado de verdade - nao existia login) pelo novo staff_role
   (SUPER_ADMIN/ADMIN/CREATOR). Se ja' existir alguma linha em `users`:
   ADMIN continua ADMIN; EDITOR e VIEWER viram CREATOR (o cargo mais
   restrito - nunca promove ninguem sem querer).
2. users: is_active, token_version, created_by_id, last_login_at.
3. audit_log: actor_name, actor_role, source, ip_address + indice em
   created_at (o log geral so' cresce e a tela pede "mais recentes primeiro").

Labels do enum em MAIUSCULO de proposito: e' assim que o SQLAlchemy
grava um Enum(StaffRole) (usa o NOME do membro, nao o valor).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7c82f7b78579'
down_revision: Union[str, Sequence[str], None] = 'f2be3e177c6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- 1) enum novo + troca do tipo da coluna role, preservando dados ---
    op.execute("CREATE TYPE staff_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CREATOR')")
    op.execute(
        "ALTER TABLE users ALTER COLUMN role TYPE staff_role USING ("
        "CASE role::text WHEN 'ADMIN' THEN 'ADMIN' ELSE 'CREATOR' END)::staff_role"
    )
    op.execute("DROP TYPE user_role")

    # --- 2) users ---
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('created_by_id', sa.UUID(), nullable=True))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('users_created_by_id_fkey', 'users', 'users', ['created_by_id'], ['id'], ondelete='SET NULL')

    # --- 3) audit_log (log geral) ---
    op.add_column('audit_log', sa.Column('actor_name', sa.String(length=100), nullable=True))
    op.add_column('audit_log', sa.Column('actor_role', sa.String(length=20), nullable=True))
    op.add_column('audit_log', sa.Column('source', sa.String(length=20), server_default='panel', nullable=False))
    op.add_column('audit_log', sa.Column('ip_address', sa.String(length=45), nullable=True))
    op.create_index(op.f('ix_audit_log_created_at'), 'audit_log', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_audit_log_created_at'), table_name='audit_log')
    op.drop_column('audit_log', 'ip_address')
    op.drop_column('audit_log', 'source')
    op.drop_column('audit_log', 'actor_role')
    op.drop_column('audit_log', 'actor_name')

    op.drop_constraint('users_created_by_id_fkey', 'users', type_='foreignkey')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'created_by_id')
    op.drop_column('users', 'token_version')
    op.drop_column('users', 'is_active')

    # Volta pro enum antigo: SUPER_ADMIN/ADMIN -> ADMIN, CREATOR -> EDITOR.
    op.execute("CREATE TYPE user_role AS ENUM ('ADMIN', 'EDITOR', 'VIEWER')")
    op.execute(
        "ALTER TABLE users ALTER COLUMN role TYPE user_role USING ("
        "CASE role::text WHEN 'CREATOR' THEN 'EDITOR' ELSE 'ADMIN' END)::user_role"
    )
    op.execute("DROP TYPE staff_role")
