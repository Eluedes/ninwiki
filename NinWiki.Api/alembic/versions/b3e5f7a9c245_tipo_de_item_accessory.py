"""itens: tipo de item 'Accessory' (acessorios, junto com os Rings)

Revision ID: b3e5f7a9c245
Revises: a9d2e4f6b134
Create Date: 2026-10-04 15:00:00.000000

ALTER TYPE ... ADD VALUE (o autogenerate nao detecta). O rotulo no banco e' o NOME do membro em MAIUSCULO (ACCESSORY), como nos outros enums.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b3e5f7a9c245'
down_revision: Union[str, Sequence[str], None] = 'a9d2e4f6b134'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta o valor novo (sem usa-lo nesta transacao)."""
    op.execute("ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'ACCESSORY'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: o valor fica no tipo (inofensivo); so' garante que nenhuma linha o use."""
    op.execute("UPDATE content_items SET item_type = 'GENERAL' WHERE item_type = 'ACCESSORY'")
