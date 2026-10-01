"""padroniza name/name_pt em Village, Profession, NinjaRank e Summon

Revision ID: 06d091c74eb1
Revises: 7c82f7b78579
Create Date: 2026-09-28 14:00:00.000000

Mesmo padrao ja' usado em Content, Mastery, Jutsu e Attribute: `name` passa a ser o
INGLES (principal) e `name_pt` a traducao.

  antes:  name = portugues   |  english_name = ingles
  depois: name = ingles      |  name_pt      = portugues

RENAME de verdade (nao apagar+criar): nenhum dado se perde. A ORDEM importa: "name"
vira "name_pt" PRIMEIRO, pra' liberar o nome "name" antes de "english_name" ocupar
esse lugar. E o rename sozinho carrega o NOT NULL que "name" tinha - name_pt e'
opcional (nem toda linha tem traducao), por isso o ALTER a mais soltando o NOT NULL.
(O autogenerate do Alembic gera isso como "apagar coluna + criar coluna", que
destruiria os nomes - por isso esta migracao e' escrita a mao.)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '06d091c74eb1'
down_revision: Union[str, Sequence[str], None] = '7c82f7b78579'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ['villages', 'professions', 'ninja_ranks', 'summons']


def upgrade() -> None:
    """Upgrade schema."""
    for table in _TABLES:
        op.alter_column(table, 'name', new_column_name='name_pt')
        op.alter_column(table, 'name_pt', existing_type=sa.String(length=100), nullable=True)
        op.alter_column(table, 'english_name', new_column_name='name')


def downgrade() -> None:
    """Downgrade schema."""
    for table in _TABLES:
        op.alter_column(table, 'name', new_column_name='english_name')
        op.alter_column(table, 'name_pt', existing_type=sa.String(length=100), nullable=False)
        op.alter_column(table, 'name_pt', new_column_name='name')
