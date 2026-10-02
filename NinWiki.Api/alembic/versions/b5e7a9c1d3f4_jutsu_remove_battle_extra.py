"""jutsus: remove battle_extra (linhas extras de Dados de batalha - nunca foram pedidas)

Revision ID: b5e7a9c1d3f4
Revises: a4d6f8b0c2e3
Create Date: 2026-10-05 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'b5e7a9c1d3f4'
down_revision: Union[str, Sequence[str], None] = 'a4d6f8b0c2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove a coluna jutsus.battle_extra."""
    op.drop_column('jutsus', 'battle_extra')


def downgrade() -> None:
    """Recria jutsus.battle_extra (vazia)."""
    op.add_column('jutsus', sa.Column('battle_extra', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
