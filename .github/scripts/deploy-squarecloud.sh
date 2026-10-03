#!/usr/bin/env bash
# Uso: deploy-squarecloud.sh <pasta> <nome.zip>
# Variáveis: SQUARE_API_KEY, APP_ID, RESTART (true/false)
# O .env NAO vai mais no pacote: as senhas ficam nas "Variaveis de Ambiente" do painel da SquareCloud (cada app).
set -euo pipefail

DIR="$1"
ZIP="$(pwd)/$2"

for v in SQUARE_API_KEY APP_ID; do
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
# VERSION.json: sha + titulo + data da atualizacao (o bot mostra no Discord). Em merge do GitHub o titulo util esta' no CORPO do commit (titulo do PR).
SUBJECT="$(git log -1 --format=%s 2>/dev/null || true)"; BODY="$(git log -1 --format=%b 2>/dev/null | head -n1 || true)"
case "$SUBJECT" in "Merge pull request"*) [ -n "$BODY" ] && SUBJECT="$BODY" ;; esac
COMMIT_DATE="$(git log -1 --format=%cI 2>/dev/null || true)"
V_SHA="${GIT_SHA:-unknown}" V_MSG="$SUBJECT" V_DATE="$COMMIT_DATE" python3 -c 'import json,os; print(json.dumps({"sha": os.environ["V_SHA"][:40], "message": os.environ["V_MSG"][:200], "date": os.environ["V_DATE"]}))' > "$DIR/VERSION.json"

# Nenhum .env e' gravado aqui: as variaveis vivem no painel da SquareCloud (Variaveis de Ambiente) e persistem entre deploys.
rm -f "$DIR/.env"

# Certificados do banco: NAO vao mais como arquivos. O texto de cada um fica nas Variaveis de Ambiente do app da API (DATABASE_SSL_CA/CERT/KEY).

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
  ( cd "$DIR" && zip -qr "$ZIP" . -x ".git/*" ".env" ".env.*" "certs/*" "*.pem" "*.key" "*.crt" "*.md" "*.example" "*.map" "CONTEXTO_PARA_IA*" "ROADMAP*" "FASE2*" )
else
  ( cd "$DIR" && zip -qr "$ZIP" . \
      -x "node_modules/*" ".next/*" "venv/*" ".venv/*" "__pycache__/*" "*/__pycache__/*" \
         ".env" ".env.*" "certs/*" "*.pem" "*.key" "*.crt" "uploads/*" "staff_files/*" "backups/*" "*.dump" "log_state.json" "error_state.json" "status_state.json" "language_state.json" ".git/*" \
         `# so' desenvolvimento/documentacao - nao e' necessario para rodar na SquareCloud:` \
         "*.md" "*.example" "docker-compose*.yml" "scripts/*" "diagnostico_conexao.py" ".squarecloudignore" )
fi

# TRAVA DE SEGURANCA: documentacao, exemplos, scripts de teste e dumps NUNCA podem ir para a SquareCloud (se alguem extrair o pacote,
# nao deve achar os .md nem o jeito de rodar o projeto). Se algum escapar das exclusoes acima, o deploy para aqui, antes de enviar.
LEAKS=$(unzip -Z1 "$ZIP" | grep -Ev '(^|/)node_modules/' | grep -Ei '(^|/)\.env(\..*)?$|(^|/)certs/|\.(pem|key|crt|p12|pfx)$|\.md$|\.example$|\.map$|\.dump$|(^|/)scripts/|docker-compose|CONTEXTO_PARA_IA|ROADMAP|FASE2|diagnostico_conexao|\.git/' || true)
if [ -n "$LEAKS" ]; then
  echo "::error::Arquivos que NAO devem ir para a producao estao no pacote:"; echo "$LEAKS" | head -20
  rm -f "$ZIP"; exit 1
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
# Mostra a resposta da SquareCloud (nao contem segredos).
cat resp.json; echo
cp resp.json /tmp/square-resp.json; rm -rf resp.json "$ZIP"
RESP=/tmp/square-resp.json

[ "$HTTP" -ge 200 ] && [ "$HTTP" -lt 300 ] || { echo "::error::Deploy falhou (HTTP $HTTP). Veja a resposta da SquareCloud acima."; exit 1; }
# A SquareCloud pode responder 200 com {"status":"error",...}: nesse caso também é falha.
if grep -q '"status"[[:space:]]*:[[:space:]]*"error"' "$RESP" 2>/dev/null; then echo "::error::A SquareCloud respondeu com erro (corpo acima)."; exit 1; fi
echo "Deploy enviado."

# Rede de seguranca: alem do ?restart=true do envio, pede o reinicio de novo (a extracao de um pacote grande, como o do site, pode terminar depois
# do reinicio do envio e o app seguir rodando o codigo antigo). Nao derruba o deploy se falhar: so' avisa, e o app pode ser reiniciado no painel.
if [ "$RESTART_FLAG" = "true" ]; then
  sleep 15
  RHTTP=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "https://api.squarecloud.app/v2/apps/${APP_ID}/restart" -H "Authorization: ${SQUARE_API_KEY}" || echo "000")
  case "$RHTTP" in
    2??) echo "Reinicio extra pedido (HTTP ${RHTTP})." ;;
    *) echo "::warning::Nao consegui pedir o reinicio extra (HTTP ${RHTTP}). Se o app seguir na versao antiga, reinicie pelo painel da SquareCloud." ;;
  esac
fi
