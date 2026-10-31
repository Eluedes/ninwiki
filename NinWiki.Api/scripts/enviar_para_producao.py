"""
Prepara (e envia) para a PRODUCAO o que voce arrumou no ambiente local: o BANCO e as IMAGENS NOVAS, juntos, na mesma rodada.

POR QUE EXISTE: mandar o banco local como esta' deixa as imagens quebradas na producao, por dois motivos: (1) o banco guarda enderecos `http://localhost:8000/...`,
e (2) os arquivos das imagens novas so' existem na sua pasta `uploads/` (o dump do banco nao leva arquivo nenhum).

COMO USAR (pasta NinWiki.Api, venv ativado, Docker ligado, `$env:PYTHONPATH="."`):

  1) PREPARAR  - nao mexe no seu banco local nem na producao:
        python scripts/enviar_para_producao.py preparar
     - copia o banco local para um banco TEMPORARIO, troca `http://localhost:8000` por `https://api.guima.net` (em todas as colunas de texto e JSON),
       gera `envio/ninwiki-producao.dump` e apaga o temporario;
     - junta as imagens NOVAS (as do banco de imagens com ID maior que --desde-id) em `envio/imagens.zip` (pasta `uploads/` dentro);
     - mostra a conferencia (linhas por tabela, imagens, tamanhos) e os comandos finais.

  2) BANCO - o comando que o `preparar` imprime (usa o `migrar_banco.py importar`, que SUBSTITUI as tabelas do destino: faca antes um backup da producao).

  3) IMAGENS - envia o zip para dentro do app da API na SquareCloud (mesmo envio do deploy, sem reiniciar e sem apagar nada que ja' esta' la'):
        $env:SQUARE_API_KEY="..." ; $env:SQUARE_APP_ID_API="..."
        python scripts/enviar_para_producao.py enviar-imagens --teste      # manda so' um arquivo de teste, para ver se o app aceita
        python scripts/enviar_para_producao.py enviar-imagens --confirmo   # manda as imagens de verdade
        python scripts/enviar_para_producao.py enviar-imagens --lista envio/imagens_novas.txt --confirmo   # manda so' as imagens da lista
     Sem chave? Envie o `envio/imagens.zip` pelo painel do app (Commit/Upload de arquivos).

IMPORTANTE: o Deploy API (migracoes) precisa ter rodado ANTES, para a producao estar na mesma versao do banco que o dump.
--desde-id: maior ID de imagem que a PRODUCAO ja' tem (veja em /admin/media da producao; o padrao e' o do backup de 18/10).
"""
import argparse
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import httpx

from scripts.migrar_banco import CONTAINER, ROOT, ler_env, tem_docker

ENVIO = ROOT / "envio"
UPLOADS = ROOT / "uploads"
TEMPORARIO = "ninwiki_envio"
LOCAL_PADRAO = "http://localhost:8000"
PRODUCAO_PADRAO = "https://api.guima.net"
DESDE_ID_PADRAO = 4799   # a producao tinha 4.799 imagens no backup de 18/10/2026 (as novas ficam com ID maior)

# Troca o texto em TODA coluna de texto/JSON do banco temporario e conta o que mudou e o que sobrou.
SQL_TROCAR = """
DO $$
DECLARE r record; n bigint; total bigint := 0; sobra bigint := 0;
BEGIN
  FOR r IN SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c
           JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
           WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying', 'json', 'jsonb') LOOP
    IF r.data_type IN ('json', 'jsonb') THEN
      EXECUTE format('UPDATE %I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L', r.table_name, r.column_name, r.column_name, '__LOCAL__', '__PROD__', r.data_type, r.column_name, '%__LOCAL__%');
    ELSE
      EXECUTE format('UPDATE %I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L', r.table_name, r.column_name, r.column_name, '__LOCAL__', '__PROD__', r.column_name, '%__LOCAL__%');
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    EXECUTE format('SELECT count(*) FROM %I WHERE %I::text LIKE %L', r.table_name, r.column_name, '%localhost%') INTO n; sobra := sobra + n;
  END LOOP;
  RAISE NOTICE 'TROCADOS=% SOBRARAM_LOCALHOST=%', total, sobra;
END $$;
"""
SQL_CONTAGEM = """
SELECT 'content_items', count(*) FROM content_items UNION ALL SELECT 'content_item_drops', count(*) FROM content_item_drops
UNION ALL SELECT 'media_images', count(*) FROM media_images UNION ALL SELECT 'posts', count(*) FROM posts
UNION ALL SELECT 'users', count(*) FROM users UNION ALL SELECT 'readers', count(*) FROM readers UNION ALL SELECT 'post_comments', count(*) FROM post_comments;
"""


