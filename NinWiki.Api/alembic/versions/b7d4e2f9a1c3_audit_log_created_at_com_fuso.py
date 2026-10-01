"""audit_log.created_at passa a guardar fuso horario (timestamptz)

Revision ID: b7d4e2f9a1c3
Revises: a91c3e5d7b20
Create Date: 2026-10-01 18:00:00.000000

Bug corrigido: a coluna era TIMESTAMP SEM fuso. O horario era gravado na hora local do servidor
de banco e a API o devolvia sem fuso, entao o navegador interpretava na hora DELE - o log podia
aparecer deslocado em horas. Agora e' TIMESTAMPTZ.

Os valores antigos eram "horario local do servidor de banco" (o fuso da sessao, TimeZone),
por isso a conversao usa exatamente esse fuso: nenhum horario existente muda de instante.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b7d4e2f9a1c3'
down_revision: Union[str, Sequence[str], None] = 'a91c3e5d7b20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE audit_log ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE "
        "USING created_at AT TIME ZONE current_setting('TimeZone')"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE audit_log ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE "
        "USING created_at AT TIME ZONE current_setting('TimeZone')"
    )
