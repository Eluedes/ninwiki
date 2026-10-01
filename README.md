# NinWiki

Wiki com painel administrativo. Três projetos independentes na mesma pasta:

| Pasta | O que é | Tecnologia | Porta local |
|---|---|---|---|
| `NinWiki.Api` | API + banco (conteúdo, login, equipe, avisos, uploads) | Python, FastAPI, PostgreSQL | 8000 |
| `NinWiki.Web` | Site público + painel `/admin` | Next.js 16, React 18 | 3000 |
| `NinWiki.Bot` | Bot de Discord (`/team ...` + log no canal) | Python, discord.py | — |

Outros documentos: `NinWiki.Web/GUIA_DE_EDICAO.md` (editar o frontend), `NinWiki.Web/MAESTRIAS.md`,
`NinWiki.Bot/README.md`, `ROADMAP.md` (o que já foi feito / falta), `FASE2_LOCAL.md` (login e cargos).

> **Scripts `.bat`/`.cmd` não vão para o repositório** (estão no `.gitignore` e o CI recusa). Se quiser um atalho
> no Windows, crie o seu localmente — ele fica só na sua máquina.

---

## 1. Rodar no seu computador

Pré-requisitos: **Python 3.12+**, **Node 20+**, **Docker Desktop** (só para o Postgres).

Use **3 terminais** (API, site e, se quiser, o bot). Comandos abaixo em PowerShell/bash; onde muda, está indicado.

### 1.1 Banco + API
```bash
cd NinWiki.Api
copy .env.example .env          # Linux/Mac: cp .env.example .env   -> depois EDITE o .env (veja abaixo)
docker compose up -d            # sobe o Postgres (porta 5433) + Adminer (http://localhost:8080)
python -m venv venv
venv\Scripts\activate           # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head            # cria as tabelas
python -m uvicorn app.main:app --reload
```
O que editar no `.env` para uso local:
- `POSTGRES_PASSWORD` e a senha dentro de `DATABASE_URL` (a mesma nos dois lugares);
- `JWT_SECRET_KEY` (qualquer texto longo; em produção precisa ter 32+ caracteres aleatórios);
- `SUPER_ADMIN_DISCORD_IDS` = o **seu** Discord ID (Discord → Configurações → Avançado → Modo Desenvolvedor →
  botão direito no seu nome → *Copiar ID do usuário*);
- para entrar **sem** criar app no Discord: `DEV_LOGIN_ENABLED=true` (só funciona com `ENVIRONMENT=development`).

Teste: <http://localhost:8000/health>; documentação interativa em <http://localhost:8000/docs> (só em desenvolvimento).

**Conteúdo inicial (opcional, UMA vez):** `python -m app.seed` (usa o `seed_data.json`). ⚠️ **Apaga** o catálogo antes de
recarregar — nunca rode num banco que já tem conteúdo real.

### 1.2 Site
```bash
cd NinWiki.Web
copy .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                          # http://localhost:3000
```
Painel: <http://localhost:3000/admin> (login em `/login`).

### 1.3 Bot (opcional)
Veja `NinWiki.Bot/README.md`. Resumo: `copy .env.example .env`, preencher, `pip install -r requirements.txt` num
**venv separado** do da API, `python main.py`. Para o **log no Discord**, preencha `LOG_CHANNEL_ID` (ver seção 2.2).

### 1.4 Verificações (rode depois de qualquer mudança grande)
```bash
cd NinWiki.Api
python scripts/verificar_projeto.py        # código x migrations x banco x frontend (tsc + lint)
python scripts/testar_permissoes.py        # 436 verificações de segurança/permissões/traduções/erros/blog (precisa do banco no ar)
python scripts/testar_bot_integracao.py    # 91 verificações do bot + log + erros (precisa do banco no ar)
cd ../NinWiki.Web && npm run typecheck && npm run lint && npm run build
pip-audit -r requirements.txt && npm audit # vulnerabilidades conhecidas nas bibliotecas (pip install pip-audit)
```
> Se o Python reclamar de `No module named app` ao rodar um script, rode com `PYTHONPATH=.`
> (Linux/Mac) ou `$env:PYTHONPATH="."` (PowerShell).

