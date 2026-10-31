# Hospedar o Nin Codex / NinWiki no Azure (guia para iniciante)

Este kit coloca **site + API + bot + banco** numa única máquina virtual (VM) do Azure, bem protegida.
Tudo aqui foi **preparado mas NÃO testado contra um Azure real** (não havia login). Siga na ordem e **pare e me chame se algum comando der erro** — não "force".

> Regra de ouro: **nunca** cole senhas, tokens ou o arquivo `.env` em chat, print, e-mail ou Git. Os arquivos deste kit só têm *placeholders* `<assim>`.

---

## 1. Visão geral

```
                    INTERNET
   visitante ───────►  CLOUDFLARE  (HTTPS, proteção contra ataques, cache)
                           ▲
                           │  túnel (conexão aberta DE DENTRO da VM para fora)
 ┌─────────────────────────┼──────────────────────────── VM Azure (Ubuntu 24.04) ─┐
 │  Firewall do Azure (NSG): NEGA toda entrada, exceto SSH (porta 22) do SEU IP     │
 │  ufw + fail2ban + atualizações automáticas                                       │
 │                         │                                                        │
 │   ┌──────────────┐  ┌───┴─────┐   rede "edge" (interna do Docker)               │
 │   │ cloudflared  ├─►│  caddy  ├──► web  (site Next.js)                          │
 │   └──────────────┘  └─────────┘ └─► api  (FastAPI) ◄── bot (Discord)            │
 │                                         │                                        │
 │                              rede "db" SEM internet                              │
 │                                    ┌────┴────┐                                   │
 │                                    │postgres │  (nenhuma porta publicada)        │
 │                                    └─────────┘                                   │
 │  backup diário: pg_dump → cifrado (age) → Azure Blob Storage (privado, 30 dias)  │
 └──────────────────────────────────────────────────────────────────────────────────┘
```

* **Nenhuma porta 80/443 aberta**: o site só é alcançado *através* da Cloudflare (Tunnel). Quem escanear o IP da VM só encontra a porta 22 (e só se for o seu IP).
* **Banco** só conversa com a API, numa rede interna sem internet.
* **Segredos** ficam em `/opt/ninwiki/.env` na VM (permissão 600), nunca no Git.

### O que cada pasta/arquivo faz
| Arquivo | Para quê |
|---|---|
| `cloud-init.yaml` | Configura a VM sozinha na 1ª vez (Docker, firewall, SSH seguro, atualizações) |
| `docker-compose.yml` | Define os 6 serviços (postgres, api, web, bot, caddy, cloudflared) |
| `Caddyfile` | Roteia `codex...` → site e `api...` → API (só dentro da VM) |
| `.env.example` | Modelo das configurações (copie para `.env` **na VM**) |
| `Dockerfile.api/web/bot` | Receitas das imagens (o GitHub Actions usa) |
| `scripts/backup.sh` `restaurar.sh` `atualizar.sh` `verificar_seguranca.sh` `monitorar.sh` | Operação do dia a dia |
| `systemd/` + `scripts/instalar_timers.sh` | Agenda o backup diário e o monitor |
| `MIGRACAO.md` | Como sair da SquareCloud sem perder dados |

