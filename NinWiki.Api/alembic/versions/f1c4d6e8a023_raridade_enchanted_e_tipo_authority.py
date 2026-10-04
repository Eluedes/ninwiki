"""itens: raridade 'Enchanted' e tipo de item 'Authority'

Revision ID: f1c4d6e8a023
Revises: e8b3c5d7f912
Create Date: 2026-10-04 13:00:00.000000

ALTER TYPE ... ADD VALUE (o autogenerate do Alembic nao detecta valores novos de ENUM do Postgres). O rotulo no banco e' o NOME do
membro em MAIUSCULO (ENCHANTED / AUTHORITY), como em todos os outros enums do projeto.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f1c4d6e8a023'
down_revision: Union[str, Sequence[str], None] = 'e8b3c5d7f912'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta os dois valores novos (sem usa-los nesta transacao)."""
    op.execute("ALTER TYPE rarity ADD VALUE IF NOT EXISTS 'ENCHANTED'")
    op.execute("ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'AUTHORITY'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: os valores ficam no tipo (inofensivos); so' garante que nenhuma linha os use."""
    op.execute("UPDATE content_items SET rarity = 'COMMON' WHERE rarity = 'ENCHANTED'")
    op.execute("UPDATE content_items SET item_type = 'GENERAL' WHERE item_type = 'AUTHORITY'")
