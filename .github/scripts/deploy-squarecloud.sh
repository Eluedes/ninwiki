#!/usr/bin/env bash
# Uso: deploy-squarecloud.sh <pasta> <nome.zip>
# Variáveis: SQUARE_API_KEY, APP_ID, APP_ENV (conteúdo do .env), RESTART (true/false)
set -euo pipefail

DIR="$1"
ZIP="$(pwd)/$2"

for v in SQUARE_API_KEY APP_ID APP_ENV; do
  if [ -z "${!v:-}" ]; then
    echo "::error::Secret/variável '$v' vazia. Veja o cabeçalho do workflow deploy-*.yml."
    exit 1
  fi
done

# Grava o .env só aqui dentro do runner (nunca vai pro Git).
printf '%s\n' "$APP_ENV" > "$DIR/.env"

rm -f "$ZIP"
( cd "$DIR" && zip -qr "$ZIP" . \
    -x "node_modules/*" ".next/*" "venv/*" ".venv/*" "__pycache__/*" "*/__pycache__/*" \
       "uploads/*" ".git/*" )

[ -f "$DIR/squarecloud.app" ] || { echo "::error::squarecloud.app não encontrado em $DIR"; exit 1; }

echo "Enviando $(du -h "$ZIP" | cut -f1) para o app ${APP_ID}..."
RESTART_FLAG="false"; [ "${RESTART:-true}" = "true" ] && RESTART_FLAG="true"

HTTP=$(curl -sS -o resp.json -w '%{http_code}' -X POST \
  "https://api.squarecloud.app/v2/apps/${APP_ID}/commit?restart=${RESTART_FLAG}" \
  -H "Authorization: ${SQUARE_API_KEY}" \
  -F "file=@${ZIP}")

echo "HTTP ${HTTP}"
# Mostra a resposta mas nunca o .env.
cat resp.json; echo
rm -f resp.json "$ZIP" "$DIR/.env"

[ "$HTTP" -ge 200 ] && [ "$HTTP" -lt 300 ] || { echo "::error::Deploy falhou (HTTP $HTTP)"; exit 1; }
echo "Deploy enviado."