### Custo — leia antes de criar
O crédito de ~US$ 100 do Azure for Students **não dura 12 meses** com uma VM de 4 GB ligada 24h:
VM `Standard_B2s` (2 vCPU, 4 GB) ≈ US$ 30–35/mês, + disco ≈ US$ 5 + IP público fixo ≈ US$ 4 → **cerca de US$ 40/mês ≈ 2,5 meses de crédito** (valores aproximados; confira na [calculadora](https://azure.microsoft.com/pricing/calculator/)).
Alternativas: `Standard_B1ms` (2 GB, ≈ US$ 15/mês) dura mais, mas é apertada para os 4 serviços (o kit cria 2 GB de swap para ajudar); `B2ats_v2` (1 GB) **não serve**.
Por isso o passo do **alerta de orçamento** é obrigatório, e quando o crédito acabar o Azure desativa a assinatura (os dados ficam por um tempo; **baixe um backup antes**). Não confirmei qual tamanho a *sua* conta libera — o passo 4 mostra.

---

## 2. Pré-requisitos

1. Conta **Azure for Students** ativa (https://portal.azure.com).
2. **Azure CLI** (`az`) no Windows: `winget install -e --id Microsoft.AzureCLI` (feche e reabra o PowerShell depois). Teste: `az version`.
3. **OpenSSH** (já vem no Windows 10/11): `ssh -V`.
4. **age** (cifra dos backups): `winget install -e --id FiloSottile.age`.
5. Um **domínio na Cloudflare** (plano Free), ex.: `guima.net`. Vamos usar `codex.guima.net` (site) e `api.guima.net` (API). **Os dois no mesmo domínio** é o que faz o login funcionar (cookie `SameSite=lax`).
6. O repositório no GitHub (para o Actions construir as imagens) e o código na sua pasta.

Todos os comandos abaixo são **PowerShell**, a partir da **pasta raiz do projeto** (`C:\Users\User\Desktop\ninwiki`), salvo quando eu disser "na VM".

---

## 3. Passo a passo

### Passo 1 — Entrar no Azure e preparar
```powershell
az login
az account list -o table
az account set --subscription "Azure for Students"   # use o NOME exato que apareceu na lista
# Registra os serviços necessários (se já estiverem registrados, não faz mal):
foreach ($p in "Microsoft.Compute","Microsoft.Network","Microsoft.Storage","Microsoft.Consumption","Microsoft.Authorization") { az provider register --namespace $p }
```

### Passo 2 — Variáveis (edite só esta parte)
Cole no PowerShell (mantenha a **mesma janela** até o fim; se fechar, cole de novo este bloco):
```powershell
$RG      = "rg-ninwiki"
$LOC     = "brazilsouth"            # região. Se o passo 4 mostrar restrição, tente: eastus2, centralus, westus3...
$VM      = "vm-ninwiki"
$VMSIZE  = "Standard_B2s"           # 4 GB. Mais barata: Standard_B1ms (2 GB)
$ADMIN   = "azureuser"              # usuário administrador da VM
$VNET    = "vnet-ninwiki"; $SUBNET = "snet-ninwiki"
$NSG     = "nsg-ninwiki";  $IPNAME = "ip-ninwiki"
$STORAGE = "stninwiki" + (Get-Random -Minimum 10000 -Maximum 99999)   # nome único, só minúsculas/números
$EMAIL   = "seu-email@exemplo.com"  # recebe os alertas de gasto
$MEUIP   = (Invoke-RestMethod https://api.ipify.org).Trim()          # seu IP público atual
"Seu IP: $MEUIP   Storage: $STORAGE"
```
> Anote o valor de `$STORAGE` (vai no `.env` da VM).

### Passo 3 — Chaves SSH (login sem senha)
```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519_ninwiki" -C "ninwiki-admin"
```
Defina uma **frase-senha** quando pedir. Isso cria a chave **privada** (nunca compartilhe) e a **pública** (`.pub`, pode compartilhar).

### Passo 4 — Conferir se a sua conta permite a VM
```powershell
az vm list-skus --location $LOC --size $VMSIZE --resource-type virtualMachines -o table
```
Se a coluna `Restrictions` mostrar `NotAvailableForSubscription`, troque `$LOC` ou `$VMSIZE` e rode de novo até aparecer sem restrição. Se o Azure reclamar de "policy" ao criar recursos, a sua assinatura só aceita certas regiões: use uma que ela liste.

### Passo 5 — Grupo de recursos, rede e firewall (NSG)
```powershell
az group create -n $RG -l $LOC
az network nsg create -g $RG -n $NSG
# Única regra liberada: SSH (22) somente do SEU IP. O Azure já nega o resto por padrão (regra DenyAllInBound).
az network nsg rule create -g $RG --nsg-name $NSG -n permitir-ssh-meu-ip --priority 100 --direction Inbound `
  --access Allow --protocol Tcp --source-address-prefixes $MEUIP --destination-port-ranges 22
az network vnet create -g $RG -n $VNET --address-prefixes 10.20.0.0/16 --subnet-name $SUBNET --subnet-prefixes 10.20.1.0/24 --network-security-group $NSG
az network public-ip create -g $RG -n $IPNAME --sku Standard --allocation-method Static
```
**Trade-off do SSH** (decida agora):
* **A (padrão deste guia)**: porta 22 liberada só para o seu IP. Simples. Se seu IP mudar (internet residencial), atualize a regra (comando no fim do guia).
* **B (mais fechada)**: depois de tudo configurado, **apague/negue** a regra de SSH e só abra quando precisar (comando no fim). Para emergências use o **Serial Console** do portal Azure (Máquina virtual > Suporte > Console serial; exige habilitar "diagnóstico de inicialização"). É o mais seguro, porém mais chato. O deploy automático pelo GitHub **não funciona** com a porta fechada (use o deploy manual).

### Passo 6 — Preparar o cloud-init e criar a VM
```powershell
# Coloca a sua chave pública no arquivo de configuração automática (UTF-8 sem BOM e finais de linha Linux).
$pub = (Get-Content "$env:USERPROFILE\.ssh\id_ed25519_ninwiki.pub" -Raw).Trim()
$txt = ((Get-Content .\Azure\cloud-init.yaml -Raw) -replace "`r`n","`n").Replace("__SSH_PUBLIC_KEY__", $pub)
$ci  = "$env:TEMP\cloud-init-pronto.yaml"
[System.IO.File]::WriteAllText($ci, $txt, (New-Object System.Text.UTF8Encoding($false)))

az vm create -g $RG -n $VM --image Ubuntu2404 --size $VMSIZE `
  --admin-username $ADMIN --authentication-type ssh --ssh-key-values "$env:USERPROFILE\.ssh\id_ed25519_ninwiki.pub" `
  --vnet-name $VNET --subnet $SUBNET --nsg $NSG --public-ip-address $IPNAME `
  --os-disk-size-gb 64 --storage-sku StandardSSD_LRS --assign-identity "[system]" `
  --custom-data $ci
```
Guarde o **IP público** que o comando mostrar (ou: `az network public-ip show -g $RG -n $IPNAME --query ipAddress -o tsv`) em `$VMIP`:
```powershell
$VMIP = az network public-ip show -g $RG -n $IPNAME --query ipAddress -o tsv
```
> `--assign-identity "[system]"` dá à VM uma "identidade" do Azure: é com ela que o backup entra no storage **sem nenhuma senha guardada na VM**.

Espere ~3 minutos (o cloud-init instala tudo) e confira:
```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_ninwiki" ninwiki@$VMIP "cloud-init status --wait; ls /var/lib/cloud/instance/ninwiki-pronto"
```
Se perguntar "continue connecting?", digite `yes` (é a 1ª vez). Deve terminar com `status: done` e mostrar o arquivo `ninwiki-pronto`. (Se der erro de permissão da chave no Windows: `icacls "$env:USERPROFILE\.ssh\id_ed25519_ninwiki" /inheritance:r /grant:r "$($env:USERNAME):(R)"`.)

### Passo 7 — Storage privado dos backups (+ apagar com 30 dias)
```powershell
az storage account create -g $RG -n $STORAGE -l $LOC --sku Standard_LRS --kind StorageV2 `
  --allow-blob-public-access false --min-tls-version TLS1_2 --https-only true --allow-shared-key-access false
az storage container-rm create --storage-account $STORAGE -g $RG -n backups
# Lixeira de 7 dias para blobs apagados por engano:
az storage account blob-service-properties update -g $RG --account-name $STORAGE --enable-delete-retention true --delete-retention-days 7

# Ciclo de vida: o PRÓPRIO Azure apaga backups com mais de 30 dias.
$pol = '{"rules":[{"enabled":true,"name":"apaga-backups-30-dias","type":"Lifecycle","definition":{"actions":{"baseBlob":{"delete":{"daysAfterModificationGreaterThan":30}}},"filters":{"blobTypes":["blockBlob"],"prefixMatch":["backups/"]}}}]}'
[System.IO.File]::WriteAllText("$env:TEMP\ciclo.json", $pol, (New-Object System.Text.UTF8Encoding($false)))
az storage account management-policy create -g $RG --account-name $STORAGE --policy "@$env:TEMP\ciclo.json"

# A VM (identidade gerenciada) pode ENVIAR/LER somente neste container:
$PRINC = az vm show -g $RG -n $VM --query identity.principalId -o tsv
$SCOPE = az storage account show -g $RG -n $STORAGE --query id -o tsv
az role assignment create --assignee-object-id $PRINC --assignee-principal-type ServicePrincipal `
  --role "Storage Blob Data Contributor" --scope "$SCOPE/blobServices/default/containers/backups"
```
Resultado: conta **sem acesso público**, sem chave de acesso (`allow-shared-key-access false`), só a VM escreve, e backups somem em 30 dias.
(Opcional, mais seguro: restringir o storage ao IP da VM — `az storage account update -g $RG -n $STORAGE --default-action Deny` e `az storage account network-rule add -g $RG --account-name $STORAGE --ip-address $VMIP`.)

### Passo 8 — Alerta de orçamento (por e-mail)
```powershell
$SUB   = az account show --query id -o tsv
$ini   = (Get-Date -Day 1).AddMonths(1).ToString("yyyy-MM-dd")      # o orçamento começa no dia 1º do próximo mês
$fim   = (Get-Date -Day 1).AddYears(1).ToString("yyyy-MM-dd")
function N($t,$tipo){ @{enabled=$true;operator="GreaterThan";threshold=$t;thresholdType=$tipo;contactEmails=@($EMAIL)} }
$body = @{ properties = @{ category="Cost"; amount=30; timeGrain="Monthly"
  timePeriod=@{ startDate="${ini}T00:00:00Z"; endDate="${fim}T00:00:00Z" }
  notifications=@{ real50=(N 50 "Actual"); real80=(N 80 "Actual"); real100=(N 100 "Actual"); prev100=(N 100 "Forecasted") } } } | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText("$env:TEMP\orcamento.json", $body, (New-Object System.Text.UTF8Encoding($false)))
az rest --method put --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Consumption/budgets/orcamento-ninwiki?api-version=2023-05-01" --body "@$env:TEMP\orcamento.json"
```
Isso **avisa** (50%, 80%, 100% e previsão) mas **não desliga nada**. Se este comando der erro (contas Students às vezes bloqueiam), faça pelo portal: *Cost Management + Billing > Budgets > Add*. Além disso, acompanhe o crédito restante em https://www.microsoftazuresponsorships.com/ (Students).

### Passo 9 — Chave de cifra dos backups (age) — **no seu PC**
```powershell
age-keygen -o "$env:USERPROFILE\Documents\chave-backup-ninwiki.txt"
```
Ele imprime `Public key: age1....` — **copie essa linha** (é a chave pública, vai no `.env`).
O arquivo `chave-backup-ninwiki.txt` é a chave **privada**: guarde-o em um **gerenciador de senhas / pendrive**, **fora da VM**. Sem ele, os backups cifrados **não abrem**. A VM só recebe a pública.

### Passo 10 — Cloudflare Tunnel
1. https://one.dash.cloudflare.com → **Zero Trust** (plano Free; pode pedir um cartão de verificação, sem cobrança — não confirmei).
2. **Networks > Tunnels > Create a tunnel > Cloudflared** → nome `ninwiki-azure`.
3. Na tela "Install and run" escolha **Docker** e **copie só o token** (o texto longo depois de `--token`). **É um segredo.**
4. Aba **Public Hostname**, adicione 2:
   * `codex.guima.net` → Service **HTTP** → `caddy:80`
   * `api.guima.net` → Service **HTTP** → `caddy:80`
   (A Cloudflare cria os registros DNS sozinha. Se já existirem registros antigos com esses nomes, ela pede para removê-los — **só faça isso na hora da migração**, veja `MIGRACAO.md`. Para testar antes, use nomes novos, ex. `teste.guima.net` / `apiteste.guima.net`.)

### Passo 11 — Instalar o kit na VM
```powershell
$K = "$env:USERPROFILE\.ssh\id_ed25519_ninwiki"
scp -i $K -r .\Azure ninwiki@${VMIP}:~/Azure
ssh -i $K ninwiki@$VMIP "cp -r ~/Azure/. /opt/ninwiki/ && rm -rf ~/Azure && cd /opt/ninwiki && sed -i 's/\r$//' Caddyfile docker-compose.yml .env.example cloud-init.yaml scripts/*.sh systemd/* && chmod +x scripts/*.sh && cp -n .env.example .env && chmod 600 .env && ls -la"
```
Agora **na VM** (entre com `ssh -i $K ninwiki@$VMIP`) edite o `.env`:
```bash
cd /opt/ninwiki
nano .env          # preencha TUDO que está entre < >; para gerar segredos: openssl rand -hex 32
```
Preencha: domínios, `GHCR_OWNER` (seu usuário do GitHub em minúsculas), `POSTGRES_PASSWORD`, `CLOUDFLARE_TUNNEL_TOKEN`, `JWT_SECRET_KEY`, `BOT_API_TOKEN`, `BACKUP_PASSPHRASE`, Discord, `STORAGE_ACCOUNT` (o `$STORAGE` do passo 2) e `AGE_RECIPIENT` (a `age1...` do passo 9). Salvar no nano: `Ctrl+O`, Enter, `Ctrl+X`.
Aproveite e **atualize o Discord**: em https://discord.com/developers/applications adicione o *Redirect* `https://api.guima.net/auth/discord/callback`.

### Passo 12 — Construir as imagens (GitHub)
No GitHub: **Settings > Secrets and variables > Actions > aba Variables**, crie:
`NEXT_PUBLIC_API_URL` = `https://api.guima.net`, `NEXT_PUBLIC_SITE_URL` = `https://codex.guima.net`, `NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID` = (id do bot).
Depois **Actions > "Deploy no Azure (manual)" > Run workflow** (deixe *deploy* desmarcado). Espere ficar verde: as 3 imagens vão para `ghcr.io/<seu-usuario>/ninwiki-api|web|bot`.

### Passo 13 — Subir tudo
Para a VM baixar as imagens privadas do GitHub, crie um token: GitHub > Settings > Developer settings > **Personal access tokens (classic)** > só a permissão `read:packages`, validade curta. Na VM:
```bash
echo "<COLE_O_TOKEN>" | docker login ghcr.io -u <seu-usuario-github> --password-stdin   # use o token SOMENTE aqui
cd /opt/ninwiki && ./scripts/atualizar.sh
docker compose ps                         # todos "Up"/"healthy"
```
Agora instale os timers (backup diário + monitor) e teste um backup:
```bash
exit    # volte ao PowerShell e rode:  ssh -i $K azureuser@$VMIP   (o usuário admin tem sudo)
sudo /opt/ninwiki/scripts/instalar_timers.sh
sudo -u ninwiki /opt/ninwiki/scripts/backup.sh          # deve terminar com "[backup] ok."
sudo /opt/ninwiki/scripts/verificar_seguranca.sh        # deve terminar com "tudo certo"
```
> A Cloudflare só mostra o site depois que o `cloudflared` conectar: `docker compose logs --tail 20 cloudflared` deve dizer "Registered tunnel connection".

### Passo 14 — Verificar (do seu PC)
```powershell
curl.exe -sI https://api.guima.net/health | Select-String "HTTP|strict-transport"
curl.exe -s  https://api.guima.net/health
curl.exe -sI https://codex.guima.net | Select-String "HTTP|content-security"
curl.exe -s -o NUL -w "%{http_code}`n" https://api.guima.net/docs     # esperado: 404 (docs desligados em produção)
Test-NetConnection $VMIP -Port 80     # esperado: TcpTestSucceeded False
Test-NetConnection $VMIP -Port 443    # esperado: False
```
Depois entre no painel (`/login`) e confira login, upload de imagem e o bot respondendo.

---

## 4. Dia a dia

**Entrar na VM**: `ssh -i $K ninwiki@$VMIP` (dia a dia, sem sudo) ou `azureuser@$VMIP` (manutenção, com sudo).
Seu IP mudou e não consegue entrar?
```powershell
$MEUIP = (Invoke-RestMethod https://api.ipify.org).Trim()
az network nsg rule update -g $RG --nsg-name $NSG -n permitir-ssh-meu-ip --source-address-prefixes $MEUIP
```
**Fechar o SSH de vez (opção B)** / reabrir:
```powershell
az network nsg rule update -g $RG --nsg-name $NSG -n permitir-ssh-meu-ip --access Deny
az network nsg rule update -g $RG --nsg-name $NSG -n permitir-ssh-meu-ip --access Allow --source-address-prefixes $MEUIP
```

**Atualizar (deploy)**
* *Manual (recomendado com SSH restrito)*: rode o workflow só de build (deploy desmarcado) e depois, na VM: `cd /opt/ninwiki && ./scripts/atualizar.sh` (ou `./scripts/atualizar.sh web`). A ordem é API → site → bot e ele espera cada um ficar saudável; se não ficar, para e mostra o log.
* *Pelo GitHub*: crie uma chave SSH só para isso (`ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_deploy -N '""'`), adicione a `.pub` ao `~/.ssh/authorized_keys` do usuário `ninwiki`, cadastre os Secrets `AZURE_VM_HOST`, `AZURE_VM_USER` (=`ninwiki`), `AZURE_SSH_KEY` (a privada), `AZURE_SSH_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 $VMIP`) e rode o workflow com *deploy* marcado. Problema: o NSG só aceita o seu IP, então o GitHub não chega. Ou você libera a 22 para a internet (com chave + fail2ban é aceitável, mas aumenta a exposição) ou deploy manual. **Eu recomendo o manual.**

**Ver logs**: `docker compose logs -f --tail 100 api` (ou `web`, `bot`, `caddy`, `cloudflared`, `postgres`). Estado: `docker compose ps`.

**Reiniciar um serviço**: `docker compose restart api`.

**Backups**: automático todo dia 03:30 UTC. Listar: `./scripts/restaurar.sh listar`. Manual: `./scripts/backup.sh`.

**Restaurar um backup** (apaga o banco atual!). A chave privada **não** fica na VM, então decifre no PC:
```powershell
# 1) baixe o blob (precisa do papel "Storage Blob Data Reader" para o seu usuário: az role assignment create ... ) ou use o portal Azure
az storage blob download --auth-mode login --account-name $STORAGE -c backups -n db/ninwiki-AAAAMMDD-HHMMSS.dump.age -f .\db.dump.age
# 2) decifre no PC
age -d -i "$env:USERPROFILE\Documents\chave-backup-ninwiki.txt" -o .\db.dump .\db.dump.age
# 3) envie à VM e restaure
scp -i $K .\db.dump ninwiki@${VMIP}:/tmp/db.dump
ssh -i $K -t ninwiki@$VMIP "cd /opt/ninwiki && ./scripts/restaurar.sh db /tmp/db.dump && shred -u /tmp/db.dump"
```
(`restaurar.sh files <arquivo.tar>` faz o mesmo para imagens/anexos.) Existe ainda o backup cifrado do bot no Discord — duas cópias independentes.

**Desfazer / rollback de versão**: cada imagem tem a tag do commit. Na VM: `nano .env` → `IMAGE_TAG=<sha-antigo>` → `./scripts/atualizar.sh`. (Se a versão nova mudou o banco por migração, volte também o banco do backup.)

**Desligar para não gastar** (a VM parada não cobra computação; disco e IP ainda cobram pouco):
```powershell
az vm deallocate -g $RG -n $VM        # desliga (o site cai)
az vm start      -g $RG -n $VM        # liga de novo (o IP fixo se mantém)
```
**Apagar TUDO** (irreversível; faça backup antes): `az group delete -n $RG --yes --no-wait`.

---

## 5. Checklist de segurança (marque conforme fizer)

- [ ] NSG só libera **22 do meu IP** (`az network nsg rule list -g $RG --nsg-name $NSG -o table`)
- [ ] `Test-NetConnection $VMIP -Port 80/443` → **False**
- [ ] SSH **só com chave** (senha desligada) e `PermitRootLogin no` — `verificar_seguranca.sh` confirma
- [ ] Chave SSH com **frase-senha**; chave privada só no meu PC
- [ ] `ufw` ativo (entrada negada) e `fail2ban` ativo
- [ ] `unattended-upgrades` ligado (atualizações de segurança automáticas)
- [ ] `.env` com **chmod 600**, dono `ninwiki`, **fora do Git** (nunca copiado para o repositório)
- [ ] Segredos **novos** (não reutilizei os da SquareCloud): JWT, BOT_API_TOKEN, BACKUP_PASSPHRASE, senha do Postgres, token do bot se vazou
- [ ] Postgres **sem porta publicada** (rede `db` interna)
- [ ] `ENVIRONMENT=production` → `/docs` e `/openapi.json` dão 404
- [ ] Cookie `Secure` + `SameSite=lax`; site e API no **mesmo domínio**
- [ ] Storage **sem acesso público** e sem chave de acesso; ciclo de vida de 30 dias criado
- [ ] Backup manual rodou com "ok" e eu **testei restaurar** (num ambiente de teste) pelo menos uma vez
- [ ] Chave privada do **age** guardada fora da VM (gerenciador de senhas)
- [ ] **Orçamento** criado e e-mail confirmado; webhook de alertas do Discord (opcional) configurado
- [ ] Uptime externo (grátis): UptimeRobot/Better Stack/Cloudflare Health Checks apontando para `https://codex.../` e `https://api.../health/ready`
- [ ] Cloudflare: *Always Use HTTPS*, *Bot Fight Mode*, regra de limite de requisições em `/auth/*` (opcional: **Cloudflare Access** na frente de `/admin`)
- [ ] Discord do dono com **2FA** (a API exige `REQUIRE_DISCORD_2FA=true`)
- [ ] Rodei `verificar_seguranca.sh` e deu "tudo certo"
- [ ] SquareCloud só desligada **depois** de tudo testado (veja `MIGRACAO.md`)

### Riscos que continuam (seja honesto consigo)
* **Grupo `docker` = root**: quem entra como `ninwiki` consegue virar root na VM. Mitigação: só chave SSH, frase-senha, fail2ban, sem sudo/senha. (Docker *rootless* seria mais seguro, mas é bem mais difícil de manter; não usei.)
* **Uma única VM**: se ela cair, o site cai (sem alta disponibilidade). Os backups cobrem perda de dados, não indisponibilidade.
* **Imagens com tag `latest`** para `caddy`, `cloudflared`: atualizam quando você der `pull`; fixe versões depois se quiser previsibilidade.
* **Quem tiver o token do Tunnel** se passa pelo seu site: guarde como senha; troque-o na Cloudflare se vazar.
* **Malware dentro da VM** poderia apagar blobs de backup com a identidade da VM; a lixeira de 7 dias e a cópia no Discord ajudam.
* O site (Next) confia em `CF-Connecting-IP` para o limite por IP dele; como nada alcança a VM fora do túnel, é seguro aqui.
* `/health` da API mostra `environment` e os 7 primeiros caracteres do commit (o painel do S.Adm usa). Baixo risco; não mudei.

---

## 6. Perguntas

**Por que não abrir as portas 80/443?** Tudo que está aberto na internet é testado por robôs em minutos. Com o Tunnel a VM **liga para fora** para a Cloudflare; ninguém consegue "bater na porta" do seu servidor, e a Cloudflare filtra ataques antes de chegarem. Também resolve o risco de alguém falar direto com a API e forjar o IP (por isso adicionei `TRUSTED_PROXY_CIDRS`).

**O que é o Cloudflare Tunnel?** Um programinha (`cloudflared`) rodando na VM que mantém uma conexão de saída com a Cloudflare. Quando alguém acessa `codex.guima.net`, a Cloudflare entrega o pedido por esse "cano" ao Caddy, que passa ao site ou à API.

**Para que o Caddy se já tem o Tunnel?** Para escolher entre site e API pelo endereço e centralizar logs/cabeçalhos num só lugar. É HTTP puro dentro da VM; o HTTPS é da Cloudflare.

**Por que o backup é cifrado com `age` e chave pública?** Assim a VM só consegue *cifrar*. Se invadirem a VM, não leem backups antigos. A chave de abrir fica com você.

**A SquareCloud usa 3 certificados (CA + cliente + chave) no banco. Vale usar também?**
Resposta curta: **não neste desenho.** Explicando:
* Na SquareCloud o banco é um serviço **acessível pela internet**; os 3 arquivos são TLS com *certificado de cliente* (mTLS): só quem tem o seu certificado consegue sequer conectar. É a "fechadura" de uma porta que **precisa** ficar aberta.
* Aqui o Postgres **não tem porta publicada** e vive numa rede Docker **sem internet** que só a API enxerga. Não há porta a trancar; um certificado só protegeria contra alguém que já está dentro da VM (e esse alguém já leria o próprio certificado). Custo: complexidade e risco de o certificado expirar e derrubar o site. Benefício: quase nada. O que protege de verdade aqui: rede isolada, senha forte, firewall, backups.
* **Azure Database for PostgreSQL (Flexible Server)**, segundo a documentação atual da Microsoft: exige TLS (1.2 ou 1.3; dá para exigir só 1.3 com `ssl_min_protocol_version`), aceita acesso privado (VNet/Private Endpoint) e login por senha ou Entra ID — e **não suporta certificado de cliente (mTLS)**; a recomendação é `sslmode=verify-full`/`verify-ca` com as CAs raiz *DigiCert Global Root G2* e *Microsoft RSA Root CA 2017*. Ou seja, **mesmo lá você não teria os 3 certificados**. Além disso o tamanho Burstable (B1ms ≈ 2 GB) custaria algumas dezenas de dólares por mês do seu crédito e a própria Microsoft diz que Burstable não é para produção. Não vale para o seu crédito.
* **Se um dia o banco sair da VM** (Flexible Server ou outra máquina), configure só a CA, sem certificado de cliente: `DATABASE_SSL_CA` com o texto das duas CAs acima (uma depois da outra), `DATABASE_SSL_VERIFY_HOSTNAME=true`, **sem** `DATABASE_SSL_CERT/KEY`, e `?ssl` fora da URL (a API já suporta isso). Para mTLS entre containers na mesma VM (não recomendo) seria preciso criar uma CA própria, emitir certificados de servidor e cliente, montá-los como volumes e ligar `ssl=on` + `pg_hba.conf` com `hostssl ... cert` no Postgres — muito trabalho para pouco ganho.

**Posso usar o SameSite=lax mesmo?** Sim, porque `codex.guima.net` e `api.guima.net` são o *mesmo site* (domínio registrável `guima.net`). Nunca use `none`.
