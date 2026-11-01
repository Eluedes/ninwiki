"""tipos de item tool e scroll

Revision ID: 2e6a34cbe1d4
Revises: 08352b8f48eb
Create Date: 2026-11-01 14:17:07.679978

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e6a34cbe1d4'
down_revision: Union[str, Sequence[str], None] = '08352b8f48eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Acrescenta os tipos de item 'Tool' (ferramenta) e 'Scroll' (pergaminho/manual); sem usa-los nesta transacao.
    O rotulo no banco e' o NOME do membro em MAIUSCULO, como nos outros enums."""
    op.execute("ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'TOOL'")
    op.execute("ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'SCROLL'")


def downgrade() -> None:
    """O Postgres nao tem DROP VALUE para enum: os valores ficam no tipo (inofensivo); so' garante que nenhuma linha os use."""
    op.execute("UPDATE content_items SET item_type = 'GENERAL' WHERE item_type IN ('TOOL', 'SCROLL')")
