"""itens: tipos de roupa Shirt, Vest, Pant, Hat, Mask e Shoe

Revision ID: d6a8b0c2e467
Revises: c5f7a9b1d356
Create Date: 2026-10-04 17:00:00.000000

ALTER TYPE ... ADD VALUE (o autogenerate nao detecta). O rotulo no banco e' o NOME do membro em MAIUSCULO, como nos outros enums.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd6a8b0c2e467'
down_revision: Union[str, Sequence[str], None] = 'c5f7a9b1d356'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_VALUES = ["SHIRT", "VEST", "PANT", "HAT", "MASK", "SHOE"]


def upgrade() -> None:
    """Acrescenta os valores novos (sem usa-los nesta transacao)."""
    for value in NEW_VALUES:
        op.execute(f"ALTER TYPE item_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: os valores ficam no tipo (inofensivos); so' garante que nenhuma linha os use."""
    op.execute("UPDATE content_items SET item_type = 'GENERAL' WHERE item_type IN ('SHIRT', 'VEST', 'PANT', 'HAT', 'MASK', 'SHOE')")
