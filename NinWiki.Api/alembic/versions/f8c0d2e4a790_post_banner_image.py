"""posts: banner_image (banner largo do topo do post, separado da miniatura cover_image)

Revision ID: f8c0d2e4a790
Revises: e7b9c1d3f578
Create Date: 2026-10-04 19:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f8c0d2e4a790'
down_revision: Union[str, Sequence[str], None] = 'e7b9c1d3f578'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a coluna (nula: posts antigos continuam usando a capa no topo)."""
    op.add_column('posts', sa.Column('banner_image', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Remove a coluna."""
    op.drop_column('posts', 'banner_image')