---

## 2. Como usar

### 2.1 Painel (`/admin`)
- **Cargos:** `S.Adm` (dono, tudo) > `Adm` > `Creator`. Quem está em `SUPER_ADMIN_DISCORD_IDS` vira S.Adm no primeiro login e
  não pode ser rebaixado. **Equipe** e **Permissões** são **só do S.Adm**.
- **Entrar:** `/login` → "Entrar com Discord". Só entra quem foi cadastrado na equipe (ter Discord não basta).
- **Conteúdo / Blog / Jutsus / Masteries:** rascunho ou publicado, imagem (upload), histórico, tradução automática EN→PT
  (com `DEEPL_API_KEY`). O blog público fica em `/blog` e os 3 últimos posts aparecem na Home.
- **Blog (editor):** tags/categorias (multi-seleção, cria tag nova na hora), imagem no texto (upload), citação, bloco de código,
  vídeo do **YouTube/Twitch**, **@menção** (busca itens e masteries e vira link), **spoiler** (abre/fecha), contador de
  palavras/caracteres, **Pré-visualizar**, SEO (título/descrição para o Google) e **data de publicação**: no futuro =
  **agendado** (só aparece para os leitores quando chegar a hora). Aviso ao sair com alterações não salvas.
- **Comentários e curtidas:** leitores entram com o Discord (sessão **separada** da equipe — não dá acesso ao painel) e
  comentam/curtem posts. `/admin/comments` (permissão `comments.moderate`: Adm por padrão) esconde, apaga e **bane**
  leitores; tudo vai pro log. Texto simples, 1000 caracteres, no máximo 2 links, 5 comentários/min por leitor.
- **Vilas, Clãs e Organizações:** `/admin/villages` (cada clã tem nome, descrição e **imagem** com a logo e a roupa) e
  `/admin/organizations` (liga cada organização às vilas em que atua).
- **Quadro de avisos** (Visão Geral): toda a equipe lê e baixa os arquivos; **S.Adm e Adm** postam, fixam, editam, apagam e
  anexam arquivos (até 10 por aviso, `MAX_NOTICE_FILE_MB` MB cada; executáveis e HTML são recusados).
- **Permissões** (`/admin/permissions`, só S.Adm): liga/desliga o que **Adm** e **Creator** podem fazer; vale na hora.
- **Log geral:** `/admin/audit-log` (quem fez o quê; o IP só o S.Adm vê).
- **Erros e problemas** (`/admin/errors`, só S.Adm): tudo que quebrou no wiki — erros da API, erros de tela do site, falhas da DeepL e
  alertas de flood — agrupados (um problema = uma linha com o contador), com local no código e traceback mascarado. Resolva
  com um clique; se voltar a acontecer, reabre sozinho. O card "Open" da Visão Geral mostra quantos estão abertos.

### 2.2 Log, erros e alertas no Discord (bot)
O bot cuida de **dois canais** (podem ser o mesmo). Os comandos e as mensagens do bot são em **inglês** (comandos: `/team list|add|role|deactivate|reactivate`).

**Log geral** (`LOG_CHANNEL_ID`): o que acontece no painel (criou/editou/apagou, logins, mudanças de equipe e de permissões, tentativas
negadas). **Nunca** mostra IP nem o texto dos conteúdos.

