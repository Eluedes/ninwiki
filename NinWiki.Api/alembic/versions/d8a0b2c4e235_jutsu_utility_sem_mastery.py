"""jutsus: categoria Utility (jutsu sem mastery - qualquer pessoa pode usar)

Revision ID: d8a0b2c4e235
Revises: c4f6a8b0d124
Create Date: 2026-10-04 23:00:00.000000

jutsus.mastery_id passa a aceitar NULL: NULL = jutsu de Utilidade (nao e' mastery). Jutsus atuais continuam com a mastery que ja' tem.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd8a0b2c4e235'
down_revision: Union[str, Sequence[str], None] = 'c4f6a8b0d124'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Permite NULL em mastery_id."""
    op.alter_column('jutsus', 'mastery_id', existing_type=sa.String(length=50), nullable=True)


def downgrade() -> None:
    """Volta a exigir mastery: jutsus de Utilidade (sem mastery) sao APAGADOS, porque nao teriam onde ficar."""
    op.execute("DELETE FROM jutsus WHERE mastery_id IS NULL")
    op.alter_column('jutsus', 'mastery_id', existing_type=sa.String(length=50), nullable=False)
