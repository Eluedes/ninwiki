"""jutsus: Jutsu NPC (is_npc) e armas permitidas (allowed_weapons)

Revision ID: e9b1c3d5f346
Revises: d8a0b2c4e235
Create Date: 2026-10-05 00:00:00.000000

Colunas novas com padrao (jutsus atuais continuam validos: is_npc=false, allowed_weapons vazio).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e9b1c3d5f346'
down_revision: Union[str, Sequence[str], None] = 'd8a0b2c4e235'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria as duas colunas."""
    op.add_column('jutsus', sa.Column('is_npc', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('jutsus', sa.Column('allowed_weapons', sa.String(length=100), server_default='', nullable=False))


def downgrade() -> None:
    """Remove as colunas."""
    op.drop_column('jutsus', 'allowed_weapons')
    op.drop_column('jutsus', 'is_npc')
