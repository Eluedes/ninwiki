"""jonin special abaixo de jonin

Revision ID: 4bce34061269
Revises: 57fde6c42da0
Create Date: 2026-11-01 11:59:48.232954

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4bce34061269'
down_revision: Union[str, Sequence[str], None] = '57fde6c42da0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Hierarquia certa: Genin 2 | Chunin 3 | Jonin Special 4 | Jonin 5 | Conselho 6 | Kami 7 (o Jonin Special e' o jonin 'especial' ABAIXO do Jonin).
    So' mexe no que ainda esta como a migracao anterior deixou (ordem e textos originais): o que a equipe editou no painel nao e' sobrescrito."""
    op.execute("UPDATE ninja_ranks SET \"order\" = 5 WHERE id = 'jonin' AND \"order\" = 4")
    op.execute("UPDATE ninja_ranks SET \"order\" = 4 WHERE id = 'jonin-special' AND \"order\" = 5")
    op.execute("UPDATE ninja_ranks SET description = 'Special Jonin: a rank between Chunin and Jonin.', description_pt = 'Jonin Special: um rank entre Chunin e Jonin.' "
               "WHERE id = 'jonin-special' AND description = 'Special rank above Jonin.'")
    op.execute("UPDATE ninja_ranks SET description = 'Council rank, above Jonin and just below Kami.', description_pt = 'Rank do Conselho, acima de Jonin e logo abaixo de Kami.' "
               "WHERE id = 'council' AND description = 'Council rank, above Jonin Special and just below Kami.'")


def downgrade() -> None:
    """Volta a ordem anterior (Jonin 4, Jonin Special 5) e os textos originais."""
    op.execute("UPDATE ninja_ranks SET \"order\" = 4 WHERE id = 'jonin' AND \"order\" = 5")
    op.execute("UPDATE ninja_ranks SET \"order\" = 5 WHERE id = 'jonin-special' AND \"order\" = 4")
    op.execute("UPDATE ninja_ranks SET description = 'Special rank above Jonin.', description_pt = 'Rank especial acima de Jonin.' "
               "WHERE id = 'jonin-special' AND description = 'Special Jonin: a rank between Chunin and Jonin.'")
    op.execute("UPDATE ninja_ranks SET description = 'Council rank, above Jonin Special and just below Kami.', description_pt = 'Rank do Conselho, acima de Jonin Special e logo abaixo de Kami.' "
               "WHERE id = 'council' AND description = 'Council rank, above Jonin and just below Kami.'")
