"""unifica torneios e membros do bot

Revision ID: 57fde6c42da0
Revises: c3d7e91b5f20, e30805d7f1c9
Create Date: 2026-11-01 11:50:32.373441

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '57fde6c42da0'
down_revision: Union[str, Sequence[str], None] = ('c3d7e91b5f20', 'e30805d7f1c9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