**Erros e alertas** (`ERROR_CHANNEL_ID`; vazio = usa o canal de log): o bot avisa quando
- a **API** dá erro (5xx / exceção) — com tipo do erro, local no código, rota e quantas vezes;
- o **site** quebra na tela de um visitante (o navegador reporta sozinho);
- a **DeepL** para de funcionar (chave recusada, cota do plano gratuito acabou, fora do ar);
- alguém estoura o limite de requisições (possível flood/cópia em massa);
- a **API, o banco ou o site** (`SITE_URL`) **caem** — e quando **voltam**.
Anti-spam: o 1º aviso sai na hora; se o mesmo problema continua, só um novo aviso a cada 10 min (com "+N desde o último").
Problema marcado como resolvido no painel não é repostado (se voltar a acontecer, reabre). Detalhes e traceback: `/admin/errors`.

Como ligar:
1. Crie o(s) canal(is) só para a equipe e copie o ID (Modo Desenvolvedor → botão direito no canal → *Copiar ID*).
2. Dê ao bot, **nesses canais**, *Ver canal*, *Enviar mensagens* e *Inserir links*.
3. No `.env` do bot: `LOG_CHANNEL_ID`, `ERROR_CHANNEL_ID`, `SITE_URL=https://wiki.seudominio.com` (opcional: `LOG_POLL_SECONDS`,
   `HEALTH_POLL_SECONDS`, `LOG_IGNORE_ACTIONS=login,logout`).
4. Reinicie o bot. Ele guarda onde parou em `log_state.json` e `error_state.json` (não repete nem perde avisos ao reiniciar).
Se o **próprio bot** ou a SquareCloud inteira caírem, ninguém avisa — vale ter também um monitor externo (ex: UptimeRobot) no `/health/ready` da API.

### 2.2b Inglês por padrão + DeepL em tudo
O site, o painel, as mensagens da API e o bot são **inglês por padrão**. Todo conteúdo é escrito em **inglês** e a **DeepL traduz EN→PT-BR**
para os campos `_pt` ao salvar (se estiverem vazios; correção manual nunca é sobrescrita; botão **Retranslate** refaz). Vale para:
conteúdo (mobs/itens/armas…), masteries, jutsus, **vilas** (lema, descrição, descrição completa, clima), **clãs** e **organizações** (nome e
descrição) e **posts do blog**. O visitante escolhe PT/EN no seletor; a escolha **fica salva** no navegador. Sem `DEEPL_API_KEY` tudo
funciona, só não traduz sozinho.

Tem conteúdo antigo escrito em português nos campos principais? Converta com a DeepL (PT→EN) — faça backup antes:
```bash
python scripts/migrar_banco.py exportar                      # backup
python scripts/traduzir_para_ingles.py                       # SIMULAÇÃO: só mostra o que mudaria
python scripts/traduzir_para_ingles.py --aplicar             # converte (precisa de DEEPL_API_KEY)
```
O português antigo vai para o campo `_pt` e a tradução em inglês vira o campo principal. Só mexe no que parece português e ainda não tem `_pt`.

### 2.3 Segurança embutida (resumo)
- Sessão em cookie `httpOnly`/`SameSite=Lax`/`Secure`; checagem de `Origin` (CSRF); login com limite de tentativas.
- **Limite de requisições por IP** na API (leitura, escrita e imagens separados) e no site (`proxy.ts`): freia cópia em massa
  e flood. Robôs de cópia conhecidos (curl, python-requests, scrapy, headless...) recebem 403 nas páginas.
  Ajustes: `PUBLIC_REQUESTS_PER_MINUTE`, `WRITE_REQUESTS_PER_MINUTE`, `UPLOAD_REQUESTS_PER_MINUTE` (API) e
  `WEB_RATE_LIMIT_PER_MINUTE`, `BLOCK_SCRAPER_UAS=false` (site).
- Cabeçalhos de segurança + **CSP** + HSTS no site e na API; corpo de requisição limitado (413); uploads com limite de pixels.
- Texto rico validado no servidor (só blocos/formatações permitidos, links `javascript:` recusados) e filtro no "colar" do editor.
- Honestidade: conteúdo **público** precisa ser legível por qualquer visitante, então ninguém impede 100% a cópia por um robô
  decidido — o que se faz é torná-la lenta e cara, e proteger o servidor. Com a **Cloudflare** na frente (ver 3.7) fica bem melhor.

