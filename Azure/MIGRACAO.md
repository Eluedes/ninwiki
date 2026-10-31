# Migração SquareCloud → Azure (sem perder dados)

> **PLANO B — NÃO é a hospedagem atual.** Em 31/10/2026 o dono decidiu **continuar na SquareCloud** (README, seção 3 e 3.13). Este kit do Azure fica pronto e versionado para o caso de precisar mudar um dia; não execute nada daqui agora.

Pré-requisito: o `LEIA-ME.md` está feito **até o Passo 13** (VM no ar, backup de teste "ok"), usando **domínios de teste** (ex.: `teste.guima.net` / `apiteste.guima.net`) — a SquareCloud continua servindo o endereço de verdade.

> Regras: não apague nada da SquareCloud antes do fim. Use os **bancos de produção só para ler** (backup). Nunca aponte testes para o banco da SquareCloud.
> Quem fala "o banco mesclado" é o dump que outro agente/processo gera em `NinWiki.Api\envio\` (confira o nome do arquivo em `envio\RUNBOOK_BANCO.md`).

## Visão da ordem

1. Backups novos (SquareCloud) — **ponto de retorno**
2. Ensaio no Azure com os domínios de teste (nada de produção ainda)
3. Janela de manutenção: congelar a escrita na SquareCloud
4. Backup final + restaurar o banco mesclado no Azure
5. Enviar as imagens (`uploads`)
6. Trocar DNS/Tunnel, ajustar Discord e bot
7. Testar tudo
8. Observar 3–7 dias; só então desligar a SquareCloud
9. Rollback (a qualquer momento antes do passo 8)

---

## 1. Backups novos (antes de qualquer coisa)
* No painel (S.Adm) gere um backup, ou espere o do bot no Discord (canal de backup). Baixe e guarde **2 cópias** (PC + outro lugar). Anote a `BACKUP_PASSPHRASE` usada (para abrir).
* Guarde também as **Variáveis de Ambiente** da SquareCloud de cada app (num gerenciador de senhas — **não** em arquivo no repositório). Servem de referência para o `.env` do Azure, mas **gere segredos novos** (JWT, BOT_API_TOKEN, BACKUP_PASSPHRASE novos). Trocar `JWT_SECRET_KEY` desloga todo mundo — é esperado.
* Se tiver dúvidas de que o dump local está atualizado: o dump "mesclado" já inclui os dados vivos de produção (`scripts\mesclar_producao.py`, feito por outro agente). Confirme com ele a data do dump e o nome do arquivo.

## 2. Ensaio com domínios de teste
1. Na Cloudflare (Tunnel `ninwiki-azure`) crie os hostnames de **teste** → `caddy:80`.
2. No `.env` da VM use os domínios de teste em `SITE_HOST`, `API_HOST`, `FRONTEND_ORIGIN`, `API_BASE_URL`, `SITE_URL`. As variáveis do GitHub `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SITE_URL` também precisam apontar para o teste **e o site precisa ser reconstruído** (Actions) — elas são gravadas no build.
3. Adicione o *redirect* de teste no app do Discord (`https://apiteste.guima.net/auth/discord/callback`). Para o ensaio use um **bot de teste** ou deixe `DISCORD_BOT_TOKEN` vazio/`BACKUP_CHANNEL_ID` vazio, senão dois bots com o mesmo token brigam e o bot de produção da SquareCloud cai.
4. Suba (`./scripts/atualizar.sh`), restaure o dump mesclado (passo 4 abaixo) e navegue: se está tudo certo, repita o procedimento "valendo" na janela de manutenção.

## 3. Janela de manutenção (SquareCloud)
Avise a equipe. Para congelar escritas: use o **modo manutenção** do site (painel S.Adm > Manutenção, ou o Worker de manutenção em `Cloudflare/`) — assim ninguém edita enquanto copiamos. Tempo estimado: 30–60 min.

## 4. Backup final e restauração do banco no Azure
1. Gere o backup final na SquareCloud (painel) — **ponto de retorno** definitivo.
2. Decida a fonte do banco do Azure:
   * **Normal**: o dump mesclado `NinWiki.Api\envio\<arquivo>.dump` (já contém produção + conteúdo novo).
   * Se algo foi editado na produção **depois** do dump mesclado, rode de novo o `mesclar_producao.py` (outro agente) com o backup final antes de seguir.
3. Envie à VM e restaure (do PowerShell, na raiz do projeto; `$K` e `$VMIP` do LEIA-ME):
   ```powershell
   scp -i $K .\NinWiki.Api\envio\NOME-DO-DUMP-MESCLADO.dump ninwiki@${VMIP}:/tmp/mesclado.dump
   ssh -i $K -t ninwiki@$VMIP "cd /opt/ninwiki && ./scripts/restaurar.sh db /tmp/mesclado.dump && shred -u /tmp/mesclado.dump"
   ```
   O script pede para digitar `RESTAURAR`, para a API/site/bot, recria o banco e sobe tudo (a API roda `alembic upgrade head`, aplicando migrações que faltarem).
   * Dump em formato `pg_dump -Fc` (custom). Se for `.sql` simples, avise — o comando muda para `psql`.
   * Os dumps `antes_*.dump` da pasta `envio` são pontos de retorno antigos: **não** restaure por engano.
