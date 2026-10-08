"""content_items.translation_auto: marca o conteudo cujo portugues veio da traducao automatica

Revision ID: f2e4a6b8c093
Revises: e1d3f5a7b982
Create Date: 2026-10-08 17:00:00.000000

Coluna nova com padrao false (conteudo antigo fica sem selo: nao da' para saber de onde veio o portugues dele).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f2e4a6b8c093'
down_revision: Union[str, Sequence[str], None] = 'e1d3f5a7b982'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('content_items', sa.Column('translation_auto', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('content_items', 'translation_auto')
