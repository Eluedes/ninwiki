# NinWiki

Wiki com painel administrativo. Três projetos independentes na mesma pasta:

| Pasta | O que é | Tecnologia | Porta local |
|---|---|---|---|
| `NinWiki.Api` | API + banco (conteúdo, login, equipe, avisos, uploads) | Python, FastAPI, PostgreSQL | 8000 |
| `NinWiki.Web` | Site público + painel `/admin` | Next.js 16, React 18 | 3000 |
| `NinWiki.Bot` | Bot de Discord (`/equipe ...` + log no canal) | Python, discord.py | — |

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
python scripts/testar_permissoes.py        # 282 verificações de segurança/permissões (precisa do banco no ar)
python scripts/testar_bot_integracao.py    # 61 verificações do bot + log (precisa do banco no ar)
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
- **Vilas, Clãs e Organizações:** `/admin/villages` (cada clã tem nome, descrição e **imagem** com a logo e a roupa) e
  `/admin/organizations` (liga cada organização às vilas em que atua).
- **Quadro de avisos** (Visão Geral): toda a equipe lê e baixa os arquivos; **S.Adm e Adm** postam, fixam, editam, apagam e
  anexam arquivos (até 10 por aviso, `MAX_NOTICE_FILE_MB` MB cada; executáveis e HTML são recusados).
- **Permissões** (`/admin/permissions`, só S.Adm): liga/desliga o que **Adm** e **Creator** podem fazer; vale na hora.
- **Log geral:** `/admin/audit-log` (quem fez o quê; o IP só o S.Adm vê).

### 2.2 Log no Discord (bot)
O bot posta num canal tudo o que acontece no painel (criou/editou/apagou, logins, mudanças de equipe e de permissões,
tentativas negadas). **Nunca** mostra IP nem o texto dos conteúdos.
1. Crie um canal só para a equipe e copie o ID (Modo Desenvolvedor → botão direito no canal → *Copiar ID*).
2. Dê ao bot, **nesse canal**, as permissões *Ver canal*, *Enviar mensagens* e *Inserir links*.
3. No `.env` do bot: `LOG_CHANNEL_ID=...` (opcional: `LOG_POLL_SECONDS=20`, `LOG_IGNORE_ACTIONS=login,logout`).
4. Reinicie o bot. Ele guarda onde parou em `NinWiki.Bot/log_state.json` (não repete nem perde ações ao reiniciar).

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

### 3.2 Banco: criar na SquareCloud e levar o conteúdo do seu Docker
1. Painel da SquareCloud → *Databases* → criar **PostgreSQL**. Copie a URL de conexão.
2. **Exportar** o banco que está no seu Docker (com o container no ar):
   ```bash
   cd NinWiki.Api
   python scripts/migrar_banco.py exportar        # gera backups/ninwiki-AAAAMMDD-HHMM.dump
   ```
3. **Importar** na SquareCloud (**substitui** as tabelas do destino — por isso o `--confirmo`):
   ```bash
   python scripts/migrar_banco.py importar backups/ninwiki-....dump --url "postgresql://USER:SENHA@HOST:PORTA/BANCO" --confirmo
   ```
   (Se o banco exigir SSL, acrescente `?sslmode=require` à URL. Usa o próprio Docker para rodar `pg_restore`; nada a instalar.)
4. **Imagens:** envie o conteúdo da sua pasta `NinWiki.Api/uploads/` para a pasta `uploads/` do app da API
   (painel do app → *Files*). Os arquivos de avisos (`staff_files/`) só existem se você já postou avisos.
5. O `DATABASE_URL` do `.env` da API usa o formato `postgresql+asyncpg://USER:SENHA@HOST:PORTA/BANCO`
   (com `?ssl=require` se necessário). Esse mesmo script serve como **backup** periódico (rode o `exportar` apontando para o
   banco que quiser salvar).

