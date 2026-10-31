#!/usr/bin/env bash
# Instala os timers do systemd (backup diario + monitor). Rode UMA vez na VM, como administrador:
#   sudo /opt/ninwiki/scripts/instalar_timers.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo."; exit 1; }
KIT_DIR="${KIT_DIR:-/opt/ninwiki}"
chmod +x "$KIT_DIR"/scripts/*.sh
cp "$KIT_DIR"/systemd/ninwiki-*.service "$KIT_DIR"/systemd/ninwiki-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ninwiki-backup.timer ninwiki-monitor.timer
systemctl list-timers 'ninwiki-*' --no-pager
