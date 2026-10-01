"""recupera_nomes_em_ingles_apagados_pela_migracao_externa

Revision ID: bfd385d46ea6
Revises: 3d246e008370
Create Date: 2026-09-28 00:00:00.000000

CONTEXTO (importante pra quem ler isso depois): a migracao anterior
(3d246e008370, "refatora_masteries_english_para_pt") foi gerada por
uma ferramenta de IA diferente (fora deste projeto/chat), rodada
direto no banco real do Rafael. Ela tinha a MESMA intencao boa (fazer
Mastery/Jutsu/Attribute seguirem o mesmo padrao name(EN)/name_pt(PT)
que Content ja usa), mas a EXECUCAO teve um bug serio: ela criou as
colunas "name_pt" novas, mas NUNCA copiou o texto em portugues que
estava em "name" pra dentro delas, e NUNCA trocou o "name" pelo texto
em ingles - so' DELETOU a coluna "english_name" (que tinha o ingles)
sem preservar esse dado em lugar nenhum. Resultado: o ingles de
Masteries/Jutsus/Attributes foi perdido do banco real do Rafael.

Esta migracao aqui conserta os DOIS problemas de uma vez:
1. Copia o texto que esta' em "name" (portugues, intacto) pra dentro
   de "name_pt" - isso nao foi perdido, so' nao tinha sido copiado.
2. Escreve de volta o texto em INGLES em "name" - esse dado tinha
   MESMO sido apagado do banco real, mas o ambiente de teste/sandbox
   usado nas sessoes anteriores deste projeto (nunca tocado pela
   migracao externa) ainda tinha os valores certos guardados, entao
   foram extraidos de la' e estao hardcoded abaixo, linha por linha.

SEGURO RODAR MESMO SE O NOME JA TIVER SIDO CORRIGIDO A MAO: os UPDATEs
sao incondicionais (sempre sobrescrevem name/name_pt com os valores
abaixo) - se alguem ja tiver editado manualmente algum nome depois do
acidente, essa edicao manual seria perdida rodando isso de novo. Rodar
so' UMA vez, logo depois de aplicar 3d246e008370.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bfd385d46ea6'
down_revision: Union[str, Sequence[str], None] = '3d246e008370'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (tabela, id, nome_em_ingles) - o portugues nao precisa vir daqui,
# ja esta' intacto em "name" no banco real - so' precisa ser copiado
# pra "name_pt" antes de "name" virar o ingles.
_MASTERIES_EN = [
    ('earth', 'Earth'), ('fire', 'Fire'), ('lightning', 'Lightning'),
    ('medical', 'Medical'), ('taijutsu', 'Taijutsu'), ('water', 'Water'),
    ('weapon', 'Weapon'), ('wind', 'Wind'),
]

_ATTRIBUTES_EN = [
    ('agility', 'Agility'), ('chakra', 'Chakra'), ('fortitude', 'Fortitude'),
    ('intellect', 'Intellect'), ('strength', 'Strength'),
]

_JUTSUS_EN = [
    ('buki-katana-iai', 'Iaido Slash'),
    ('buki-shuriken-chain', 'Shuriken Chain'),
    ('doton-doryuuheki', 'Earth Wall'),
    ('doton-shinjuu', 'Hidden Mole'),
    ('fuuton-daitoppa', 'Great Breakthrough'),
    ('fuuton-renkuudan', 'Wind Sphere'),
    ('iryou-byakugou', 'Strength of a Hundred Seal'),
    ('iryou-mystic-palm', 'Mystic Palm'),
    ('katon-goukakyuu', 'Fireball Jutsu'),
    ('katon-housenka', 'Phoenix Flower Jutsu'),
    ('katon-ryuuka', 'Fire Dragon Jutsu'),
    ('raiton-chidori', 'Chidori'),
    ('raiton-jibashi', 'Electric Current'),
    ('suiton-suijinheki', 'Water Wall'),
    ('suiton-suiryuudan', 'Water Dragon Jutsu'),
    ('tai-eight-gates', 'Eighth Gate'),
    ('tai-leaf-hurricane', 'Leaf Hurricane'),
]


def _fix_table(table: str, rows: list[tuple[str, str]]) -> None:
    conn = op.get_bind()
    # Passo 1: copia o portugues (que ja esta' certo em "name") pra
    # "name_pt", SO' pra' quem ainda nao tem "name_pt" preenchido -
    # assim rodar duas vezes nao reescreve por cima de uma correcao
    # manual que alguem tenha feito direto em name_pt nesse meio tempo.
    conn.execute(sa.text(f'UPDATE {table} SET name_pt = name WHERE name_pt IS NULL'))
    # Passo 2: escreve o ingles recuperado em "name", linha por linha.
    for row_id, name_en in rows:
        conn.execute(
            sa.text(f'UPDATE {table} SET name = :name_en WHERE id = :row_id'),
            {"name_en": name_en, "row_id": row_id},
        )


def upgrade() -> None:
    """Upgrade schema."""
    _fix_table('masteries', _MASTERIES_EN)
    _fix_table('attributes', _ATTRIBUTES_EN)
    _fix_table('jutsus', _JUTSUS_EN)


def downgrade() -> None:
    """
    Downgrade schema.

    Sem como desfazer de verdade (nao da' pra saber, so' olhando o
    banco, qual portugues cada "name" tinha ANTES desta migracao rodar
    - essa informacao so' existe agora dentro de "name_pt", que fica
    como esta'). Deixa "name"/"name_pt" como estao; quem quiser voltar
    pro estado exato de antes precisaria restaurar um backup.
    """
    pass
