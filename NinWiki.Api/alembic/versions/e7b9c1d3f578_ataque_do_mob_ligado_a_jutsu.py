"""ataques dos mobs: ligacao opcional com um jutsu do catalogo (jutsu_id)

Revision ID: e7b9c1d3f578
Revises: d6a8b0c2e467
Create Date: 2026-10-04 18:00:00.000000

Coluna nullable: ataques antigos (so' texto) continuam validos. Apagar o jutsu so' desliga a ligacao (SET NULL).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e7b9c1d3f578'
down_revision: Union[str, Sequence[str], None] = 'd6a8b0c2e467'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a coluna e a chave estrangeira."""
    op.add_column('content_item_attacks', sa.Column('jutsu_id', sa.String(length=80), nullable=True))
    op.create_foreign_key('content_item_attacks_jutsu_id_fkey', 'content_item_attacks', 'jutsus', ['jutsu_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Remove a chave e a coluna."""
    op.drop_constraint('content_item_attacks_jutsu_id_fkey', 'content_item_attacks', type_='foreignkey')
    op.drop_column('content_item_attacks', 'jutsu_id')
