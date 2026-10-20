"""guia: detalhes de cada profissao (professions.details)

Revision ID: e7a9c1d3f6b8
Revises: d6f8b0c2e5a7
Create Date: 2026-10-19 11:00:00.000000

So' acrescenta uma coluna (nula): nenhuma linha existente muda.
  - details: JSON com o que a pagina da profissao mostra alem da descricao: {"resources": [...], "recipes": [...], "tools": [...]}
    (recursos que se coleta e o que cai, receitas de criacao, ferramentas como varas de pesca).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e7a9c1d3f6b8'
down_revision: Union[str, Sequence[str], None] = 'd6f8b0c2e5a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('professions', sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('professions', 'details')