### 3.3 App da API (`NinWiki.Api`)
1. Crie o `.env` dentro de `NinWiki.Api` (base no `.env.example`) com **pelo menos**:
   ```env
   ENVIRONMENT=production
   DATABASE_URL=postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/BANCO
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
`BOT_API_TOKEN` igual ao da API, `ALLOWED_GUILD_IDS`, `LOG_CHANNEL_ID`), zip (`-x "venv/*" "__pycache__/*" "log_state.json"`) e envie
como app. Não precisa de subdomínio nem porta.

**Deploy automático (GitHub Actions, manual):** cada app tem seu workflow (`deploy-api.yml`, `deploy-web.yml`, `deploy-bot.yml`)
que só roda quando você clica em *Actions → Run workflow*. O `.env` fica nos **Secrets** do GitHub.
1. Faça o primeiro envio de cada app pelo painel (passos acima) para ele existir e ter um ID.
2. *Settings → Secrets and variables → Actions*: `SQUARE_API_KEY`, `SQUARE_APP_ID_API/WEB/BOT`,
   `API_ENV`, `WEB_ENV`, `BOT_ENV` (cole o conteúdo **inteiro** de cada `.env`).
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
| `connection refused` / erro de SSL no banco | `DATABASE_URL` errada; tente `?ssl=require` |
| Site: "Não foi possível conectar à API" | `NEXT_PUBLIC_API_URL` errada (precisa novo deploy) ou API fora do ar |
| Login volta para `/login` sem erro | domínios em sites diferentes (cookie Lax), ou `FRONTEND_ORIGIN` diferente do endereço real do site |
| `redirect_uri` inválido no Discord | redirect não cadastrado/idêntico no Developer Portal |
| Muitos `429` para todo mundo | `TRUST_PROXY_HEADERS=false` atrás de proxy (todos parecem o mesmo IP) ou limite baixo demais — aumente `PUBLIC_REQUESTS_PER_MINUTE` / `WEB_RATE_LIMIT_PER_MINUTE` |
| Bot: "BOT_API_TOKEN diferente nos dois .env" | tokens diferentes entre bot e API |
| Canal de log vazio | `LOG_CHANNEL_ID` errado, bot sem permissão no canal, ou nada aconteceu ainda (o log começa "de agora") |
| Imagens sumiram após deploy | pasta `uploads` apagada no redeploy (ver 3.0, item 2) |
| Build do site morre | pouca memória: aumente `MEMORY` em `NinWiki.Web/squarecloud.app` |

---

## 4. Variáveis de ambiente (referência)

API — todas em `NinWiki.Api/.env.example`, comentadas. Web — `NEXT_PUBLIC_API_URL` (+ `WEB_RATE_LIMIT_PER_MINUTE`,
`BLOCK_SCRAPER_UAS`). Bot — `NinWiki.Bot/.env.example`.

## 5. Mapa do código (onde cada coisa mora)

Todo arquivo começa com um comentário-resumo do que faz e toda função tem uma linha explicando o que faz.
- `NinWiki.Api/app/main.py` liga tudo (rotas + camadas de proteção). `app/api/*` = rotas; `app/core/*` = configuração, login,
  permissões, limites de abuso (`hardening.py`, `rate_limit.py`), auditoria; `app/models/*` = tabelas; `app/schemas/*` = formatos JSON.
- `NinWiki.Api/alembic/versions/*` = histórico do banco; `scripts/*` = testes e utilitários (`migrar_banco.py`, `verificar_projeto.py`).
- `NinWiki.Web/app/*` = páginas (`(wiki)` público, `admin` painel); `components/*` = peças de tela; `lib/api-client.ts` = tudo que o
  site pede à API; `proxy.ts` = limite por IP/robôs; `next.config.js` = cabeçalhos de segurança/CSP.
- `NinWiki.Bot/main.py` + `ninwiki_bot/*` = comandos `/equipe` (`staff_commands.py`) e o log no Discord (`log_feed.py`).
