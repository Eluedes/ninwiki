"""torneios e perfil do leitor

Revision ID: c7d358341cac
Revises: 01a430b27ba0
Create Date: 2026-10-31 23:09:45.193558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d358341cac'
down_revision: Union[str, Sequence[str], None] = '01a430b27ba0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('tournaments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('owner_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('description', sa.Text(), server_default='', nullable=False),
    sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('status', sa.Enum('DRAFT', 'OPEN', 'RUNNING', 'FINISHED', name='tournament_status'), server_default='DRAFT', nullable=False),
    sa.Column('visibility', sa.Enum('PUBLIC', 'UNLISTED', name='tournament_visibility'), server_default='PUBLIC', nullable=False),
    sa.Column('hidden', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('hidden_by', sa.String(length=100), nullable=True),
    sa.Column('champion_name', sa.String(length=120), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['readers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tournaments_created_at'), 'tournaments', ['created_at'], unique=False)
    op.create_index(op.f('ix_tournaments_owner_id'), 'tournaments', ['owner_id'], unique=False)
    op.create_index(op.f('ix_tournaments_status'), 'tournaments', ['status'], unique=False)
    op.create_table('tournament_entries',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tournament_id', sa.UUID(), nullable=False),
    sa.Column('reader_id', sa.UUID(), nullable=True),
    sa.Column('display_name', sa.String(length=60), nullable=False),
    sa.Column('seed', sa.Integer(), nullable=False),
    sa.Column('placement', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['reader_id'], ['readers.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('tournament_id', 'reader_id', name='uq_tournament_entry_reader')
    )
    op.create_index(op.f('ix_tournament_entries_reader_id'), 'tournament_entries', ['reader_id'], unique=False)
    op.create_index(op.f('ix_tournament_entries_tournament_id'), 'tournament_entries', ['tournament_id'], unique=False)
    op.create_table('tournament_phases',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tournament_id', sa.UUID(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.Column('team_size', sa.Integer(), server_default='1', nullable=False),
    sa.Column('format', sa.Enum('SINGLE_ELIMINATION', 'ROUND_ROBIN', name='tournament_phase_format'), server_default='SINGLE_ELIMINATION', nullable=False),
    sa.Column('status', sa.Enum('SETUP', 'RUNNING', 'FINISHED', name='tournament_phase_status'), server_default='SETUP', nullable=False),
    sa.ForeignKeyConstraint(['tournament_id'], ['tournaments.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tournament_phases_tournament_id'), 'tournament_phases', ['tournament_id'], unique=False)
    op.create_table('tournament_competitors',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('phase_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.Column('seed', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['phase_id'], ['tournament_phases.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tournament_competitors_phase_id'), 'tournament_competitors', ['phase_id'], unique=False)
    op.create_table('tournament_matches',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('phase_id', sa.UUID(), nullable=False),
    sa.Column('round', sa.Integer(), nullable=False),
    sa.Column('slot', sa.Integer(), nullable=False),
    sa.Column('competitor_a_id', sa.UUID(), nullable=True),
    sa.Column('competitor_b_id', sa.UUID(), nullable=True),
    sa.Column('score_a', sa.Integer(), nullable=True),
    sa.Column('score_b', sa.Integer(), nullable=True),
    sa.Column('winner_id', sa.UUID(), nullable=True),
    sa.Column('done', sa.Boolean(), server_default='false', nullable=False),
    sa.ForeignKeyConstraint(['competitor_a_id'], ['tournament_competitors.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['competitor_b_id'], ['tournament_competitors.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['phase_id'], ['tournament_phases.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['winner_id'], ['tournament_competitors.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('phase_id', 'round', 'slot', name='uq_tournament_match_pos')
    )
    op.create_index(op.f('ix_tournament_matches_phase_id'), 'tournament_matches', ['phase_id'], unique=False)
    op.create_table('tournament_team_members',
    sa.Column('competitor_id', sa.UUID(), nullable=False),
    sa.Column('entry_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['competitor_id'], ['tournament_competitors.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['entry_id'], ['tournament_entries.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('competitor_id', 'entry_id')
    )
    op.add_column('readers', sa.Column('game_name', sa.String(length=40), nullable=True))
    op.add_column('readers', sa.Column('village_id', sa.String(length=50), nullable=True))
    op.add_column('readers', sa.Column('ninja_rank_id', sa.String(length=50), nullable=True))
    op.create_foreign_key('fk_readers_village_id', 'readers', 'villages', ['village_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_readers_ninja_rank_id', 'readers', 'ninja_ranks', ['ninja_rank_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_readers_ninja_rank_id', 'readers', type_='foreignkey')
    op.drop_constraint('fk_readers_village_id', 'readers', type_='foreignkey')
    op.drop_column('readers', 'ninja_rank_id')
    op.drop_column('readers', 'village_id')
    op.drop_column('readers', 'game_name')
    op.drop_table('tournament_team_members')
    op.drop_index(op.f('ix_tournament_matches_phase_id'), table_name='tournament_matches')
    op.drop_table('tournament_matches')
    op.drop_index(op.f('ix_tournament_competitors_phase_id'), table_name='tournament_competitors')
    op.drop_table('tournament_competitors')
    op.drop_index(op.f('ix_tournament_phases_tournament_id'), table_name='tournament_phases')
    op.drop_table('tournament_phases')
    op.drop_index(op.f('ix_tournament_entries_tournament_id'), table_name='tournament_entries')
    op.drop_index(op.f('ix_tournament_entries_reader_id'), table_name='tournament_entries')
    op.drop_table('tournament_entries')
    op.drop_index(op.f('ix_tournaments_status'), table_name='tournaments')
    op.drop_index(op.f('ix_tournaments_owner_id'), table_name='tournaments')
    op.drop_index(op.f('ix_tournaments_created_at'), table_name='tournaments')
    op.drop_table('tournaments')
    for enum_name in ('tournament_phase_status', 'tournament_phase_format', 'tournament_visibility', 'tournament_status'):
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)   # tipos enum nao somem com a tabela

