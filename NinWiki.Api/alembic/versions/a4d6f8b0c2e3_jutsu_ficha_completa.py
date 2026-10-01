"""jutsus: ficha completa (requisitos, aquisicao, detalhes por nivel, dados de batalha) e tier maximo 4

Revision ID: a4d6f8b0c2e3
Revises: f2b4d6a8c0e1
Create Date: 2026-10-04 15:00:00.000000

Colunas novas com valor padrao (jutsus antigos continuam validos; linha vazia nao aparece na pagina). Jutsu com tier 5
(o maximo antigo) passa para 4, o novo maximo.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a4d6f8b0c2e3'
down_revision: Union[str, Sequence[str], None] = 'f2b4d6a8c0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TEXT_COLUMNS = [("required_level", 50), ("required_stat", 100), ("scroll_type", 100), ("shop", 100),
                ("cast_type", 100), ("jutsu_class", 100), ("debuff", 150)]
JSON_COLUMNS = ["damage_by_level", "cooldown_by_level", "battle_extra"]


def upgrade() -> None:
    """Cria as colunas da ficha e limita o tier a 4."""
    for name, size in TEXT_COLUMNS:
        op.add_column('jutsus', sa.Column(name, sa.String(length=size), server_default='', nullable=False))
    op.add_column('jutsus', sa.Column('max_level', sa.Integer(), server_default='1', nullable=False))
    for name in JSON_COLUMNS:
        op.add_column('jutsus', sa.Column(name, postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.execute("UPDATE jutsus SET tier = 4 WHERE tier > 4")


def downgrade() -> None:
    """Remove as colunas da ficha (o tier que virou 4 continua 4)."""
    for name in JSON_COLUMNS:
        op.drop_column('jutsus', name)
    op.drop_column('jutsus', 'max_level')
    for name, _ in reversed(TEXT_COLUMNS):
        op.drop_column('jutsus', name)
