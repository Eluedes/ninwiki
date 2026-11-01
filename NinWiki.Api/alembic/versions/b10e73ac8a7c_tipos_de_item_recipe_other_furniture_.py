"""tipos de item recipe other furniture food trophy

Revision ID: b10e73ac8a7c
Revises: 2e6a34cbe1d4
Create Date: 2026-11-01 15:12:32.120095

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b10e73ac8a7c'
down_revision: Union[str, Sequence[str], None] = '2e6a34cbe1d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta os tipos de item Recipe (receitas), Other (outros), Furniture (moveis), Food (comidas) e Trophy (trofeus); sem usa-los nesta transacao.
    O rotulo no banco e' o NOME do membro em MAIUSCULO, como nos outros enums."""
    for valor in ("RECIPE", "OTHER", "FURNITURE", "FOOD", "TROPHY"):
        op.execute(f"ALTER TYPE item_type ADD VALUE IF NOT EXISTS '{valor}'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: os valores ficam no tipo (inofensivo); so' garante que nenhuma linha os use."""
    op.execute("UPDATE content_items SET item_type = 'GENERAL' WHERE item_type IN ('RECIPE', 'OTHER', 'FURNITURE', 'FOOD', 'TROPHY')")
