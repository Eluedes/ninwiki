"""ranks jonin special e conselho, kage vira kami

Revision ID: a48aeefd4d0b
Revises: 71a539f5a975
Create Date: 2026-11-01 11:20:24.531730

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a48aeefd4d0b'
down_revision: Union[str, Sequence[str], None] = '71a539f5a975'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Kage passa a se chamar Kami (o id interno `kage` NAO muda: perfis e mapeamentos de cargo continuam ligados a ele) e entram Jonin Special e Conselho entre Jonin e Kami."""
    # Abre espaco na hierarquia: Jonin 4 | Jonin Special 5 | Conselho 6 | Kami 7
    op.execute("UPDATE ninja_ranks SET \"order\" = 7, name = 'Kami', name_pt = 'Kami' WHERE id = 'kage'")
    op.execute(
        "UPDATE ninja_ranks SET description = replace(description, 'Kage', 'Kami'), description_pt = replace(description_pt, 'Kage', 'Kami') "
        "WHERE id IN ('kage', 'rogue')"
    )
    # Textos curtos e neutros: a equipe refina a descricao no painel do Guia.
    op.execute(
        "INSERT INTO ninja_ranks (id, name, name_pt, \"order\", description, description_pt) VALUES "
        "('jonin-special', 'Jonin Special', 'Jonin Special', 5, 'Special rank above Jonin.', 'Rank especial acima de Jonin.'), "
        "('council', 'Council', 'Conselho', 6, 'Council rank, above Jonin Special and just below Kami.', 'Rank do Conselho, acima de Jonin Special e logo abaixo de Kami.') "
        "ON CONFLICT (id) DO NOTHING"
    )


def downgrade() -> None:
    """Volta Kami para Kage e tira os dois ranks novos (leitores/cargos ligados a eles ficam sem rank: as FKs sao SET NULL)."""
    op.execute("DELETE FROM ninja_ranks WHERE id IN ('jonin-special', 'council')")
    op.execute(
        "UPDATE ninja_ranks SET description = replace(description, 'Kami', 'Kage'), description_pt = replace(description_pt, 'Kami', 'Kage') "
        "WHERE id IN ('kage', 'rogue')"
    )
    op.execute("UPDATE ninja_ranks SET \"order\" = 5, name = 'Kage', name_pt = 'Kage' WHERE id = 'kage'")
