"""conteudo: lista de lugares do mob (spawn_locations) e NPC da arma ligado a uma pagina (weapon_npc_id)

Revision ID: c5e7a9b1d4f6
Revises: b4d6f8a0c1e3
Create Date: 2026-10-19 09:00:00.000000

So' acrescenta duas colunas (nulas): nenhuma linha existente muda.
  - spawn_locations: lista JSON [{name, name_pt, zone}] com os lugares onde o mob aparece (o texto livre antigo `spawn_location` continua valendo quando a lista esta' vazia).
  - weapon_npc_id: liga o NPC da arma a uma pagina do wiki (o nome mostrado acompanha a pagina; ao apagar a pagina o campo volta ao texto).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c5e7a9b1d4f6'
down_revision: Union[str, Sequence[str], None] = 'b4d6f8a0c1e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('content_items', sa.Column('spawn_locations', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('content_items', sa.Column('weapon_npc_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('content_items_weapon_npc_id_fkey', 'content_items', 'content_items', ['weapon_npc_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('content_items_weapon_npc_id_fkey', 'content_items', type_='foreignkey')
    op.drop_column('content_items', 'weapon_npc_id')
    op.drop_column('content_items', 'spawn_locations')
