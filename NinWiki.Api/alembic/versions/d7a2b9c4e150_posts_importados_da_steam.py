"""posts importados da steam

Revision ID: d7a2b9c4e150
Revises: c4e8a1d92f37
Create Date: 2026-10-03 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7a2b9c4e150'
down_revision: Union[str, Sequence[str], None] = 'c4e8a1d92f37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Adiciona posts.source_id (unico), source_url e author_label (posts importados da Steam)."""
    op.add_column('posts', sa.Column('source_id', sa.String(length=100), nullable=True))
    op.add_column('posts', sa.Column('source_url', sa.String(length=500), nullable=True))
    op.add_column('posts', sa.Column('author_label', sa.String(length=100), nullable=True))
    op.create_unique_constraint('uq_posts_source_id', 'posts', ['source_id'])


def downgrade() -> None:
    """Remove as colunas da importacao."""
    op.drop_constraint('uq_posts_source_id', 'posts', type_='unique')
    op.drop_column('posts', 'author_label')
    op.drop_column('posts', 'source_url')
    op.drop_column('posts', 'source_id')
