"""staff: username_locked (nome editado a mao nao e' sobrescrito pelo login do Discord)

Revision ID: f2b4d6a8c0e1
Revises: e8b2d4f6a1c7
Create Date: 2026-10-04 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f2b4d6a8c0e1'
down_revision: Union[str, Sequence[str], None] = 'e8b2d4f6a1c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Adiciona users.username_locked (padrao false: todo mundo continua com o nome do Discord)."""
    op.add_column('users', sa.Column('username_locked', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Remove users.username_locked."""
    op.drop_column('users', 'username_locked')
