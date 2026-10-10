"""content_versions: historico de versoes das entries (desfazer edicao)

Revision ID: e1d3f5a7b982
Revises: d9c1e3f5a768
Create Date: 2026-10-08 15:00:00.000000

Tabela nova (nada existente muda). Ver ContentVersion em app/models/content.py.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e1d3f5a7b982'
down_revision: Union[str, Sequence[str], None] = 'd9c1e3f5a768'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'content_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('content_item_id', sa.UUID(), nullable=False),
        sa.Column('snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('saved_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_content_versions_content_item_id'), 'content_versions', ['content_item_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_content_versions_content_item_id'), table_name='content_versions')
    op.drop_table('content_versions')