4. Confira: `docker compose logs --tail 30 api` (sem erros) e `docker compose exec postgres psql -U ninwiki -d ninwiki -c "select count(*) from users;"` (ajuste o nome de uma tabela que você conhece).

## 5. Enviar as imagens (`NinWiki.Api\uploads`, ~10 mil arquivos, ~82 MB)
As imagens ficam num volume do Docker. Pelo PowerShell:
```powershell
Compress-Archive -Path .\NinWiki.Api\uploads\* -DestinationPath $env:TEMP\uploads.zip -Force
scp -i $K $env:TEMP\uploads.zip ninwiki@${VMIP}:/tmp/uploads.zip
```
Na VM (como `azureuser`, que tem sudo — o volume pertence ao uid 10001):
```bash
sudo apt-get install -y unzip >/dev/null
sudo mkdir -p /tmp/up && sudo unzip -oq /tmp/uploads.zip -d /tmp/up
sudo docker run --rm -u 0 --network none --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER \
  -v ninwiki_api_uploads:/dest -v /tmp/up:/src:ro postgres:17-alpine sh -c 'cp -a /src/. /dest/ && chown -R 10001:10001 /dest'
sudo rm -rf /tmp/up /tmp/uploads.zip
```
Confira: `docker compose exec api sh -c "ls /app/uploads | wc -l"` (≈ o mesmo número) e abra uma imagem pelo site.
Alternativa: o **backup do painel/bot** (banco + imagens, cifrado) também restaura as imagens — mas o passo acima é direto e não exige a passphrase. Conteúdo novo de imagens: `envio\imagens.zip` (mesmo procedimento).
> Se o banco veio da produção, as imagens da produção também precisam vir (o backup do painel as contém). Confirme com o outro agente se `uploads` local já é a união.

## 6. Trocar o endereço (DNS / Tunnel)
1. Na Cloudflare: o endereço de verdade (`nincodex.guima.net`, `api.guima.net` ou o que usar) aponta hoje para a SquareCloud (CNAME/Worker). **Altere** para o Tunnel: nos hostnames públicos do Tunnel adicione os nomes reais → `caddy:80` (a Cloudflare pede para substituir o registro DNS antigo — confirme). O Worker de manutenção (`Cloudflare/`) deve continuar na frente, se você o usa.
2. `.env` da VM: volte `SITE_HOST`, `API_HOST`, `FRONTEND_ORIGIN`, `API_BASE_URL`, `SITE_URL` para os reais; `./scripts/atualizar.sh` (e reconstrua o site no GitHub com as *Variables* reais).
3. Discord (developers): *Redirect* real `https://api.guima.net/auth/discord/callback`.
4. **Bot**: pare o bot da SquareCloud (painel > app do bot > Parar) **antes** de ligar o do Azure (mesmo token não pode rodar em dois lugares). Ligue: `docker compose up -d bot`. O estado antigo (`*_state.json`) não é copiado: o bot cria mensagens novas de status/versão; se quiser evitar duplicatas, apague as antigas no Discord.
5. Se o banco novo começou do dump, **troque a `BACKUP_PASSPHRASE`** só se não precisar abrir backups antigos do Discord; senão mantenha a antiga (os backups antigos dependem dela).

## 7. Testar (marque)
- [ ] `https://nincodex.guima.net` abre, imagens aparecem, idioma EN/PT ok
- [ ] Login com Discord funciona e **fica logado** (cookie `lax`; se não, veja `FRONTEND_ORIGIN`/domínios)
- [ ] Painel: editar e salvar algo, subir uma imagem, ver o log de ações
- [ ] Bot: `/search`, `/help` respondem; canal de status mostra "no ar"
- [ ] Gráfico de acessos mostra IPs/países diferentes (prova de que o IP real chega: `TRUSTED_PROXY_CIDRS` ok). Todos iguais = confira os logs da API (aviso de `TRUSTED_PROXY_CIDRS`)
- [ ] `scripts/backup.sh` ok e `verificar_seguranca.sh` ok
- [ ] `/docs` da API → 404; portas 80/443 do IP da VM fechadas

## 8. Desligar a SquareCloud (só no fim)
* Observe **3 a 7 dias**. Deixe o app da SquareCloud **parado** (não apagado) por mais ~2 semanas.
* Só então apague os apps/bancos da SquareCloud (e revogue as chaves `SQUARE_API_KEY` no GitHub). Os workflows `deploy-api/web/bot.yml` podem ficar (inofensivos) ou ser removidos depois, num commit separado.
* Depois da migração: troque (rotacione) qualquer segredo que tenha circulado.

## 9. Rollback (se algo der errado antes do passo 8)
1. Na Cloudflare, aponte o endereço de volta para a SquareCloud (reverta o hostname/DNS) — o site antigo ainda tem os dados do ponto de retorno.
2. Pare o bot do Azure (`docker compose stop bot`) e religue o da SquareCloud.
3. Desligue o modo manutenção.
4. Se houve escrita no Azure que você queira manter, gere um backup lá (`./scripts/backup.sh`) **antes** de desistir — dá para recuperar depois.
5. Corrija e repita o ensaio (passo 2).
