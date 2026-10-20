"""banco de imagens: a categoria 'clothing' passa a se chamar 'gear' (igual ao Nin Atlas)

Revision ID: a3f5b7c9d0e2
Revises: f2e4a6b8c093
Create Date: 2026-10-18 17:30:00.000000

Renomeia nos tres lugares onde o nome gravado aparece: a categoria das imagens, a permissao `media.cat.clothing`
(trava por cargo) e a lista de permissoes dos cargos personalizados (JSON). So' dados: nenhuma coluna muda.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a3f5b7c9d0e2'
down_revision: Union[str, Sequence[str], None] = 'f2e4a6b8c093'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _renomear(antes: str, depois: str) -> None:
    """Troca `antes` por `depois` na categoria das imagens, nas permissoes por cargo e nos cargos personalizados."""
    op.execute(f"UPDATE media_images SET category = '{depois}' WHERE category = '{antes}'")
    op.execute(f"UPDATE role_permissions SET permission = 'media.cat.{depois}' WHERE permission = 'media.cat.{antes}'")
    op.execute(
        "UPDATE custom_roles "
        f"SET permissions = replace(permissions::text, 'media.cat.{antes}', 'media.cat.{depois}')::jsonb "
        f"WHERE permissions::text LIKE '%media.cat.{antes}%'"
    )


def upgrade() -> None:
    _renomear('clothing', 'gear')


def downgrade() -> None:
    _renomear('gear', 'clothing')
