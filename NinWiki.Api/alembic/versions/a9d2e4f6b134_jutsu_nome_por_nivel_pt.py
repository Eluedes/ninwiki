"""jutsus: traducao (PT) do nome por nivel

Revision ID: a9d2e4f6b134
Revises: f1c4d6e8a023
Create Date: 2026-10-04 14:00:00.000000

Coluna `name_by_level_pt` (lista de textos alinhada com `name_by_level`): preenchida pela DeepL ao salvar o jutsu; vazio = sem traducao.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a9d2e4f6b134'
down_revision: Union[str, Sequence[str], None] = 'f1c4d6e8a023'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a coluna com lista vazia como padrao."""
    op.add_column('jutsus', sa.Column('name_by_level_pt', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))


def downgrade() -> None:
    """Remove a coluna."""
    op.drop_column('jutsus', 'name_by_level_pt')