---

## 3. Hospedar na SquareCloud

A SquareCloud hospeda **cada projeto como um app separado**: 2 apps obrigatórios (API e site), 1 opcional (bot) e 1 banco
PostgreSQL. **Ela não executa Docker** — o `docker-compose.yml` é só para o seu computador; na nuvem o banco é o
*Databases → PostgreSQL* da SquareCloud (ou Neon/Supabase), e os dados do seu Postgres local são levados por backup (3.2).

### 3.0 Decisões importantes
1. **Domínio próprio com subdomínios** (`wiki.seudominio.com` = site, `api.seudominio.com` = API). O login usa cookie
   `SameSite=Lax`: site e API precisam estar no **mesmo site** ou o login não persiste. Em cada app: *Custom Domain*.
2. **Imagens e arquivos da equipe ficam em disco** (`NinWiki.Api/uploads` e `NinWiki.Api/staff_files`). Um redeploy pode
   apagar essas pastas → baixe-as antes (painel do app → *Files*) ou use um armazenamento externo no futuro.
3. Segredos ficam no `.env` **dentro do zip enviado** ou nos Secrets do GitHub (3.5) — nunca no Git.

### 3.1 Gerar os segredos
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"   # rode 2x: JWT_SECRET_KEY e BOT_API_TOKEN
```

### 3.2 Banco: criar na SquareCloud, ligar a API a ele e levar o conteúdo do seu Docker

A SquareCloud protege o PostgreSQL com **certificados TLS de cliente** (a conexão só abre para quem apresenta o certificado).
Você baixa 3 arquivos no painel e a API/o script de migração usam eles — sem certificado a conexão é recusada.

**Passo 1 — Criar o banco**
1. Painel da SquareCloud → *Databases* → **Create** → PostgreSQL (escolha o plano) → crie.
2. Abra o banco → aba de conexão. Anote **host, porta, usuário, senha e nome do banco**.
3. Na mesma tela baixe os **3 certificados**: o da autoridade (**CA**, `.crt`), o do cliente (**`.pem`**) e a **chave privada** (`.key`).
   > ⚠️ Esses arquivos são como uma senha: **nunca** vão para o Git (o `.gitignore` já ignora `certs/`, `*.pem` e `*.key`).

**Passo 2 — Guardar os certificados no projeto (só na sua máquina)**
```
NinWiki.Api/certs/ca.crt        # certificado da autoridade (CA)
NinWiki.Api/certs/client.pem    # certificado do cliente
NinWiki.Api/certs/client.key    # chave privada
```
No Linux/Mac: `chmod 600 NinWiki.Api/certs/client.key` (o Postgres recusa chave legível por outros usuários).

**Passo 3 — Levar o conteúdo do seu Docker para o banco da SquareCloud**
```bash
cd NinWiki.Api
python scripts/migrar_banco.py exportar        # gera backups/ninwiki-AAAAMMDD-HHMM.dump (do banco do seu Docker)

python scripts/migrar_banco.py importar backups/ninwiki-....dump \
  --url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO" \
  --ssl-ca certs/ca.crt --ssl-cert certs/client.pem --ssl-key certs/client.key --confirmo
