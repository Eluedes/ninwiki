"""modo manutencao do site (tabela site_maintenance)

Revision ID: b2e4a6c8d0f1
Revises: a1d3f5b7c9e2
Create Date: 2026-10-19 22:00:00.000000

Cria a tabela de uma linha com o estado do modo manutencao (ligado/desligado + mensagem opcional em ingles e portugues). So' cria tabela nova;
comeca desligado (sem linha = desligado).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b2e4a6c8d0f1'
down_revision: Union[str, Sequence[str], None] = 'a1d3f5b7c9e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Tabela nova, sem mexer em nada que ja' existe."""
    op.create_table(
        'site_maintenance',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('message', sa.String(length=300), server_default='', nullable=False),
        sa.Column('message_pt', sa.String(length=300), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('site_maintenance')
