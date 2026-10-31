#!/usr/bin/env bash
# Restaura um backup. Uso:
#   restaurar.sh listar                              -> mostra os backups no Azure
#   restaurar.sh db <nome-do-blob|arquivo.dump[.age]> -> restaura o BANCO (APAGA o banco atual!)
#   restaurar.sh files <nome-do-blob|arquivo.tar[.age]> -> restaura as imagens/anexos
# Para decifrar precisa da CHAVE PRIVADA do age: exporte o caminho dela (apague o arquivo depois):
#   AGE_IDENTITY=/caminho/chave-backup.txt ./restaurar.sh db db/ninwiki-AAAAMMDD-HHMMSS.dump.age
# Se o argumento for um arquivo local (ex.: o dump do banco mesclado), ele e' usado direto (decifra so' se terminar em .age).
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
cd "$KIT_DIR"

CMD="${1:-}"; ALVO="${2:-}"

if [ "$CMD" = "listar" ]; then
  HDR="$(arquivo_cabecalhos)"; trap 'rm -f "$HDR"' EXIT
  curl -sS -m 30 -H @"$HDR" -H 'x-ms-version: 2021-08-06' \
    "https://$(envv STORAGE_ACCOUNT).blob.core.windows.net/$(envv STORAGE_CONTAINER)?restype=container&comp=list" \
    | grep -o '<Name>[^<]*</Name>' | sed 's/<[^>]*>//g' | sort
  exit 0
fi
{ [ "$CMD" = "db" ] || [ "$CMD" = "files" ]; } && [ -n "$ALVO" ] || { sed -n '2,10p' "$0"; exit 1; }

umask 077
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP" "${HDR:-}"' EXIT
ARQ="$ALVO"
if [ ! -f "$ALVO" ]; then
  HDR="$(arquivo_cabecalhos)"
  ARQ="$TMP/baixado"
  echo "[restaurar] baixando $ALVO ..."
  curl -fsS -m 1800 -H @"$HDR" -H 'x-ms-version: 2021-08-06' -o "$ARQ" "$(blob_url "$ALVO")"
fi
case "$ALVO" in
  *.age)
    [ -f "${AGE_IDENTITY:-}" ] || { echo "Defina AGE_IDENTITY=/caminho/da/chave-privada-age"; exit 1; }
    age -d -i "$AGE_IDENTITY" -o "$TMP/claro" "$ARQ"; ARQ="$TMP/claro" ;;
esac

PGUSER="$(envv POSTGRES_USER)"; PGDB="$(envv POSTGRES_DB)"
echo "ATENCAO: isto vai SUBSTITUIR os dados atuais ($CMD). Faca 'scripts/backup.sh' antes se houver algo a salvar."
read -r -p "Digite RESTAURAR para continuar: " ok; [ "$ok" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

if [ "$CMD" = "db" ]; then
  echo "[restaurar] parando API, site e bot..."
  docker compose stop bot web api
  docker compose exec -T postgres psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$PGDB\" WITH (FORCE);" -c "CREATE DATABASE \"$PGDB\" OWNER \"$PGUSER\";"
  docker compose exec -T postgres pg_restore -U "$PGUSER" -d "$PGDB" --no-owner --exit-on-error < "$ARQ"
  echo "[restaurar] banco restaurado. Subindo tudo (a API aplica as migrations que faltarem)..."
  docker compose up -d
else
  # Devolve o conteudo para os volumes (formato do backup: pastas u/ = uploads e s/ = staff_files).
  docker run --rm --network none -u 0 --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER \
    -v ninwiki_api_uploads:/u -v ninwiki_api_staff_files:/s -v "$ARQ":/in.tar:ro postgres:17-alpine \
    sh -c 'tar -x -C / -f /in.tar && chown -R 10001:10001 /u /s'
  docker compose restart api
fi
echo "[restaurar] pronto. Confira: docker compose ps"
