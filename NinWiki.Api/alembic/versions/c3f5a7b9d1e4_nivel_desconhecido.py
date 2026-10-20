"""conteudo: nivel desconhecido (content_items.level_unknown)

Revision ID: c3f5a7b9d1e4
Revises: b2e4a6c8d0f1
Create Date: 2026-10-20 10:00:00.000000

Quando ainda nao se sabe o nivel de um mob/arma/missao/item, a equipe marca "nivel desconhecido" e o site mostra "???" no lugar do numero.
Coluna nova com padrao falso: nenhuma entry existente muda de comportamento.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c3f5a7b9d1e4'
down_revision: Union[str, Sequence[str], None] = 'b2e4a6c8d0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Coluna nova, padrao falso (nada muda para quem ja' existe)."""
    op.add_column('content_items', sa.Column('level_unknown', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('content_items', 'level_unknown')
