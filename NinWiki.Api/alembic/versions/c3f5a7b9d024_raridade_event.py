"""itens: raridade 'Event' (itens de evento)

Revision ID: c3f5a7b9d024
Revises: e9b1c3d5f346
Create Date: 2026-10-06 12:00:00.000000

ALTER TYPE ... ADD VALUE (o autogenerate do Alembic nao detecta valores novos de ENUM do Postgres). O rotulo no banco e' o NOME do membro em
MAIUSCULO (EVENT), como em todos os outros enums do projeto. O valor novo nao e' usado nesta mesma transacao.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c3f5a7b9d024'
down_revision: Union[str, Sequence[str], None] = 'e9b1c3d5f346'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta o valor 'EVENT' ao tipo `rarity` (usado por itens, armas e drops)."""
    op.execute("ALTER TYPE rarity ADD VALUE IF NOT EXISTS 'EVENT'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: o valor fica no tipo (inofensivo); so' garante que nenhuma linha o use."""
    op.execute("UPDATE content_items SET rarity = 'COMMON' WHERE rarity = 'EVENT'")
    op.execute("UPDATE content_item_drops SET rarity = 'COMMON' WHERE rarity = 'EVENT'")