```
- O `importar` **substitui** as tabelas do destino — por isso o `--confirmo`.
- Se você já preencheu `DATABASE_SSL_*` no `.env` (passo 4), pode omitir os 3 `--ssl-*`.
- O script usa o próprio Docker para rodar `pg_dump`/`pg_restore`; não precisa instalar nada. (Ele copia os certificados para
  dentro do container com a permissão certa — não se preocupe com `chmod` nesse caso.)
- **Backup do banco da SquareCloud** (para o seu computador): `python scripts/migrar_banco.py exportar --url "postgresql://..." --ssl-ca ... --ssl-cert ... --ssl-key ...`.

**Passo 4 — Configurar a API para usar o banco com certificado** (`NinWiki.Api/.env`)
```env
DATABASE_URL=postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/BANCO
DATABASE_SSL_CA=certs/ca.crt
DATABASE_SSL_CERT=certs/client.pem
DATABASE_SSL_KEY=certs/client.key
# DATABASE_SSL_VERIFY_HOSTNAME=false   # deixe false: o certificado da SquareCloud é validado pela CA (verify-ca)
```
Os caminhos são relativos a `NinWiki.Api`. A API (asyncpg) e as migrações (Alembic) leem as mesmas variáveis. **Não** coloque
`?ssl=require` na URL quando usar certificados. Se faltar algum arquivo, a API **não sobe** (de propósito: nunca conecta sem segurança em silêncio).

**Passo 5 — Enviar os certificados junto com a API**
- **Deploy manual (zip):** o `certs/` precisa estar **dentro do zip** (ele não está no `.squarecloudignore` de propósito).
- **Deploy automático (GitHub Actions):** crie 3 Secrets no GitHub — `DB_SSL_CA`, `DB_SSL_CERT`, `DB_SSL_KEY` — colando o
  **conteúdo inteiro** de cada arquivo. O workflow `deploy-api.yml` grava os arquivos em `certs/` só dentro do zip e apaga em seguida.

**Passo 6 — Imagens:** envie o conteúdo da sua pasta `NinWiki.Api/uploads/` para a pasta `uploads/` do app da API
(painel do app → *Files*). Os arquivos de avisos (`staff_files/`) só existem se você já postou avisos.

> Usando outro banco (Neon, Supabase…) sem certificado de cliente? Deixe `DATABASE_SSL_*` vazio e use `?ssl=require` na
> `DATABASE_URL` (e `?sslmode=require` no `--url` do script).

### 3.3 App da API (`NinWiki.Api`)
1. Crie o `.env` dentro de `NinWiki.Api` (base no `.env.example`) com **pelo menos**:
   ```env
   ENVIRONMENT=production
   DATABASE_URL=postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/BANCO
   DATABASE_SSL_CA=certs/ca.crt        # certificados do banco da SquareCloud (ver 3.2)
   DATABASE_SSL_CERT=certs/client.pem
   DATABASE_SSL_KEY=certs/client.key
   JWT_SECRET_KEY=<segredo gerado, 32+ caracteres>
   FRONTEND_ORIGIN=https://wiki.seudominio.com
   API_BASE_URL=https://api.seudominio.com
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   DISCORD_REDIRECT_URI=https://api.seudominio.com/auth/discord/callback
   SUPER_ADMIN_DISCORD_IDS=SEU_ID_DISCORD
   DEV_LOGIN_ENABLED=false
   BOT_API_TOKEN=<segredo gerado>      # só se for usar o bot
   DEEPL_API_KEY=                      # opcional
   TRUST_PROXY_HEADERS=true            # SIM em produção (atrás da SquareCloud/Cloudflare) - o limite por IP depende disso
   ```
   `ENVIRONMENT=production` desliga `/docs`, ativa cookie `Secure`/HSTS e a API **recusa iniciar** com `JWT_SECRET_KEY` fraco
   ou `DEV_LOGIN_ENABLED=true`.
2. Zip o **conteúdo** da pasta (`squarecloud.app` na raiz do zip), sem `venv`, `uploads`, `staff_files` e `backups`:
   ```bash
   cd NinWiki.Api && zip -r ../ninwiki-api.zip . -x "venv/*" ".venv/*" "__pycache__/*" "*/__pycache__/*" "uploads/*" "staff_files/*" "backups/*"
   ```
   (No Windows sem `zip`: selecione os arquivos da pasta **exceto** essas e use *Enviar para → Pasta compactada*.)
3. Painel → *Add New → New Application* → envie o zip. O `squarecloud.app` já define tudo (`MAIN=start.py`, 512 MB, porta 80).
4. O `start.py` roda `alembic upgrade head` e liga a API. Nos logs deve aparecer `iniciando API na porta 80`.
   Teste `https://api.seudominio.com/health`.
