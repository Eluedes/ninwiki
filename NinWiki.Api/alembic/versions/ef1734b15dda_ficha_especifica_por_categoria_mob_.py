"""ficha especifica por categoria: mob stats, arma, currency e cast

Revision ID: ef1734b15dda
Revises: a4f7c9d21e08
Create Date: 2026-09-23 23:25:56.426025

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef1734b15dda'
down_revision: Union[str, Sequence[str], None] = 'a4f7c9d21e08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('content_item_attacks',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('content_item_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['content_item_id'], ['content_items.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.add_column('content_items', sa.Column('mob_health', sa.String(length=50), nullable=True))
    op.add_column('content_items', sa.Column('mob_damage', sa.String(length=50), nullable=True))
    op.add_column('content_items', sa.Column('mob_experience', sa.String(length=50), nullable=True))
    op.add_column('content_items', sa.Column('mob_range', sa.String(length=50), nullable=True))
    op.add_column('content_items', sa.Column('mob_respawn_time', sa.String(length=50), nullable=True))
    op.add_column('content_items', sa.Column('weapon_speed', sa.String(length=50), nullable=True))
    op.add_column('content_items', sa.Column('weapon_requirement', sa.String(length=100), nullable=True))
    op.add_column('content_items', sa.Column('max_stack', sa.Integer(), nullable=True))
    op.add_column('content_items', sa.Column('cast_village_id', sa.String(length=50), nullable=True))
    # Nome explicito (mesmo motivo da migracao anterior, ver
    # a4f7c9d21e08): sem isso o downgrade() nao saberia o nome certo
    # pra apagar essa constraint depois.
    op.create_foreign_key(
        'content_items_cast_village_id_fkey', 'content_items', 'villages',
        ['cast_village_id'], ['id'], ondelete='SET NULL',
    )
    # ALTER TYPE ... ADD VALUE nao e' detectado pelo autogenerate do
    # Alembic pra ENUMs do Postgres (limitacao conhecida) - precisa ser
    # adicionado a mao. Funciona dentro de uma migration normal desde o
    # Postgres 12 (so' nao pode ser USADO na MESMA transacao em que foi
    # criado, o que nao e' o caso aqui - so' estamos criando, nao usando).
    #
    # MAIUSCULO de proposito, nao 'currency'/'cast' (minusculo, batendo
    # com o .value do enum Python) - testado e confirmado que esse
    # projeto usa o .name (maiusculo) como rotulo real no Postgres pra
    # TODOS os enums existentes (GENERAL/RING/... aqui mesmo,
    # DRAFT/PUBLISHED em content_status, etc) - e' o comportamento
    # padrao do SQLAlchemy quando Enum(PyEnumClass, name=...) e' usado
    # sem values_callable, mesmo com a classe Python tambem herdando de
    # `str`. Usar minusculo aqui quebraria a insercao com um erro de
    # "invalid input value for enum" assim que alguem tentasse salvar
    # um item com esse tipo - achado testando de verdade antes de
    # aplicar isso em qualquer lugar.
    op.execute("ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'CURRENCY'")
    op.execute("ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'CAST'")


def downgrade() -> None:
    """Downgrade schema.

    NAO remove 'currency'/'cast' do enum item_type: o Postgres nao tem
    um ALTER TYPE ... DROP VALUE - a unica forma de tirar um valor de
    um enum existente e' recriar o tipo inteiro (criar um novo, migrar
    a coluna, apagar o antigo), arriscado demais pra fazer automatico
    aqui. Se algum dia for preciso de verdade, fazer manualmente.
    """
    op.drop_constraint('content_items_cast_village_id_fkey', 'content_items', type_='foreignkey')
    op.drop_column('content_items', 'cast_village_id')
    op.drop_column('content_items', 'max_stack')
    op.drop_column('content_items', 'weapon_requirement')
    op.drop_column('content_items', 'weapon_speed')
    op.drop_column('content_items', 'mob_respawn_time')
    op.drop_column('content_items', 'mob_range')
    op.drop_column('content_items', 'mob_experience')
    op.drop_column('content_items', 'mob_damage')
    op.drop_column('content_items', 'mob_health')
    op.drop_table('content_item_attacks')
