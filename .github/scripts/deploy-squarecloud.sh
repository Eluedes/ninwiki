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

# Certificados do banco da SquareCloud (TLS com certificado de cliente) - só para a API, vindos dos Secrets.
# O conteúdo de cada arquivo fica num Secret; aqui eles viram NinWiki.Api/certs/* DENTRO do zip enviado.
if [ -n "${DB_SSL_CA:-}${DB_SSL_CERT:-}${DB_SSL_KEY:-}" ]; then
  mkdir -p "$DIR/certs"
  [ -n "${DB_SSL_CA:-}" ]   && printf '%s\n' "$DB_SSL_CA"   > "$DIR/certs/ca.crt"
  [ -n "${DB_SSL_CERT:-}" ] && printf '%s\n' "$DB_SSL_CERT" > "$DIR/certs/client.pem"
  [ -n "${DB_SSL_KEY:-}" ]  && printf '%s\n' "$DB_SSL_KEY"  > "$DIR/certs/client.key"
fi

rm -f "$ZIP"
( cd "$DIR" && zip -qr "$ZIP" . \
    -x "node_modules/*" ".next/*" "venv/*" ".venv/*" "__pycache__/*" "*/__pycache__/*" \
       "uploads/*" "staff_files/*" "backups/*" "*.dump" "log_state.json" "error_state.json" ".git/*" )

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
rm -rf resp.json "$ZIP" "$DIR/.env" "$DIR/certs"

[ "$HTTP" -ge 200 ] && [ "$HTTP" -lt 300 ] || { echo "::error::Deploy falhou (HTTP $HTTP)"; exit 1; }
echo "Deploy enviado."
