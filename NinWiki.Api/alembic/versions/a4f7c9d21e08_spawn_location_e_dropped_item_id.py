"""adiciona spawn_location em content_items e dropped_item_id em content_item_drops

Revision ID: a4f7c9d21e08
Revises: 1367338a8c33
Create Date: 2026-09-22 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a4f7c9d21e08'
down_revision: Union[str, Sequence[str], None] = '1367338a8c33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('content_items', sa.Column('spawn_location', sa.String(length=300), nullable=True))
    op.add_column('content_item_drops', sa.Column('dropped_item_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'content_item_drops_dropped_item_id_fkey',
        'content_item_drops', 'content_items',
        ['dropped_item_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('content_item_drops_dropped_item_id_fkey', 'content_item_drops', type_='foreignkey')
    op.drop_column('content_item_drops', 'dropped_item_id')
    op.drop_column('content_items', 'spawn_location')
