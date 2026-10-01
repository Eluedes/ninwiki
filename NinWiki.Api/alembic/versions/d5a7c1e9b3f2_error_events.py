"""error_events: registro de erros e problemas do wiki

Revision ID: d5a7c1e9b3f2
Revises: c3e8a5b1d9f4
Create Date: 2026-10-02 18:00:00.000000

Tabela nova (nada existente muda). Ver app/models/errors.py e app/core/error_log.py.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd5a7c1e9b3f2'
down_revision: Union[str, Sequence[str], None] = 'c3e8a5b1d9f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'error_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('fingerprint', sa.String(length=40), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('level', sa.String(length=10), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('location', sa.String(length=300), nullable=True),
        sa.Column('path', sa.String(length=300), nullable=True),
        sa.Column('method', sa.String(length=10), nullable=True),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('trace', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('first_seen', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_error_events_fingerprint'), 'error_events', ['fingerprint'], unique=True)
    op.create_index(op.f('ix_error_events_last_seen'), 'error_events', ['last_seen'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_error_events_last_seen'), table_name='error_events')
    op.drop_index(op.f('ix_error_events_fingerprint'), table_name='error_events')
    op.drop_table('error_events')
