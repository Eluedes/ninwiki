#!/usr/bin/env bash
# Funcoes comuns dos scripts do kit (carregado com "source"). Nao execute direto.
# O .env NAO e' carregado com "source" (valores como <...> quebrariam o shell): so' lemos a variavel que precisamos.

KIT_DIR="${KIT_DIR:-/opt/ninwiki}"

# envv NOME -> imprime o valor de NOME no .env (sem aspas externas). Nunca imprime o .env inteiro.
envv() {
  local v
  v="$(grep -E "^$1=" "$KIT_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2-)"
  v="${v%\"}"; v="${v#\"}"
  printf '%s' "$v"
}

# alerta "mensagem" -> manda para o webhook do Discord (se configurado). Nunca derruba o script.
alerta() {
  local hook; hook="$(envv ALERT_DISCORD_WEBHOOK)"
  echo "[alerta] $1" >&2
  [ -n "$hook" ] || return 0
  curl -sS -m 10 -H 'Content-Type: application/json' \
    -d "{\"content\":\"[NinWiki Azure] $(printf '%s' "$1" | tr -d '"\\')\"}" "$hook" >/dev/null 2>&1 || true
}

# token_storage -> token de acesso ao Blob Storage da IDENTIDADE GERENCIADA da VM (nenhuma senha/chave guardada na VM).
token_storage() {
  curl -sS -m 10 -H 'Metadata:true' \
    'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https%3A%2F%2Fstorage.azure.com%2F' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])'
}

# blob_url NOME -> URL completa do blob no container de backups.
blob_url() {
  printf 'https://%s.blob.core.windows.net/%s/%s' "$(envv STORAGE_ACCOUNT)" "$(envv STORAGE_CONTAINER)" "$1"
}

# arquivo_cabecalhos -> cria (0600) um arquivo com o cabecalho Authorization, para o token nao aparecer na lista de processos.
arquivo_cabecalhos() {
  local f; f="$(mktemp)"; chmod 600 "$f"
  printf 'Authorization: Bearer %s\n' "$(token_storage)" > "$f"
  printf '%s' "$f"
}
