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
from pathlib import Path

from dotenv import dotenv_values, load_dotenv
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Caminho EXPLICITO do .env (a pasta NinWiki.Api), em vez de deixar o dotenv "procurar": na hospedagem o Alembic roda via
# `python -m alembic` e a busca automatica pode nao achar o arquivo.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE)

if not os.getenv("DATABASE_URL"):
    # Sem isto o Alembic cairia na URL de exemplo do alembic.ini ("driver://...") e o erro seria um confuso
    # "Can't load plugin: sqlalchemy.dialects:driver". Aqui dizemos o que realmente falta (so' NOMES, nunca valores).
    if ENV_FILE.is_file():
        found = ", ".join(sorted(k for k in dotenv_values(ENV_FILE) if k)) or "(nenhuma variavel)"
        raise RuntimeError(f"DATABASE_URL nao esta definida. O .env existe em {ENV_FILE}, mas so' tem: {found}. "
                           "Confira o Secret API_ENV (precisa ter a linha DATABASE_URL=postgresql+asyncpg://...).")
    raise RuntimeError(f"Arquivo .env nao encontrado em {ENV_FILE}. No deploy ele vem do Secret API_ENV do GitHub "
                       "(o secret esta vazio, ou o app nao foi atualizado pelo workflow).")

# Importa a Base com TODOS os modelos ja registrados (ver
# app/models/__init__.py) - e' isso que da' ao autogenerate a lista
# completa de tabelas para comparar contra o banco real.
from app.core import db_ssl
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
    # asyncpg usa "?ssl=require"; o psycopg (sincrono, usado so' aqui) usa "?sslmode=require".
    sync_url = sync_url.replace("?ssl=", "?sslmode=").replace("&ssl=", "&sslmode=")
    config.set_main_option("sqlalchemy.url", sync_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Modo offline do Alembic: gera o SQL das migrations sem abrir conexao com o banco."""
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
    """Modo online do Alembic: conecta no banco (driver sincrono psycopg) e aplica as migrations."""
    # TLS com certificado de cliente (SquareCloud): mesmas variaveis DATABASE_SSL_* da API, no formato do libpq.
    ssl_ca, ssl_cert, ssl_key = (os.getenv(k, "") for k in ("DATABASE_SSL_CA", "DATABASE_SSL_CERT", "DATABASE_SSL_KEY"))
    connect_args = {}
    if db_ssl.is_enabled(ssl_ca, ssl_cert, ssl_key):
        connect_args = db_ssl.libpq_args(ssl_ca, ssl_cert, ssl_key, os.getenv("DATABASE_SSL_VERIFY_HOSTNAME", "").lower() == "true")
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
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
