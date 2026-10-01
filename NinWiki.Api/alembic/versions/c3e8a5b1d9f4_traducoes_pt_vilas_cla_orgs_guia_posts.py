"""traducoes EN -> PT (DeepL) para vilas, cla's, organizacoes, guia, atributos e posts

Revision ID: c3e8a5b1d9f4
Revises: b7d4e2f9a1c3
Create Date: 2026-10-02 12:00:00.000000

O site e' em INGLES por padrao: os campos sem sufixo guardam o ingles e os `_pt` a traducao
(preenchida pela DeepL quando vazia). Esta migracao so' ACRESCENTA colunas (todas opcionais) -
nenhum dado existente muda. Para converter conteudo antigo que estava em portugues nos campos
principais, use scripts/traduzir_para_ingles.py (opcional, pede confirmacao).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c3e8a5b1d9f4'
down_revision: Union[str, Sequence[str], None] = 'b7d4e2f9a1c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (tabela, coluna, tipo)
COLUMNS = [
    ("villages", "motto_pt", sa.String(200)), ("villages", "description_pt", sa.Text()),
    ("villages", "long_description_pt", sa.Text()), ("villages", "climate_pt", sa.String(200)),
    ("clans", "name_pt", sa.String(100)), ("clans", "description_pt", sa.Text()),
    ("organizations", "name_pt", sa.String(100)), ("organizations", "description_pt", sa.Text()),
    ("professions", "description_pt", sa.Text()),
    ("ninja_ranks", "description_pt", sa.Text()),
    ("story_arcs", "name_pt", sa.String(150)), ("story_arcs", "description_pt", sa.Text()),
    ("summons", "village_pt", sa.String(100)), ("summons", "stage_young_pt", sa.Text()),
    ("summons", "stage_teen_pt", sa.Text()), ("summons", "stage_adult_pt", sa.Text()),
    ("attributes", "description_pt", sa.Text()),
    ("posts", "title_pt", sa.String(200)), ("posts", "excerpt_pt", sa.Text()), ("posts", "content_pt", sa.Text()),
]


def upgrade() -> None:
    for table, column, type_ in COLUMNS:
        op.add_column(table, sa.Column(column, type_, nullable=True))


def downgrade() -> None:
    for table, column, _ in reversed(COLUMNS):
        op.drop_column(table, column)
