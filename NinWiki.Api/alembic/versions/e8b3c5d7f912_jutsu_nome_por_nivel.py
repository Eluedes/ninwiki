"""jutsus: nome por nivel (o jutsu pode mudar de nome ao subir de nivel, ex.: nivel 4)

Revision ID: e8b3c5d7f912
Revises: d7a2b9c4e150
Create Date: 2026-10-04 12:00:00.000000

Coluna nova `name_by_level` (lista de textos, um por nivel; vazio = o nome nao muda). Jutsus antigos continuam validos.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e8b3c5d7f912'
down_revision: Union[str, Sequence[str], None] = 'd7a2b9c4e150'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a coluna com lista vazia como padrao."""
    op.add_column('jutsus', sa.Column('name_by_level', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))


def downgrade() -> None:
    """Remove a coluna."""
    op.drop_column('jutsus', 'name_by_level')
