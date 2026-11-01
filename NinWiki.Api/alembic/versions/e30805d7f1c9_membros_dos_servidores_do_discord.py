"""membros dos servidores do discord

Revision ID: e30805d7f1c9
Revises: a48aeefd4d0b
Create Date: 2026-11-01 11:38:56.582946

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e30805d7f1c9'
down_revision: Union[str, Sequence[str], None] = 'a48aeefd4d0b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria a lista de membros dos servidores do Discord (painel do bot) e marca a ultima sincronizacao em discord_guilds."""
    # (revisada a mao: a coluna tournaments.organizer_hidden do outro agente NAO entra aqui)
    op.create_table('discord_guild_members',
    sa.Column('guild_id', sa.String(length=32), nullable=False),
    sa.Column('discord_id', sa.String(length=32), nullable=False),
    sa.Column('username', sa.String(length=100), server_default='', nullable=False),
    sa.Column('display_name', sa.String(length=100), server_default='', nullable=False),
    sa.Column('is_bot', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('joined_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('roles', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('sync_token', sa.String(length=40), server_default='', nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['guild_id'], ['discord_guilds.guild_id'], name='fk_discord_guild_members_guild_id', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('guild_id', 'discord_id', name='pk_discord_guild_members')
    )
    op.add_column('discord_guilds', sa.Column('members_synced_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('discord_guilds', sa.Column('members_partial', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Apaga a lista de membros e as colunas novas de discord_guilds."""
    # (revisada a mao: a coluna tournaments.organizer_hidden do outro agente NAO entra aqui)
    op.drop_column('discord_guilds', 'members_partial')
    op.drop_column('discord_guilds', 'members_synced_at')
    op.drop_table('discord_guild_members')
