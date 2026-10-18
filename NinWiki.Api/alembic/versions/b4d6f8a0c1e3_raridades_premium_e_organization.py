"""itens: raridades 'Premium' e 'Organization' (como no Nin Atlas)

Revision ID: b4d6f8a0c1e3
Revises: a3f5b7c9d0e2
Create Date: 2026-10-18 19:00:00.000000

ALTER TYPE ... ADD VALUE (o autogenerate do Alembic nao detecta valores novos de ENUM do Postgres). O rotulo no banco e' o NOME do
membro em MAIUSCULO (PREMIUM / ORGANIZATION), como em todos os outros enums do projeto.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b4d6f8a0c1e3'
down_revision: Union[str, Sequence[str], None] = 'a3f5b7c9d0e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta os dois valores novos (sem usa-los nesta transacao)."""
    op.execute("ALTER TYPE rarity ADD VALUE IF NOT EXISTS 'PREMIUM'")
    op.execute("ALTER TYPE rarity ADD VALUE IF NOT EXISTS 'ORGANIZATION'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: os valores ficam no tipo (inofensivos); so' garante que nenhuma linha os use."""
    op.execute("UPDATE content_items SET rarity = 'COMMON' WHERE rarity IN ('PREMIUM', 'ORGANIZATION')")
    op.execute("UPDATE content_item_drops SET rarity = 'COMMON' WHERE rarity IN ('PREMIUM', 'ORGANIZATION')")