def docker(*args: str, entrada: str | None = None, saida=None) -> subprocess.CompletedProcess:
    """Roda um comando dentro do container do banco local."""
    return subprocess.run(["docker", "exec", *(["-i"] if entrada is not None else []), CONTAINER, *args], input=entrada, text=entrada is not None,
                          capture_output=saida is None, stdout=saida)


def preparar(args: argparse.Namespace) -> None:
    """Gera o dump com os enderecos trocados e o zip das imagens novas (nada e' enviado nem alterado)."""
    if not tem_docker():
        sys.exit("O Docker nao esta' respondendo. Ligue o Docker Desktop e o container do banco (docker compose up -d).")
    env = ler_env()
    usuario, banco = env.get("POSTGRES_USER", "ninwiki"), env.get("POSTGRES_DB", "ninwiki")
    ENVIO.mkdir(exist_ok=True)
    dump = ENVIO / "ninwiki-producao.dump"
    zip_img = ENVIO / "imagens.zip"

    print("1/4 Copiando o banco local para um banco temporario...")
    for sql in (f"DROP DATABASE IF EXISTS {TEMPORARIO}", f"CREATE DATABASE {TEMPORARIO}"):
        r = docker("psql", "-U", usuario, "-d", "postgres", "-c", sql)
        if r.returncode != 0:
            sys.exit("Falhou ao preparar o banco temporario:\n" + r.stderr.decode(errors="ignore")[-400:])
    r = docker("sh", "-c", f"pg_dump -Fc --no-owner --no-acl -U {usuario} {banco} | pg_restore --no-owner --no-acl -U {usuario} -d {TEMPORARIO}")
    if r.returncode != 0:
        sys.exit("Falhou ao copiar o banco:\n" + r.stderr.decode(errors="ignore")[-400:])

    try:
        print(f"2/4 Trocando {args.local} por {args.producao} no banco temporario...")
        sql = SQL_TROCAR.replace("__LOCAL__", args.local).replace("__PROD__", args.producao)
        r = docker("psql", "-U", usuario, "-d", TEMPORARIO, "-v", "ON_ERROR_STOP=1", "-f", "-", entrada=sql)
        if r.returncode != 0:
            sys.exit("Falhou ao trocar os enderecos:\n" + r.stderr[-400:])
        aviso = next((l for l in r.stderr.splitlines() if "TROCADOS=" in l), "")
        print("    ", aviso.split("NOTICE:")[-1].strip())
        if "SOBRARAM_LOCALHOST=0" not in aviso:
            print("    ATENCAO: ainda sobrou texto com 'localhost' (pode ser um texto de ajuda, nao uma imagem). Confira antes de enviar.")

        print("3/4 Gerando o dump para a producao...")
        with open(dump, "wb") as f:
            r = docker("pg_dump", "-Fc", "--no-owner", "--no-acl", "-U", usuario, TEMPORARIO, saida=f)
        if r.returncode != 0 or dump.stat().st_size == 0:
            dump.unlink(missing_ok=True)
            sys.exit("Falhou ao gerar o dump.")
        contagem = docker("psql", "-U", usuario, "-d", TEMPORARIO, "-At", "-F", " = ", "-c", SQL_CONTAGEM).stdout.decode(errors="ignore")
        imagens = docker("psql", "-U", usuario, "-d", banco, "-At", "-c", f"SELECT filename FROM media_images WHERE id > {args.desde_id} ORDER BY id").stdout.decode().split()
    finally:
        docker("psql", "-U", usuario, "-d", "postgres", "-c", f"DROP DATABASE IF EXISTS {TEMPORARIO}")

    print(f"4/4 Juntando as imagens novas (ID > {args.desde_id})...")
    faltando = [n for n in imagens if not (UPLOADS / n).is_file()]
    zip_img.unlink(missing_ok=True)
    with zipfile.ZipFile(zip_img, "w", zipfile.ZIP_DEFLATED) as z:
        for nome in imagens:
            if nome not in faltando:
                z.write(UPLOADS / nome, f"uploads/{nome}")

    print("\n=== CONFERENCIA ===")
    print("Linhas no dump (banco que vai para a producao):")
    for linha in contagem.strip().splitlines():
        print("  ", linha)
    print(f"Dump:   {dump}  ({dump.stat().st_size / 1024:.0f} KB)")
    print(f"Imagens novas: {len(imagens) - len(faltando)} no zip ({zip_img.stat().st_size / 1024:.0f} KB)" + (f" | {len(faltando)} sem arquivo em uploads/ (nao entram)" if faltando else ""))
    print("\n=== PROXIMOS PASSOS (nesta ordem) ===")
    print("1. Faca um backup da producao e confirme que o Deploy API (migracoes) ja' rodou.")
    print('2. Banco (SUBSTITUI as tabelas da producao):\n   python scripts/migrar_banco.py importar envio/ninwiki-producao.dump --url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO" '
          "--ssl-ca certs/ca-certificate.crt --ssl-cert certs/certificate.pem --ssl-key certs/private-key.key --confirmo")
    print("3. Imagens:\n   python scripts/enviar_para_producao.py enviar-imagens --teste      (depois)  ... --confirmo")


