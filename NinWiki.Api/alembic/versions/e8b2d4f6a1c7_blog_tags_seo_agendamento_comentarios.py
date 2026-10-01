"""blog: tags, SEO, agendamento de publicacao, leitores, comentarios e curtidas

Revision ID: e8b2d4f6a1c7
Revises: d5a7c1e9b3f2
Create Date: 2026-10-03 12:00:00.000000

  - tags + post_tag_links: categorias dos posts (com 5 tags iniciais: Update, Guide, Lore, Event, Patch Notes)
  - posts: meta_title, meta_description (SEO) e published_at (agendamento). Posts JA' publicados ganham
    published_at = data de criacao, para continuarem na mesma posicao da lista.
  - readers, post_comments, post_likes: leitores do site que comentam e curtem
Escrita a mao: o INSERT das tags iniciais e o preenchimento de published_at nao vem do autogenerate.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e8b2d4f6a1c7'
down_revision: Union[str, Sequence[str], None] = 'd5a7c1e9b3f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_TAGS = [
    ("update", "Update", "Atualização"), ("guide", "Guide", "Guia"), ("lore", "Lore", "História"),
    ("event", "Event", "Evento"), ("patch-notes", "Patch Notes", "Notas de atualização"),
]


def upgrade() -> None:
    op.create_table(
        'tags',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('name_pt', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'post_tag_links',
        sa.Column('post_id', sa.UUID(), nullable=False),
        sa.Column('tag_id', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('post_id', 'tag_id'),
    )
    tags = sa.table('tags', sa.column('id', sa.String), sa.column('name', sa.String), sa.column('name_pt', sa.String))
    op.bulk_insert(tags, [{"id": i, "name": n, "name_pt": p} for i, n, p in SEED_TAGS])

    op.add_column('posts', sa.Column('meta_title', sa.String(length=70), nullable=True))
    op.add_column('posts', sa.Column('meta_description', sa.String(length=200), nullable=True))
    op.add_column('posts', sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_posts_published_at'), 'posts', ['published_at'], unique=False)
    op.execute("UPDATE posts SET published_at = created_at WHERE status = 'PUBLISHED'")

    op.create_table(
        'readers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('discord_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('banned', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_readers_discord_id'), 'readers', ['discord_id'], unique=True)
    op.create_table(
        'post_comments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('post_id', sa.UUID(), nullable=False),
        sa.Column('reader_id', sa.UUID(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('hidden', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('hidden_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reader_id'], ['readers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_post_comments_post_id'), 'post_comments', ['post_id'], unique=False)
    op.create_index(op.f('ix_post_comments_reader_id'), 'post_comments', ['reader_id'], unique=False)
    op.create_index(op.f('ix_post_comments_created_at'), 'post_comments', ['created_at'], unique=False)
    op.create_table(
        'post_likes',
        sa.Column('post_id', sa.UUID(), nullable=False),
        sa.Column('reader_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reader_id'], ['readers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('post_id', 'reader_id'),
    )


def downgrade() -> None:
    op.drop_table('post_likes')
    op.drop_index(op.f('ix_post_comments_created_at'), table_name='post_comments')
    op.drop_index(op.f('ix_post_comments_reader_id'), table_name='post_comments')
    op.drop_index(op.f('ix_post_comments_post_id'), table_name='post_comments')
    op.drop_table('post_comments')
    op.drop_index(op.f('ix_readers_discord_id'), table_name='readers')
    op.drop_table('readers')
    op.drop_index(op.f('ix_posts_published_at'), table_name='posts')
    op.drop_column('posts', 'published_at')
    op.drop_column('posts', 'meta_description')
    op.drop_column('posts', 'meta_title')
    op.drop_table('post_tag_links')
    op.drop_table('tags')
