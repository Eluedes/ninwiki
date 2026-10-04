"""acessos ao site: contagem por estado e cidade (traffic_places)

Revision ID: c5f7a9b1d356
Revises: b3e5f7a9c245
Create Date: 2026-10-04 16:00:00.000000

So' contagens (sem IP): dia + pais + estado + cidade. Preenchida a partir dos cabecalhos de localizacao da Cloudflare.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c5f7a9b1d356'
down_revision: Union[str, Sequence[str], None] = 'b3e5f7a9c245'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a tabela."""
    op.create_table(
        'traffic_places',
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('country', sa.String(length=2), nullable=False),
        sa.Column('region', sa.String(length=100), server_default='', nullable=False),
        sa.Column('city', sa.String(length=100), server_default='', nullable=False),
        sa.Column('views', sa.Integer(), server_default='0', nullable=False),
        sa.Column('visitors', sa.Integer(), server_default='0', nullable=False),
        sa.PrimaryKeyConstraint('day', 'country', 'region', 'city'),
    )


def downgrade() -> None:
    """Apaga a tabela."""
    op.drop_table('traffic_places')
