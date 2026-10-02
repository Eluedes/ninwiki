"""acessos ao site: contagens por dia/pais/pagina (grafico e paises da Visao Geral)

Revision ID: c6f8a0b2d4e5
Revises: b5e7a9c1d3f4
Create Date: 2026-10-06 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c6f8a0b2d4e5'
down_revision: Union[str, Sequence[str], None] = 'b5e7a9c1d3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria traffic_daily, traffic_pages e traffic_visitors."""
    op.create_table(
        'traffic_daily',
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('country', sa.String(length=2), nullable=False),
        sa.Column('views', sa.Integer(), server_default='0', nullable=False),
        sa.Column('visitors', sa.Integer(), server_default='0', nullable=False),
        sa.PrimaryKeyConstraint('day', 'country'),
    )
    op.create_table(
        'traffic_pages',
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('path', sa.String(length=200), nullable=False),
        sa.Column('views', sa.Integer(), server_default='0', nullable=False),
        sa.PrimaryKeyConstraint('day', 'path'),
    )
    op.create_table(
        'traffic_visitors',
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('visitor_hash', sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint('day', 'visitor_hash'),
    )


def downgrade() -> None:
    """Remove as tres tabelas."""
    op.drop_table('traffic_visitors')
    op.drop_table('traffic_pages')
    op.drop_table('traffic_daily')
