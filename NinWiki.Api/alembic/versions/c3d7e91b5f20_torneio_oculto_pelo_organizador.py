"""torneio oculto pelo organizador (organizer_hidden)

Revision ID: c3d7e91b5f20
Revises: a48aeefd4d0b
Create Date: 2026-11-01 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d7e91b5f20'
down_revision: Union[str, Sequence[str], None] = 'a48aeefd4d0b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Coluna nova: os torneios que ja' existem continuam visiveis (false); so' os criados daqui em diante nascem ocultos (a API define)."""
    op.add_column('tournaments', sa.Column('organizer_hidden', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Remove a coluna."""
    op.drop_column('tournaments', 'organizer_hidden')
