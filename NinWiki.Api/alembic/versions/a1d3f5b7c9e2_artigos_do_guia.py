"""artigos do Guia (tabela guide_articles)

Revision ID: a1d3f5b7c9e2
Revises: f8b0c2e4a6d9
Create Date: 2026-10-19 20:00:00.000000

Cria a tabela dos artigos do Guia (Zonas, Crime, Equipes, Controles...): cada artigo tem uma SECAO, uma posicao dentro dela, titulo/resumo/texto rico em
ingles e em portugues e a situacao Rascunho/Publicado (reaproveita o tipo `content_status` que o conteudo e os jutsus ja usam). So' cria tabela nova.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a1d3f5b7c9e2'
down_revision: Union[str, Sequence[str], None] = 'f8b0c2e4a6d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Tabela nova, sem mexer em nada que ja' existe."""
    status = postgresql.ENUM('DRAFT', 'PUBLISHED', name='content_status', create_type=False)
    op.create_table(
        'guide_articles',
        sa.Column('id', sa.String(length=80), nullable=False),
        sa.Column('section', sa.String(length=30), nullable=False),
        sa.Column('position', sa.Integer(), server_default='0', nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('title_pt', sa.String(length=150), nullable=True),
        sa.Column('summary', sa.String(length=300), server_default='', nullable=False),
        sa.Column('summary_pt', sa.String(length=300), nullable=True),
        sa.Column('body', sa.Text(), server_default='', nullable=False),
        sa.Column('body_pt', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=50), server_default='book-open', nullable=False),
        sa.Column('status', status, server_default='PUBLISHED', nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_guide_articles_section', 'guide_articles', ['section'])


def downgrade() -> None:
    op.drop_index('ix_guide_articles_section', table_name='guide_articles')
    op.drop_table('guide_articles')
