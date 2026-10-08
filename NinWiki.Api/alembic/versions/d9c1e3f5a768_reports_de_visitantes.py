"""content_reports: reports de visitantes (conteudo desatualizado / erro de traducao)

Revision ID: d9c1e3f5a768
Revises: c3f5a7b9d024
Create Date: 2026-10-07 14:00:00.000000

Tabela nova (nada existente muda). Ver app/models/reports.py e app/api/reports.py.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd9c1e3f5a768'
down_revision: Union[str, Sequence[str], None] = 'c3f5a7b9d024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'content_reports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('target_type', sa.String(length=10), nullable=False),
        sa.Column('target_id', sa.String(length=150), nullable=False),
        sa.Column('target_name', sa.String(length=200), nullable=False),
        sa.Column('target_path', sa.String(length=300), nullable=False),
        sa.Column('kind', sa.String(length=12), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('locale', sa.String(length=5), nullable=True),
        sa.Column('status', sa.String(length=10), server_default='open', nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('handled_by', sa.String(length=100), nullable=True),
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_content_reports_status'), 'content_reports', ['status'], unique=False)
    op.create_index(op.f('ix_content_reports_created_at'), 'content_reports', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_content_reports_created_at'), table_name='content_reports')
    op.drop_index(op.f('ix_content_reports_status'), table_name='content_reports')
    op.drop_table('content_reports')
