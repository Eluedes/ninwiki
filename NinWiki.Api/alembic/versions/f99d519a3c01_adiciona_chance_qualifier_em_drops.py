"""adiciona chance_qualifier em drops

Revision ID: f99d519a3c01
Revises: 3deee34cb34a
Create Date: 2026-09-25 03:19:36.202375

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f99d519a3c01'
down_revision: Union[str, Sequence[str], None] = '3deee34cb34a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # sa.Enum(...).create(): precisa criar o TIPO novo no Postgres
    # antes de usar ele numa coluna - diferente de adicionar um VALOR
    # a um enum que ja existe (ver a4f7c9d21e08/ef1734b15dda, que
    # usam ALTER TYPE ... ADD VALUE), esse enum e' novo do zero, e o
    # autogenerate as vezes nao emite o CREATE TYPE sozinho antes do
    # ADD COLUMN - achado testando de verdade (erro "type
    # drop_chance_qualifier does not exist" ao rodar sem isso).
    drop_chance_qualifier = sa.Enum('OVER', 'BELOW', name='drop_chance_qualifier')
    drop_chance_qualifier.create(op.get_bind(), checkfirst=True)
    op.add_column('content_item_drops', sa.Column('chance_qualifier', drop_chance_qualifier, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('content_item_drops', 'chance_qualifier')
    sa.Enum(name='drop_chance_qualifier').drop(op.get_bind(), checkfirst=True)
