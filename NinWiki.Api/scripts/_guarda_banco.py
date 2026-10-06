"""
Trava de seguranca dos scripts de teste: eles APAGAM dados (tudo que tem o prefixo "teste-", linhas de acessos, erros, log...), entao so' rodam contra um
banco LOCAL (localhost/127.0.0.1). Se o DATABASE_URL do .env apontar para o banco da SquareCloud (ou qualquer outro servidor), o script para antes de tocar em qualquer coisa.
"""
import sys
from urllib.parse import urlparse

LOCAIS = {"localhost", "127.0.0.1", "::1", "db", "postgres"}   # "db"/"postgres" = nome do servico no docker-compose local


def exigir_banco_local(database_url: str) -> None:
    """Para o programa (exit 2) se o banco nao for local. Nao imprime senha."""
    host = (urlparse(database_url.replace("+asyncpg", "").replace("+psycopg", "")).hostname or "").lower()
    if host not in LOCAIS:
        sys.exit(f"RECUSADO: este script apaga dados e so' roda contra um banco LOCAL; o DATABASE_URL aponta para '{host or '?'}'. "
                 "Use um banco local (ex.: docker compose up -d db) e confira o .env.")
