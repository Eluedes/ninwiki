"""categoria do banco de imagens

Revision ID: c4e8a1d92f37
Revises: 7b16dcfc1960
Create Date: 2026-10-03 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e8a1d92f37'
down_revision: Union[str, Sequence[str], None] = '7b16dcfc1960'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Adiciona media_images.category (filtro por categoria no painel de imagens)."""
    op.add_column('media_images', sa.Column('category', sa.String(length=20), server_default='', nullable=False))
    op.create_index(op.f('ix_media_images_category'), 'media_images', ['category'], unique=False)


def downgrade() -> None:
    """Remove a coluna de categoria."""
    op.drop_index(op.f('ix_media_images_category'), table_name='media_images')
    op.drop_column('media_images', 'category')
