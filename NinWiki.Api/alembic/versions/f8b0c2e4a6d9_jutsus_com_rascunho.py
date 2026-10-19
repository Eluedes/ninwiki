"""jutsus: rascunho ou publicado (jutsus.status)

Revision ID: f8b0c2e4a6d9
Revises: e7a9c1d3f6b8
Create Date: 2026-10-19 12:00:00.000000

Reaproveita o tipo `content_status` (DRAFT / PUBLISHED) que o conteudo e os posts ja usam. Os jutsus que ja existem continuam PUBLICADOS (padrao do banco);
os criados em massa a partir da lista do jogo entram como RASCUNHO, para nao aparecerem no site antes de alguem preencher a ficha.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f8b0c2e4a6d9'
down_revision: Union[str, Sequence[str], None] = 'e7a9c1d3f6b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Coluna nova com padrao PUBLISHED: nenhuma linha existente muda de comportamento."""
    status = postgresql.ENUM('DRAFT', 'PUBLISHED', name='content_status', create_type=False)
    op.add_column('jutsus', sa.Column('status', status, server_default='PUBLISHED', nullable=False))


def downgrade() -> None:
    op.drop_column('jutsus', 'status')
