#!/usr/bin/env bash
# Monitor simples (roda a cada 10 min pelo ninwiki-monitor.timer): avisa no Discord (ALERT_DISCORD_WEBHOOK) se
# o disco passar de 80%, algum container estiver doente/parado, ou o backup estiver atrasado. Avisa uma vez por problema por hora.
set -uo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"
cd "$KIT_DIR" || exit 1
ESTADO="/var/tmp/ninwiki-monitor-ultimo"
problemas=()

disco="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
[ "$disco" -ge 80 ] && problemas+=("disco em ${disco}%")

# Servicos esperados no ar e saudaveis
for s in postgres api web bot caddy cloudflared; do
  st="$(docker inspect --format '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}}' "ninwiki-$s-1" 2>/dev/null || echo ausente)"
  case "$st" in running/healthy|running/-) ;; *) problemas+=("$s: $st") ;; esac
done

if [ -f "$KIT_DIR/.ultimo_backup_ok" ]; then
  idade=$(( ( $(date +%s) - $(cat "$KIT_DIR/.ultimo_backup_ok") ) / 3600 ))
  [ "$idade" -gt 30 ] && problemas+=("backup atrasado (${idade}h)")
fi

if [ ${#problemas[@]} -gt 0 ]; then
  msg="${problemas[*]}"
  # Evita repetir o mesmo aviso a cada 10 minutos: so' reavisa se mudou ou passou 1 hora.
  if [ ! -f "$ESTADO" ] || [ "$(cut -d'|' -f2- "$ESTADO")" != "$msg" ] || [ $(( $(date +%s) - $(cut -d'|' -f1 "$ESTADO") )) -gt 3600 ]; then
    alerta "PROBLEMA: $msg"
    echo "$(date +%s)|$msg" > "$ESTADO"
  fi
else
  [ -f "$ESTADO" ] && { alerta "Tudo normal de novo."; rm -f "$ESTADO"; }
fi
exit 0
