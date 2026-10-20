"""conteudo: onde o item e' vendido por NPCs e a que preco (sold_at)

Revision ID: d6f8b0c2e5a7
Revises: c5e7a9b1d4f6
Create Date: 2026-10-19 10:00:00.000000

So' acrescenta uma coluna (nula): nenhuma linha existente muda.
  - sold_at: lista JSON [{shop, places, qty, price, currency}] - em que loja de NPC o item e' vendido, onde fica a loja, e quanto custa (qty = quantas unidades por esse preco;
    currency = nome do item usado como moeda, ex.: Ryo, Halloween Token).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd6f8b0c2e5a7'
down_revision: Union[str, Sequence[str], None] = 'c5e7a9b1d4f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('content_items', sa.Column('sold_at', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('content_items', 'sold_at')
