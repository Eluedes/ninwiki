"""itens: raridade 'Unique'

Revision ID: b2e4f6a8c913
Revises: a1d3e5f7b802
Create Date: 2026-10-04 21:00:00.000000

ALTER TYPE ... ADD VALUE (o autogenerate nao detecta). O rotulo no banco e' o NOME do membro em MAIUSCULO (UNIQUE), como nos outros enums.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b2e4f6a8c913'
down_revision: Union[str, Sequence[str], None] = 'a1d3e5f7b802'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta o valor novo (sem usa-lo nesta transacao)."""
    op.execute("ALTER TYPE rarity ADD VALUE IF NOT EXISTS 'UNIQUE'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: o valor fica no tipo (inofensivo); so' garante que nenhuma linha o use."""
    op.execute("UPDATE content_items SET rarity = 'COMMON' WHERE rarity = 'UNIQUE'")
    op.execute("UPDATE content_item_drops SET rarity = 'COMMON' WHERE rarity = 'UNIQUE'")