5. **Discord Developer Portal** → sua aplicação → *OAuth2 → Redirects* → adicione
   `https://api.seudominio.com/auth/discord/callback` (idêntico ao `DISCORD_REDIRECT_URI`).
6. Ajuste `SUBDOMAIN` no `squarecloud.app` (ou remova) se `ninwiki-api` já estiver em uso.

### 3.4 App do site (`NinWiki.Web`)
1. Crie `NinWiki.Web/.env` (o Next lê no build):
   ```env
   NEXT_PUBLIC_API_URL=https://api.seudominio.com
   NEXT_PUBLIC_SITE_URL=https://wiki.seudominio.com
   # opcionais: WEB_RATE_LIMIT_PER_MINUTE=300   BLOCK_SCRAPER_UAS=true
   ```
   ⚠️ `NEXT_PUBLIC_API_URL` é embutido **durante o build**: mudou o valor → novo deploy.
2. Zip sem `node_modules` e `.next`:
   ```bash
   cd NinWiki.Web && zip -r ../ninwiki-web.zip . -x "node_modules/*" ".next/*"
   ```
3. Envie como novo app. O `START` faz `npm run build && next start -p 80` (o primeiro start demora; 1024 MB de RAM — se faltar
   memória no build, aumente `MEMORY`). Configure o domínio `wiki.seudominio.com`.

### 3.5 App do bot (opcional) e deploy automático

**Bot:** crie o `.env` (base em `NinWiki.Bot/.env.example`: `DISCORD_BOT_TOKEN`, `NINWIKI_API_URL=https://api.seudominio.com`,
`BOT_API_TOKEN` igual ao da API, `ALLOWED_GUILD_IDS`, `LOG_CHANNEL_ID`, `ERROR_CHANNEL_ID`, `SITE_URL`), zip (`-x "venv/*" "__pycache__/*" "log_state.json" "error_state.json"`) e envie
como app. Não precisa de subdomínio nem porta.

**Deploy automático (GitHub Actions, manual):** cada app tem seu workflow (`deploy-api.yml`, `deploy-web.yml`, `deploy-bot.yml`)
que só roda quando você clica em *Actions → Run workflow*. O `.env` fica nos **Secrets** do GitHub.
1. Faça o primeiro envio de cada app pelo painel (passos acima) para ele existir e ter um ID.
2. *Settings → Secrets and variables → Actions*: `SQUARE_API_KEY`, `SQUARE_APP_ID_API/WEB/BOT`,
   `API_ENV`, `WEB_ENV`, `BOT_ENV` (cole o conteúdo **inteiro** de cada `.env`) e, para o banco com certificado, `DB_SSL_CA`, `DB_SSL_CERT`, `DB_SSL_KEY` (3.2).
3. Mudou uma configuração? Edite o Secret e rode o workflow de novo (no site, isso refaz o build).
O workflow não envia `uploads/`, `staff_files/` nem `backups/` (para não sobrescrever o que já está em produção).

### 3.6 Primeiro acesso
1. `https://wiki.seudominio.com/login` → entre com o Discord de um ID de `SUPER_ADMIN_DISCORD_IDS`.
2. Cadastre o resto da equipe em `/admin/staff` e ajuste `/admin/permissions`.
3. Se importou o banco do seu Docker (3.2), o conteúdo já está lá.

### 3.7 Recomendado: Cloudflare na frente
Proxy + WAF + cache. Aponte o DNS de `wiki.` e `api.` pela Cloudflare (nuvem laranja), modo SSL *Full (strict)*, ligue
*Bot Fight Mode* e regras de rate limit. Com isso, `TRUST_PROXY_HEADERS=true` passa a usar o IP real do visitante
(`CF-Connecting-IP`) e ataques de flood são barrados antes de chegar na SquareCloud.

