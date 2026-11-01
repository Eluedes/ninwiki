"""discord: vila e rank do perfil preenchidos pelo bot (servidor->vila, cargo->rank), vila Takumi e rank Rogue

Revision ID: d5a91f3c7e28
Revises: c7d358341cac
Create Date: 2026-11-01 09:30:00.000000

Cria as tabelas do mapeamento Discord (discord_guilds, discord_roles, discord_member_roles), a coluna readers.profile_source
e os DADOS padrao: vila Takumi (id 'takumi') e rank Rogue (id 'rogue', order 0 = fora da hierarquia academia -> kage).
Os leitores que ja existem passam para o padrao Takumi/Rogue (vila e rank agora vem so' do Discord, via bot).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd5a91f3c7e28'
down_revision: Union[str, Sequence[str], None] = 'c7d358341cac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('discord_guilds',
    sa.Column('guild_id', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('active', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('village_id', sa.String(length=50), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['village_id'], ['villages.id'], name='fk_discord_guilds_village_id', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('guild_id')
    )
    op.create_table('discord_roles',
    sa.Column('guild_id', sa.String(length=32), nullable=False),
    sa.Column('role_id', sa.String(length=32), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('ninja_rank_id', sa.String(length=50), nullable=True),
    sa.ForeignKeyConstraint(['guild_id'], ['discord_guilds.guild_id'], name='fk_discord_roles_guild_id', ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['ninja_rank_id'], ['ninja_ranks.id'], name='fk_discord_roles_ninja_rank_id', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('guild_id', 'role_id')
    )
    op.create_table('discord_member_roles',
    sa.Column('discord_id', sa.BigInteger(), nullable=False),
    sa.Column('guild_id', sa.String(length=32), nullable=False),
    sa.Column('roles', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['guild_id'], ['discord_guilds.guild_id'], name='fk_discord_member_roles_guild_id', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('discord_id', 'guild_id')
    )
    op.create_index(op.f('ix_discord_member_roles_guild_id'), 'discord_member_roles', ['guild_id'], unique=False)
    op.add_column('readers', sa.Column('profile_source', sa.String(length=64), nullable=True))

    # Dados padrao (idempotente: se alguem ja' criou pelo painel, nao mexe).
    op.execute(sa.text(
        "INSERT INTO villages (id, name, name_pt, element, motto, motto_pt, description, description_pt, long_description, long_description_pt, "
        "climate, climate_pt, emblem, accent_color, leader, map_x, map_y) VALUES ("
        "'takumi', 'Takumi Village', 'Vila de Takumi', 'Neutral', 'Every shinobi starts somewhere', 'Todo shinobi começa em algum lugar', "
        "'The default home of players who are not (yet) tied to any village server on Discord.', "
        "'O lar padrão dos jogadores que ainda não estão ligados a nenhum servidor de vila no Discord.', "
        "'Takumi is the village assigned automatically to players the bot cannot place in a village. It is replaced by the village of the Discord server where the player holds a rank role.', "
        "'Takumi é a vila atribuída automaticamente aos jogadores que o bot não consegue colocar em uma vila. Ela é substituída pela vila do servidor do Discord onde o jogador tem um cargo de rank.', "
        "'Varied', 'Variado', '🏯', '#7A7A7A', '-', 50, 50) ON CONFLICT (id) DO NOTHING"))
    op.execute(sa.text(
        "INSERT INTO ninja_ranks (id, name, name_pt, \"order\", description, description_pt) VALUES ("
        "'rogue', 'Rogue', 'Renegado', 0, "
        "'A ninja without a village or a rank. Default rank of players the bot cannot find a rank role for; outside the Academy Student to Kage ladder.', "
        "'Um ninja sem vila e sem rank. Rank padrão dos jogadores para quem o bot não encontra cargo de rank; fica fora da escada Estudante da Academia até Kage.') "
        "ON CONFLICT (id) DO NOTHING"))
    # Leitores existentes: vila e rank passam a ser automaticos; ate' o bot ler os cargos, valem os padroes.
    op.execute(sa.text("UPDATE readers SET village_id = 'takumi', ninja_rank_id = 'rogue', profile_source = 'default'"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('readers', 'profile_source')
    op.drop_index(op.f('ix_discord_member_roles_guild_id'), table_name='discord_member_roles')
    op.drop_table('discord_member_roles')
    op.drop_table('discord_roles')
    op.drop_table('discord_guilds')
    # Os FKs dos leitores sao SET NULL: apagar as linhas padrao nao quebra nada.
    op.execute(sa.text("DELETE FROM ninja_ranks WHERE id = 'rogue'"))
    op.execute(sa.text("DELETE FROM villages WHERE id = 'takumi'"))
