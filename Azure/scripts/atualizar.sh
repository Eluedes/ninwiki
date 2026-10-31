#!/usr/bin/env bash
# Atualiza o site: baixa as imagens novas e reinicia SO' o que mudou, esperando ficar saudavel.
# Uso:  atualizar.sh [servico ...]      (padrao: api web bot; ordem importante: API primeiro, depois site, depois bot)
# Rollback: IMAGE_TAG=<sha-antigo> ./atualizar.sh   (ou mude IMAGE_TAG no .env) - ver LEIA-ME.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
cd "$KIT_DIR"

SERVICOS=("$@"); [ ${#SERVICOS[@]} -gt 0 ] || SERVICOS=(api web bot)
export IMAGE_TAG="${IMAGE_TAG:-$(envv IMAGE_TAG)}"; : "${IMAGE_TAG:=latest}"

# Garante a infraestrutura de base no ar (banco, proxy, tunel) sem reiniciar o que ja' roda.
docker compose up -d postgres caddy cloudflared

for s in "${SERVICOS[@]}"; do
  echo "[atualizar] $s (tag $IMAGE_TAG): baixando..."
  docker compose pull "$s"
  docker compose up -d "$s"
  if [ "$s" = "bot" ]; then sleep 5; docker compose ps bot | grep -q Up || { echo "bot nao subiu"; docker compose logs --tail 30 bot; exit 1; }; continue; fi
  echo "[atualizar] $s: esperando ficar saudavel (ate 3 min)..."
  for _ in $(seq 1 36); do
    st="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}sem-check{{end}}' "ninwiki-$s-1" 2>/dev/null || echo ausente)"
    [ "$st" = "healthy" ] && break
    sleep 5
  done
  [ "$st" = "healthy" ] || { echo "ERRO: $s nao ficou saudavel (estado: $st). Ultimos logs:"; docker compose logs --tail 40 "$s"; exit 1; }
  echo "[atualizar] $s: saudavel."
done
docker image prune -f >/dev/null   # apaga imagens antigas sem uso (poupa disco)
docker compose ps