### 3.8 Problemas comuns
| Sintoma | Causa provável |
|---|---|
| API não inicia, log fala de `JWT_SECRET_KEY` / `DEV_LOGIN_ENABLED` | `.env` inseguro com `ENVIRONMENT=production` — corrija |
| `connection refused` / erro de SSL no banco | `DATABASE_URL` errada, certificados faltando/errados (`DATABASE_SSL_*`, ver 3.2) ou, em banco sem certificado de cliente, falta `?ssl=require` |
| `Arquivo de certificado do banco nao encontrado` | `certs/` não foi no zip (ou os Secrets `DB_SSL_*` não foram criados) |
| `private key file ... has group or world access` | `chmod 600 NinWiki.Api/certs/client.key` |
| Build do site: `unrs-resolver install scripts blocked` | já resolvido no `package.json` (`allowScripts`); se aparecer, confira se o `package.json` enviado é o atual |
| Site: "Não foi possível conectar à API" | `NEXT_PUBLIC_API_URL` errada (precisa novo deploy) ou API fora do ar |
| Login volta para `/login` sem erro | domínios em sites diferentes (cookie Lax), ou `FRONTEND_ORIGIN` diferente do endereço real do site |
| `redirect_uri` inválido no Discord | redirect não cadastrado/idêntico no Developer Portal |
| Muitos `429` para todo mundo | `TRUST_PROXY_HEADERS=false` atrás de proxy (todos parecem o mesmo IP) ou limite baixo demais — aumente `PUBLIC_REQUESTS_PER_MINUTE` / `WEB_RATE_LIMIT_PER_MINUTE` |
| Bot: "BOT_API_TOKEN diferente nos dois .env" | tokens diferentes entre bot e API |
| Canal de erros/log vazio | `LOG_CHANNEL_ID` errado, bot sem permissão no canal, ou nada aconteceu ainda (o log começa "de agora") |
| Imagens sumiram após deploy | pasta `uploads` apagada no redeploy (ver 3.0, item 2) |
| Build do site morre | pouca memória: aumente `MEMORY` em `NinWiki.Web/squarecloud.app` |

---

## 4. Variáveis de ambiente (referência)

API — todas em `NinWiki.Api/.env.example`, comentadas. Web — `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_SITE_URL` (endereço público do site: sitemap, RSS, links e domínio dos vídeos
da Twitch; ambos entram no build) (+ `WEB_RATE_LIMIT_PER_MINUTE`, `BLOCK_SCRAPER_UAS`). Bot — `NinWiki.Bot/.env.example`.

## 5. Mapa do código (onde cada coisa mora)

Todo arquivo começa com um comentário-resumo do que faz e toda função tem uma linha explicando o que faz.
- `NinWiki.Api/app/main.py` liga tudo (rotas + camadas de proteção). `app/api/*` = rotas; `app/core/*` = configuração, login,
  permissões, limites de abuso (`hardening.py`, `rate_limit.py`), auditoria; `app/models/*` = tabelas; `app/schemas/*` = formatos JSON.
- `NinWiki.Api/alembic/versions/*` = histórico do banco; `scripts/*` = testes e utilitários (`migrar_banco.py`, `verificar_projeto.py`).
- `NinWiki.Web/app/*` = páginas (`(wiki)` público, `admin` painel); `components/*` = peças de tela; `lib/api-client.ts` = tudo que o
  site pede à API; `proxy.ts` = limite por IP/robôs; `next.config.js` = cabeçalhos de segurança/CSP.
- `NinWiki.Bot/main.py` + `ninwiki_bot/*` = comandos `/equipe` (`staff_commands.py`) e o log no Discord (`log_feed.py`).
