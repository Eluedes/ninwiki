"""
Leva o banco do seu computador (o Postgres do Docker) para a SquareCloud - e traz de volta.

QUANDO USAR: uma vez, no primeiro deploy, para a wiki nascer na SquareCloud com TODO o conteudo que
voce ja' tem local (entries, posts, vilas, equipe...). Tambem serve como BACKUP do banco.

COMO USAR (na pasta NinWiki.Api, com o Docker ligado e o container do banco no ar):

  1) Exportar o banco local para um arquivo:
         python scripts/migrar_banco.py exportar
     -> cria backups/ninwiki-AAAAMMDD-HHMM.dump (pasta ignorada pelo Git).

  2) Importar o arquivo no banco da SquareCloud (copie a URL de conexao no painel > Databases):
         python scripts/migrar_banco.py importar backups/ninwiki-....dump --url "postgresql://USER:SENHA@HOST:PORTA/BANCO" --confirmo
     --confirmo e' obrigatorio: a importacao SUBSTITUI as tabelas do banco de destino.
     A URL pode vir no formato da API (postgresql+asyncpg://...) - e' convertida sozinha.
     Se o banco exigir SSL, acrescente ?sslmode=require na URL.

  Depois de importar: o app da API (start.py) roda "alembic upgrade head" sozinho e conclui qualquer
  migration que faltar. As IMAGENS (pasta uploads/) nao ficam no banco - veja o README.

Ferramentas: usa o proprio container do Postgres do Docker (pg_dump) e uma imagem postgres:16-alpine
(pg_restore) - nada para instalar. Sem Docker, usa pg_dump/pg_restore instalados na maquina (--sem-docker).
Nunca imprime a senha no terminal.
"""
import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent.parent
BACKUPS = ROOT / "backups"
CONTAINER = "ninwiki-postgres"   # nome definido no docker-compose.yml
IMAGE = "postgres:16-alpine"     # mesma versao do docker-compose.yml


def ler_env() -> dict[str, str]:
    """Le o .env da API (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB...) sem depender de nenhuma biblioteca."""
    valores: dict[str, str] = {}
    arquivo = ROOT / ".env"
    if arquivo.exists():
        for linha in arquivo.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                k, v = linha.split("=", 1)
                valores[k.strip()] = v.strip()
    return valores


def normalizar_url(url: str) -> str:
    """Aceita a URL no formato da API (postgresql+asyncpg://) e devolve a que o pg_restore entende (postgresql://)."""
    url = url.strip().replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg://", "postgresql://")
    url = url.replace("?ssl=", "?sslmode=").replace("&ssl=", "&sslmode=")
    if not url.startswith(("postgresql://", "postgres://")):
        sys.exit("URL invalida: precisa comecar com postgresql://")
    return url


def mascarar(url: str) -> str:
    """Troca a senha da URL por **** para mostrar no terminal com seguranca."""
    p = urlsplit(url)
    if p.password:
        netloc = p.netloc.replace(f":{p.password}@", ":****@")
        return urlunsplit((p.scheme, netloc, p.path, p.query, p.fragment))
    return url


def tem_docker() -> bool:
    """True se o comando docker existe e o Docker esta' respondendo."""
    if not shutil.which("docker"):
        return False
    return subprocess.run(["docker", "info"], capture_output=True).returncode == 0


def exportar(args: argparse.Namespace) -> None:
    """Gera o arquivo .dump do banco local (formato custom do pg_dump, compactado)."""
    env = ler_env()
    usuario, banco = env.get("POSTGRES_USER", "ninwiki"), env.get("POSTGRES_DB", "ninwiki")
    BACKUPS.mkdir(exist_ok=True)
    destino = BACKUPS / f"ninwiki-{datetime.now():%Y%m%d-%H%M}.dump"
    if args.sem_docker or not tem_docker():
        host, porta = env.get("POSTGRES_HOST", "localhost"), env.get("POSTGRES_PORT", "5433")
        cmd = ["pg_dump", "-Fc", "--no-owner", "--no-acl", "-h", host, "-p", porta, "-U", usuario, "-f", str(destino), banco]
        print("Usando o pg_dump instalado na maquina...")
        r = subprocess.run(cmd, env={**os.environ, "PGPASSWORD": env.get("POSTGRES_PASSWORD", "")})
    else:
        print(f"Usando o container {CONTAINER} do Docker...")
        with open(destino, "wb") as f:
            r = subprocess.run(["docker", "exec", CONTAINER, "pg_dump", "-Fc", "--no-owner", "--no-acl", "-U", usuario, banco], stdout=f)
    if r.returncode != 0 or destino.stat().st_size == 0:
        destino.unlink(missing_ok=True)
        sys.exit("Falhou. O banco esta' no ar? (docker compose up -d) Confira POSTGRES_* no .env.")
    print(f"Pronto: {destino}  ({destino.stat().st_size / 1024:.0f} KB)")
    print("Proximo passo: python scripts/migrar_banco.py importar", destino.relative_to(ROOT), '--url "postgresql://..." --confirmo')


def importar(args: argparse.Namespace) -> None:
    """Restaura um .dump no banco de destino (SUBSTITUI as tabelas que ja' existem la')."""
    arquivo = Path(args.arquivo).resolve()
    if not arquivo.is_file():
        sys.exit(f"Arquivo nao encontrado: {arquivo}")
    if not args.confirmo:
        sys.exit("Isto SUBSTITUI as tabelas do banco de destino. Se tem certeza, rode de novo com --confirmo.")
    url = normalizar_url(args.url)
    print(f"Destino: {mascarar(url)}")
    opcoes = ["--no-owner", "--no-acl", "--clean", "--if-exists", "--exit-on-error"]
    if args.sem_docker or not tem_docker():
        print("Usando o pg_restore instalado na maquina...")
        r = subprocess.run(["pg_restore", *opcoes, "-d", url, str(arquivo)])
    else:
        print(f"Usando a imagem {IMAGE} do Docker...")
        r = subprocess.run(["docker", "run", "--rm", "-v", f"{arquivo.parent}:/backup:ro", IMAGE, "pg_restore", *opcoes, "-d", url, f"/backup/{arquivo.name}"])
    if r.returncode != 0:
        sys.exit("A importacao falhou (veja a mensagem acima). Causas comuns: URL/senha errada, banco exige ?sslmode=require, versao do Postgres do destino menor que 16.")
    print("Importado! Agora (re)inicie o app da API na SquareCloud.")


def main() -> None:
    """Le os argumentos e chama exportar ou importar."""
    parser = argparse.ArgumentParser(description="Exporta/importa o banco do NinWiki (local <-> SquareCloud).")
    sub = parser.add_subparsers(dest="comando", required=True)
    e = sub.add_parser("exportar", help="gera um backup do banco local")
    e.add_argument("--sem-docker", action="store_true", help="usa pg_dump instalado na maquina em vez do container")
    e.set_defaults(func=exportar)
    i = sub.add_parser("importar", help="restaura um backup num banco de destino")
    i.add_argument("arquivo", help="arquivo .dump gerado pelo comando exportar")
    i.add_argument("--url", required=True, help="URL de conexao do banco de destino (SquareCloud)")
    i.add_argument("--confirmo", action="store_true", help="confirma que as tabelas do destino podem ser substituidas")
    i.add_argument("--sem-docker", action="store_true", help="usa pg_restore instalado na maquina")
    i.set_defaults(func=importar)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
