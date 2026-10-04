"""armas: ate' 3 requisitos para usar (um por linha) - aumenta weapon_requirement para 320 caracteres

Revision ID: c4f6a8b0d124
Revises: b2e4f6a8c913
Create Date: 2026-10-04 22:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c4f6a8b0d124'
down_revision: Union[str, Sequence[str], None] = 'b2e4f6a8c913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Aumenta a coluna de 100 para 320 caracteres (3 requisitos de ate' 100, mais as quebras de linha)."""
    op.alter_column('content_items', 'weapon_requirement', existing_type=sa.String(length=100), type_=sa.String(length=320), existing_nullable=True)


def downgrade() -> None:
    """Volta para 100 caracteres (corta o que passar)."""
    op.execute("UPDATE content_items SET weapon_requirement = left(weapon_requirement, 100) WHERE length(weapon_requirement) > 100")
    op.alter_column('content_items', 'weapon_requirement', existing_type=sa.String(length=320), type_=sa.String(length=100), existing_nullable=True)
