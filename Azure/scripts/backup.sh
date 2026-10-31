#!/usr/bin/env bash
# Backup diario: pg_dump + imagens -> cifra com age (chave PUBLICA) -> Azure Blob Storage.
# Roda pelo systemd timer (ninwiki-backup.timer) e tambem manualmente:  /opt/ninwiki/scripts/backup.sh
#
# Seguranca:
#  - A VM so' tem a chave PUBLICA do age: mesmo invadida, nao le' os backups antigos.
#  - O envio usa a identidade gerenciada da VM (papel "Storage Blob Data Contributor" so' nesse container): sem chave de storage na VM.
#  - A limpeza de backups com mais de 30 dias e' feita pelo proprio Azure (politica de ciclo de vida), nao por este script.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
cd "$KIT_DIR"

falhou() { alerta "BACKUP FALHOU na linha $1. Veja: journalctl -u ninwiki-backup"; }
trap 'falhou $LINENO' ERR

RECIPIENT="$(envv AGE_RECIPIENT)"
case "$RECIPIENT" in age1*) ;; *) echo "AGE_RECIPIENT invalido no .env (deve comecar com age1)"; exit 1 ;; esac
PGUSER="$(envv POSTGRES_USER)"; PGDB="$(envv POSTGRES_DB)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

umask 077
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "[backup] banco..."
docker compose exec -T postgres pg_dump -U "$PGUSER" -d "$PGDB" -Fc | age -r "$RECIPIENT" -o "$TMP/db.dump.age"

echo "[backup] imagens e anexos da equipe..."
docker run --rm --network none --cap-drop ALL --security-opt no-new-privileges \
  -v ninwiki_api_uploads:/u:ro -v ninwiki_api_staff_files:/s:ro postgres:17-alpine tar -c -C / u s \
  | age -r "$RECIPIENT" -o "$TMP/files.tar.age"

HDR="$(arquivo_cabecalhos)"; trap 'rm -rf "$TMP" "$HDR"' EXIT
enviar() {   # enviar <arquivo local> <nome do blob>
  local code
  code="$(curl -sS -m 1800 -o /dev/null -w '%{http_code}' -X PUT -H @"$HDR" -H 'x-ms-version: 2021-08-06' \
          -H 'x-ms-blob-type: BlockBlob' -T "$1" "$(blob_url "$2")")"
  [ "$code" = "201" ] || { echo "envio de $2 falhou (HTTP $code)"; return 1; }
  echo "[backup] enviado: $2 ($(du -h "$1" | cut -f1))"
}
enviar "$TMP/db.dump.age"    "db/ninwiki-$STAMP.dump.age"
enviar "$TMP/files.tar.age"  "files/ninwiki-$STAMP-files.tar.age"

date -u +%s > "$KIT_DIR/.ultimo_backup_ok"   # lido pelo monitorar.sh (alerta se ficar velho)
echo "[backup] ok."
