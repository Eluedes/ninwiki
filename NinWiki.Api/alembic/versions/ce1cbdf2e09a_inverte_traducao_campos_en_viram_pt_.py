"""inverte traducao: campos en viram pt (padrao agora e ingles)

Revision ID: ce1cbdf2e09a
Revises: f99d519a3c01
Create Date: 2026-09-25 20:36:54.552101

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ce1cbdf2e09a'
down_revision: Union[str, Sequence[str], None] = 'f99d519a3c01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # RENAME, nao add+drop: preserva qualquer traducao que ja tenha
    # sido gerada nas colunas antigas (o autogenerate detecta como
    # "coluna nova" + "coluna removida" por padrao, o que apagaria
    # esse dado - convertido a mao pra renomear de verdade).
    op.alter_column('content_items', 'name_en', new_column_name='name_pt')
    op.alter_column('content_items', 'description_en', new_column_name='description_pt')
    op.alter_column('content_items', 'lore_en', new_column_name='lore_pt')
    op.alter_column('content_items', 'synergy_en', new_column_name='synergy_pt')
    op.alter_column('content_items', 'spawn_location_en', new_column_name='spawn_location_pt')


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('content_items', 'name_pt', new_column_name='name_en')
    op.alter_column('content_items', 'description_pt', new_column_name='description_en')
    op.alter_column('content_items', 'lore_pt', new_column_name='lore_en')
    op.alter_column('content_items', 'synergy_pt', new_column_name='synergy_en')
    op.alter_column('content_items', 'spawn_location_pt', new_column_name='spawn_location_en')