def enviar_imagens(args: argparse.Namespace) -> None:
    """Envia o zip das imagens (ou um arquivo de teste) para o app da API na SquareCloud, sem reiniciar."""
    chave = os.environ.get("SQUARE_API_KEY", "").strip()
    app_id = (args.app_id or os.environ.get("SQUARE_APP_ID_API", "")).strip()
    if not chave or not app_id:
        sys.exit("Faltam SQUARE_API_KEY e SQUARE_APP_ID_API (ou --app-id). Sem chave, envie envio/imagens.zip pelo painel do app.")
    if args.teste:
        arquivo = ENVIO / "teste-envio.zip"
        ENVIO.mkdir(exist_ok=True)
        with zipfile.ZipFile(arquivo, "w") as z:
            z.writestr("uploads/_teste_envio.txt", "teste de envio de imagens (pode apagar)")
    elif args.lista:
        # Monta o zip so' com as imagens listadas (uma por linha, ex.: envio/imagens_novas.txt), tiradas de uploads/.
        nomes = [l.strip() for l in Path(args.lista).read_text(encoding="utf-8").splitlines() if l.strip()]
        faltando = [n for n in nomes if not (UPLOADS / n).is_file()]
        if faltando:
            sys.exit(f"{len(faltando)} imagem(ns) da lista nao existem em uploads/ (ex.: {faltando[0]}). Nada foi enviado.")
        if not args.confirmo:
            sys.exit("Isto envia arquivos para a PRODUCAO. Rode com --confirmo (ou use --teste antes).")
        arquivo = ENVIO / "imagens-novas.zip"
        with zipfile.ZipFile(arquivo, "w", zipfile.ZIP_DEFLATED) as z:
            for nome in nomes:
                z.write(UPLOADS / nome, f"uploads/{nome}")
        print(f"Zip montado com {len(nomes)} imagens da lista {args.lista}.")
    else:
        arquivo = ENVIO / "imagens.zip"
        if not arquivo.is_file():
            sys.exit("Nao achei envio/imagens.zip. Rode primeiro: python scripts/enviar_para_producao.py preparar")
        if not args.confirmo:
            sys.exit("Isto envia arquivos para a PRODUCAO. Rode com --confirmo (ou use --teste antes).")
    print(f"Enviando {arquivo.name} ({arquivo.stat().st_size / 1024:.0f} KB) para o app {app_id[:6]}... (sem reiniciar)")
    with open(arquivo, "rb") as f:
        resp = httpx.post(f"https://api.squarecloud.app/v2/apps/{app_id}/commit?restart=false", headers={"Authorization": chave},
                          files={"file": (arquivo.name, f, "application/zip")}, timeout=300)
    print("HTTP", resp.status_code, resp.text[:300])
    if resp.status_code >= 300 or '"status":"error"' in resp.text.replace(" ", ""):
        sys.exit(1)
    print("Enviado." + (" Confira nos Files do app se uploads/_teste_envio.txt apareceu e se o resto do app continua la'." if args.teste else ""))


def main() -> None:
    """Le a linha de comando."""
    ap = argparse.ArgumentParser(description="Prepara e envia banco + imagens novas para a producao.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("preparar", help="gera envio/ninwiki-producao.dump e envio/imagens.zip (nao envia nada)")
    p.add_argument("--local", default=LOCAL_PADRAO, help="endereco local gravado no banco (padrao: %(default)s)")
    p.add_argument("--producao", default=PRODUCAO_PADRAO, help="endereco da API em producao (padrao: %(default)s)")
    p.add_argument("--desde-id", type=int, default=DESDE_ID_PADRAO, help="maior ID de imagem que a producao ja' tem (padrao: %(default)s)")
    e = sub.add_parser("enviar-imagens", help="envia envio/imagens.zip para o app da API na SquareCloud")
    e.add_argument("--app-id", help="ID do app da API (ou a variavel SQUARE_APP_ID_API)")
    e.add_argument("--teste", action="store_true", help="envia so' um arquivo de teste")
    e.add_argument("--lista", help="em vez de envio/imagens.zip, monta o zip a partir de uma lista de nomes em uploads/ (ex.: envio/imagens_novas.txt)")
    e.add_argument("--confirmo", action="store_true", help="confirma o envio das imagens")
    args = ap.parse_args()
    preparar(args) if args.cmd == "preparar" else enviar_imagens(args)


if __name__ == "__main__":
    main()
