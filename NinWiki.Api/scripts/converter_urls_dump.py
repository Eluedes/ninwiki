"""
Converte os enderecos `http://localhost:8000` de um dump do banco para o dominio publico da API (mesma logica do `enviar_para_producao.py preparar`,
mas parametrizada por argumento e sem tocar em nada alem de um banco TEMPORARIO local).

Uso (pasta NinWiki.Api, `$env:PYTHONPATH="."`, Docker ligado):
    py scripts/converter_urls_dump.py envio/ninwiki-codex-final.dump envio/ninwiki-final-dominio.dump --dominio https://api.SEUDOMINIO.com
O dump de entrada NAO e' alterado: o script restaura num banco temporario `ninwiki_conv`, troca o texto em toda coluna text/varchar/json/jsonb,
gera o dump novo e apaga o temporario. Mostra quantos textos foram trocados e se sobrou algum `localhost`.
"""
import argparse
import sys
from pathlib import Path

from scripts.enviar_para_producao import LOCAL_PADRAO, SQL_TROCAR, docker
from scripts.migrar_banco import ler_env

TEMP = "ninwiki_conv"   # banco temporario (nunca o `ninwiki` principal)


def main() -> None:
    """Restaura o dump num temporario, troca localhost -> dominio e gera o dump novo."""
    ap = argparse.ArgumentParser()
    ap.add_argument("entrada"), ap.add_argument("saida")
    ap.add_argument("--dominio", required=True, help="ex.: https://api.exemplo.com (sem barra no fim)")
    ap.add_argument("--local", default=LOCAL_PADRAO)
    a = ap.parse_args()
    if not a.dominio.startswith("http") or a.dominio.endswith("/"):
        sys.exit("--dominio deve comecar com http(s):// e nao terminar em '/'.")
    user = ler_env().get("POSTGRES_USER", "ninwiki")
    docker("psql", "-U", user, "-d", "postgres", "-c", f"DROP DATABASE IF EXISTS {TEMP}")
    docker("psql", "-U", user, "-d", "postgres", "-c", f"CREATE DATABASE {TEMP}")
    try:
        with open(a.entrada, "rb") as f:   # dump -Fc entra pelo stdin do pg_restore
            import subprocess
            r = subprocess.run(["docker", "exec", "-i", "ninwiki-postgres", "pg_restore", "--no-owner", "--no-acl", "-U", user, "-d", TEMP], stdin=f, capture_output=True)
        if r.returncode != 0:
            sys.exit("Falhou ao restaurar:\n" + r.stderr.decode(errors="ignore")[-400:])
        r = docker("psql", "-U", user, "-d", TEMP, "-v", "ON_ERROR_STOP=1", "-f", "-", entrada=SQL_TROCAR.replace("__LOCAL__", a.local).replace("__PROD__", a.dominio))
        if r.returncode != 0:
            sys.exit("Falhou ao trocar:\n" + r.stderr[-400:])
        print(next((l.split("NOTICE:")[-1].strip() for l in r.stderr.splitlines() if "TROCADOS=" in l), "?"))
        with open(a.saida, "wb") as f:
            r = docker("pg_dump", "-Fc", "--no-owner", "--no-acl", "-U", user, TEMP, saida=f)
        if r.returncode != 0 or Path(a.saida).stat().st_size == 0:
            sys.exit("Falhou ao gerar o dump novo.")
        print(f"Gerado: {a.saida}")
    finally:
        docker("psql", "-U", user, "-d", "postgres", "-c", f"DROP DATABASE IF EXISTS {TEMP}")


if __name__ == "__main__":
    main()
