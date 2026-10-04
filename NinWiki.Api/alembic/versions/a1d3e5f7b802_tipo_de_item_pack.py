"""itens: tipo de item 'Pack' (catalogo Pack)

Revision ID: a1d3e5f7b802
Revises: f8c0d2e4a790
Create Date: 2026-10-04 20:00:00.000000

ALTER TYPE ... ADD VALUE (o autogenerate nao detecta). O rotulo no banco e' o NOME do membro em MAIUSCULO (PACK), como nos outros enums.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a1d3e5f7b802'
down_revision: Union[str, Sequence[str], None] = 'f8c0d2e4a790'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta o valor novo (sem usa-lo nesta transacao)."""
    op.execute("ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'PACK'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: o valor fica no tipo (inofensivo); so' garante que nenhuma linha o use."""
    op.execute("UPDATE content_items SET item_type = 'GENERAL' WHERE item_type = 'PACK'")
