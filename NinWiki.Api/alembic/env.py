"""
Configuracao do Alembic - liga o Alembic ao .env e aos modelos reais
do projeto (app/models), para autogenerate funcionar sozinho.

GOTCHA JA VALIDADO NO PROJETO IRMAO (Guima): por padrao, o Alembic NAO
le o .env sozinho - so' o FastAPI (via pydantic-settings) faz isso.
Sem o load_dotenv() abaixo, rodar `alembic` fora do contexto da API
falharia por nao achar DATABASE_URL. Por isso essas duas linhas ficam
logo no topo, antes de qualquer outra coisa.
"""
import os
from logging.config import fileConfig

from dotenv import load_dotenv
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

load_dotenv()

# Importa a Base com TODOS os modelos ja registrados (ver
# app/models/__init__.py) - e' isso que da' ao autogenerate a lista
# completa de tabelas para comparar contra o banco real.
from app.models import Base

config = context.config

# Sobrescreve a URL do banco vinda do alembic.ini com a do .env -
# assim so' existe UM lugar (o .env) definindo a string de conexao,
# em vez de duas fontes de verdade que podem ficar dessincronizadas.
database_url = os.getenv("DATABASE_URL")
if database_url:
    # Alembic/psycopg nao entendem o driver "+asyncpg" do SQLAlchemy -
    # a migration roda em modo sincrono, entao trocamos para o driver
    # sincrono puro (psycopg, versao 3) so' aqui, sem afetar a app
    # FastAPI (que continua usando asyncpg normalmente via
    # app/core/database.py). Usamos "psycopg" (v3), nao "psycopg2":
    # o psycopg2 tem um bug antigo e conhecido no Windows onde uma
    # mensagem de erro do Postgres localizada em portugues (com
    # acento) quebra a decodificacao ANTES do erro real aparecer -
    # o psycopg3 nao tem esse problema.
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    config.set_main_option("sqlalchemy.url", sync_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
