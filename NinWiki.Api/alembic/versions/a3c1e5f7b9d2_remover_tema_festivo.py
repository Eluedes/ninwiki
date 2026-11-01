"""remover tema festivo do site

O recurso de temas festivos (tabela site_seasonal_theme) foi retirado do site: fica so' o fundo padrao.
A migracao anterior (1072386dfdb8) nao foi editada: esta apenas apaga a tabela que ela criou.

Revision ID: a3c1e5f7b9d2
Revises: 1072386dfdb8
Create Date: 2026-11-01 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c1e5f7b9d2'
down_revision: Union[str, Sequence[str], None] = '1072386dfdb8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apaga a tabela do tema festivo."""
    op.drop_table('site_seasonal_theme')


def downgrade() -> None:
    """Recria a tabela do tema festivo (vazia)."""
    op.create_table('site_seasonal_theme',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('theme', sa.String(length=20), server_default='none', nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_by', sa.String(length=100), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
