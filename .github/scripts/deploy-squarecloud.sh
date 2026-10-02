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

# Secrets colados no GitHub costumam trazer espaço/quebra de linha no fim: no cabeçalho HTTP isso invalida a chave.
SQUARE_API_KEY="$(printf '%s' "$SQUARE_API_KEY" | tr -d '[:space:]')"
APP_ID="$(printf '%s' "$APP_ID" | tr -d '[:space:]')"
# O ID do app é só letras e números (32 caracteres). Se veio outra coisa (URL inteira, "id: ...", aspas), a URL do envio quebra.
if ! [[ "$APP_ID" =~ ^[A-Za-z0-9]+$ ]]; then
  echo "::error::O Secret do ID do app está inválido (deve ser só o ID, ex.: 3f9a...; sem URL, aspas, espaços ou o nome do campo). Valor recebido tem ${#APP_ID} caracteres."
  exit 1
fi
echo "Chave: ${#SQUARE_API_KEY} caracteres | ID do app: ${APP_ID}"

# Diagnóstico (só informa, não bloqueia): a SquareCloud reconhece a chave e esse ID de app?
CHECK=$(curl -sS -o /dev/null -w '%{http_code}' "https://api.squarecloud.app/v2/apps/${APP_ID}" -H "Authorization: ${SQUARE_API_KEY}" || echo "000")
case "$CHECK" in
  200) echo "Conferência: chave e ID do app reconhecidos (HTTP 200)." ;;
  401|403) echo "::warning::A SquareCloud recusou a chave (HTTP $CHECK). Gere uma nova em 'perfil > API Key' e atualize o Secret SQUARE_API_KEY." ;;
  404) echo "::warning::App '${APP_ID}' não encontrado para esta chave (HTTP 404). Confira o Secret SQUARE_APP_ID_* e se o app é da mesma conta da chave." ;;
  *) echo "::warning::Conferência inconclusiva (HTTP $CHECK) - seguindo para o envio." ;;
esac

# Versao publicada (commit do GitHub): a API mostra em /health e o painel (S.Adm) mostra no rodape - serve para saber o que esta no ar.
printf '%s\n' "${GIT_SHA:-unknown}" > "$DIR/VERSION"

# Grava o .env só aqui dentro do runner (nunca vai pro Git).
# (tr -d '\r': um Secret colado do Windows vem com quebra de linha CRLF - o "\r" ficaria grudado no fim de cada valor.)
printf '%s\n' "$APP_ENV" | tr -d '\r' > "$DIR/.env"

# Certificados do banco da SquareCloud (TLS com certificado de cliente) - só para a API, vindos dos Secrets.
# O conteúdo de cada arquivo fica num Secret; aqui eles viram NinWiki.Api/certs/* DENTRO do zip enviado.
if [ -n "${DB_SSL_CA:-}${DB_SSL_CERT:-}${DB_SSL_KEY:-}" ]; then
  mkdir -p "$DIR/certs"
  [ -n "${DB_SSL_CA:-}" ]   && printf '%s\n' "$DB_SSL_CA"   | tr -d '\r' > "$DIR/certs/ca.crt"
  [ -n "${DB_SSL_CERT:-}" ] && printf '%s\n' "$DB_SSL_CERT" | tr -d '\r' > "$DIR/certs/client.pem"
  [ -n "${DB_SSL_KEY:-}" ]  && printf '%s\n' "$DB_SSL_KEY"  | tr -d '\r' > "$DIR/certs/client.key"
  chmod 600 "$DIR/certs/"* 2>/dev/null || true
fi

# Banco de paises (DB-IP Lite, gratis, CC-BY 4.0) para o grafico de acessos da Visao Geral - so' para a API e so' se ainda nao
# houver o arquivo. Melhor esforco: se o download falhar o deploy segue normal e os acessos ficam como "Desconhecido"
# (a menos que o site esteja atras da Cloudflare, que ja' informa o pais).
if [ -f "$DIR/app/core/geoip.py" ] && [ ! -f "$DIR/geoip/country.mmdb" ]; then
  mkdir -p "$DIR/geoip"
  for OFFSET in "0 month" "1 month ago"; do
    MONTH=$(date -u -d "$OFFSET" +%Y-%m)
    if curl -fsS --max-time 60 -o "$DIR/geoip/country.mmdb.gz" "https://download.db-ip.com/free/dbip-country-lite-${MONTH}.mmdb.gz" \
       && gunzip -f "$DIR/geoip/country.mmdb.gz"; then
      echo "Banco de paises DB-IP ${MONTH} incluido."; break
    fi
    rm -f "$DIR/geoip/country.mmdb.gz" "$DIR/geoip/country.mmdb"
  done
  [ -f "$DIR/geoip/country.mmdb" ] || echo "::warning::Nao consegui baixar o banco de paises (DB-IP); o grafico de paises depende da Cloudflare."
fi

rm -f "$ZIP"
# PREBUILT=true: a pasta ja' e' o pacote final (site compilado: node_modules e .next sao justamente o que deve ir).
if [ "${PREBUILT:-false}" = "true" ]; then
  ( cd "$DIR" && zip -qr "$ZIP" . -x ".git/*" )
else
  ( cd "$DIR" && zip -qr "$ZIP" . \
      -x "node_modules/*" ".next/*" "venv/*" ".venv/*" "__pycache__/*" "*/__pycache__/*" \
         "uploads/*" "staff_files/*" "backups/*" "*.dump" "log_state.json" "error_state.json" "status_state.json" "language_state.json" ".git/*" \
         `# so' desenvolvimento/documentacao - nao e' necessario para rodar na SquareCloud:` \
         "*.md" "*.example" "docker-compose*.yml" "scripts/*" "diagnostico_conexao.py" ".squarecloudignore" )
fi

[ -f "$DIR/squarecloud.app" ] || { echo "::error::squarecloud.app não encontrado em $DIR"; exit 1; }

echo "Conteúdo do pacote (arquivos na raiz do zip):"
unzip -l "$ZIP" | awk 'NR>3 {print $4}' | grep -v '/' | grep -v '^$' | sort | head -40 || true
echo "Enviando $(du -h "$ZIP" | cut -f1) para o app ${APP_ID}..."
RESTART_FLAG="false"; [ "${RESTART:-true}" = "true" ] && RESTART_FLAG="true"

RESP=resp.json
HTTP=$(curl -sS -o resp.json -w '%{http_code}' -X POST \
  "https://api.squarecloud.app/v2/apps/${APP_ID}/commit?restart=${RESTART_FLAG}" \
  -H "Authorization: ${SQUARE_API_KEY}" \
  -F "file=@${ZIP}")

echo "HTTP ${HTTP}"
# Mostra a resposta mas nunca o .env.
cat resp.json; echo
cp resp.json /tmp/square-resp.json; rm -rf resp.json "$ZIP" "$DIR/.env" "$DIR/certs"
RESP=/tmp/square-resp.json

[ "$HTTP" -ge 200 ] && [ "$HTTP" -lt 300 ] || { echo "::error::Deploy falhou (HTTP $HTTP). Veja a resposta da SquareCloud acima."; exit 1; }
# A SquareCloud pode responder 200 com {"status":"error",...}: nesse caso também é falha.
if grep -q '"status"[[:space:]]*:[[:space:]]*"error"' "$RESP" 2>/dev/null; then echo "::error::A SquareCloud respondeu com erro (corpo acima)."; exit 1; fi
echo "Deploy enviado."
