#!/usr/bin/env bash
# Confere a seguranca basica da VM e imprime OK / ATENCAO / FALHA. Somente LE (nao muda nada). Nao imprime segredos.
# Uso (na VM):  sudo /opt/ninwiki/scripts/verificar_seguranca.sh      (sudo so' para ler a configuracao do sshd/ufw)
KIT_DIR="${KIT_DIR:-/opt/ninwiki}"
falhas=0
ok()   { echo "  [OK]      $1"; }
aviso(){ echo "  [ATENCAO] $1"; }
falha(){ echo "  [FALHA]   $1"; falhas=$((falhas+1)); }

echo "== Portas abertas para fora (so' a 22 e' esperada) =="
portas="$(ss -H -tlnp 2>/dev/null | awk '{print $4}' | grep -Ev '^(127\.|\[::1\]|\[fe80)' | sed 's/.*://' | sort -un | tr '\n' ' ')"
echo "  escutando em: ${portas:-nenhuma}"
for p in $portas; do
  case "$p" in 22|53) ;; *) falha "porta $p escutando fora do localhost (nao deveria; confira docker-compose.yml: nenhum 'ports:')" ;; esac
done
if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -q '0.0.0.0\|:::'; then falha "algum container publica porta no host"; else ok "nenhum container publica porta"; fi

echo "== Firewall (ufw) =="
if command -v ufw >/dev/null; then
  st="$(ufw status verbose 2>/dev/null)"
  echo "$st" | grep -q 'Status: active' && ok "ufw ativo" || falha "ufw desligado"
  echo "$st" | grep -q 'deny (incoming)' && ok "entrada negada por padrao" || falha "ufw nao nega entrada por padrao"
else falha "ufw nao instalado"; fi

echo "== SSH =="
sshd_cfg="$(sshd -T 2>/dev/null)"
if [ -n "$sshd_cfg" ]; then
  echo "$sshd_cfg" | grep -qi '^passwordauthentication no' && ok "senha desligada (so' chave)" || falha "PasswordAuthentication nao e' 'no'"
  echo "$sshd_cfg" | grep -qi '^permitrootlogin no' && ok "login de root desligado" || falha "PermitRootLogin nao e' 'no'"
else aviso "nao consegui ler o sshd (rode com sudo)"; fi
systemctl is-active --quiet fail2ban && ok "fail2ban ativo" || falha "fail2ban parado"

echo "== Segredos =="
if [ -f "$KIT_DIR/.env" ]; then
  perm="$(stat -c '%a %U' "$KIT_DIR/.env")"
  [ "${perm%% *}" = "600" ] && ok ".env com permissao 600 (${perm##* })" || falha ".env com permissao $perm (use: chmod 600 $KIT_DIR/.env)"
  grep -q '<' "$KIT_DIR/.env" && aviso ".env ainda tem algum placeholder <...> (campo vazio ou nao preenchido?)"
else falha ".env nao encontrado em $KIT_DIR"; fi
ls "$KIT_DIR"/*.key "$KIT_DIR"/chave-backup* 2>/dev/null | grep -q . && falha "ha' chave privada solta em $KIT_DIR (apague: shred -u)" || ok "sem chave privada solta"

echo "== Atualizacoes =="
pend="$(apt list --upgradable 2>/dev/null | grep -c upgradable)"
[ "$pend" -eq 0 ] && ok "sistema em dia" || aviso "$pend pacote(s) a atualizar (unattended-upgrades cuida; confira: apt list --upgradable)"
[ -f /var/run/reboot-required ] && aviso "reinicio pendente (kernel novo): sudo reboot" || ok "sem reinicio pendente"
systemctl is-enabled --quiet unattended-upgrades && ok "unattended-upgrades ligado" || falha "unattended-upgrades desligado"

echo "== Containers e backup =="
docker compose -f "$KIT_DIR/docker-compose.yml" --project-directory "$KIT_DIR" ps --format '{{.Name}} {{.Status}}' 2>/dev/null | while read -r l; do echo "  $l"; done
if [ -f "$KIT_DIR/.ultimo_backup_ok" ]; then
  idade=$(( ( $(date +%s) - $(cat "$KIT_DIR/.ultimo_backup_ok") ) / 3600 ))
  [ "$idade" -le 30 ] && ok "ultimo backup ha' ${idade}h" || falha "ultimo backup ha' ${idade}h (esperado: diario)"
else aviso "nenhum backup registrado ainda"; fi
disco="$(df --output=pcent / | tail -1 | tr -dc 0-9)"
[ "$disco" -lt 80 ] && ok "disco em ${disco}%" || falha "disco em ${disco}%"

echo
[ "$falhas" -eq 0 ] && echo "Resultado: tudo certo." || echo "Resultado: $falhas FALHA(S). Corrija antes de considerar seguro."
exit "$falhas"
