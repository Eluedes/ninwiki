"""cla: imagem no lugar de nivel/ryo; permissoes por cargo editaveis; quadro de avisos

Revision ID: a91c3e5d7b20
Revises: 06d091c74eb1
Create Date: 2026-10-01 12:00:00.000000

  - clans: remove level_requirement e price_ryo; adiciona image (logo + roupa do cla')
  - role_permissions: ajustes de permissao por cargo feitos pelo S.Adm (so' diferencas do padrao)
  - notices / notice_files: quadro de avisos da equipe, com arquivos anexados

Escrita a mao: o tipo ENUM "staff_role" ja' existe (usado por users), entao aqui ele so' e'
referenciado (create_type=False) - nao recriado.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a91c3e5d7b20'
down_revision: Union[str, Sequence[str], None] = '06d091c74eb1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clans', sa.Column('image', sa.String(length=500), nullable=True))
    op.drop_column('clans', 'level_requirement')
    op.drop_column('clans', 'price_ryo')

    staff_role = postgresql.ENUM(name='staff_role', create_type=False)
    op.create_table(
        'role_permissions',
        sa.Column('role', staff_role, nullable=False),
        sa.Column('permission', sa.String(length=50), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('role', 'permission'),
    )

    op.create_table(
        'notices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('pinned', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('author_id', sa.UUID(), nullable=True),
        sa.Column('author_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'notice_files',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('notice_id', sa.UUID(), nullable=False),
        sa.Column('filename', sa.String(length=200), nullable=False),
        sa.Column('stored_name', sa.String(length=80), nullable=False),
        sa.Column('size', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['notice_id'], ['notices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notice_files_notice_id'), 'notice_files', ['notice_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notice_files_notice_id'), table_name='notice_files')
    op.drop_table('notice_files')
    op.drop_table('notices')
    op.drop_table('role_permissions')
    # Os valores antigos nao existem mais: volta com 0 (a coluna e' NOT NULL).
    op.add_column('clans', sa.Column('price_ryo', sa.Integer(), server_default='0', nullable=False))
    op.add_column('clans', sa.Column('level_requirement', sa.Integer(), server_default='0', nullable=False))
    op.alter_column('clans', 'price_ryo', server_default=None)
    op.alter_column('clans', 'level_requirement', server_default=None)
    op.drop_column('clans', 'image')
