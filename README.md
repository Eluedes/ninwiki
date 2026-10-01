# NinWiki

Wiki com painel administrativo. Três projetos independentes na mesma pasta:

| Pasta | O que é | Tecnologia | Porta local |
|---|---|---|---|
| `NinWiki.Api` | API + banco (conteúdo, login, equipe, uploads) | Python, FastAPI, PostgreSQL | 8000 |
| `NinWiki.Web` | Site público + painel `/admin` | Next.js 16, React 18 | 3000 |
| `NinWiki.Bot` | Bot de Discord (`/equipe ...`) | Python, discord.py | — |

Outros documentos: `NinWiki.Web/GUIA_DE_EDICAO.md` (editar o frontend), `NinWiki.Web/MAESTRIAS.md`,
`NinWiki.Bot/README.md`, `ROADMAP.md`, `FASE2_LOCAL.md`.

---

## 1. Rodar no seu computador

Pré-requisitos: Python 3.12+, Node 20+, Docker (só para o Postgres).

### 1.1 Banco + API
```bash
cd NinWiki.Api
cp .env.example .env            # edite: senha do banco, JWT_SECRET_KEY, SUPER_ADMIN_DISCORD_IDS
docker compose up -d            # Postgres (porta 5433) + Adminer (http://localhost:8080)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head            # cria as tabelas
python -m uvicorn app.main:app --reload
```
Teste: http://localhost:8000/health e a documentação interativa em http://localhost:8000/docs
(só existe com `ENVIRONMENT=development`).

**Popular o banco com o conteúdo inicial (opcional, UMA vez):**
`python -m app.seed` — usa o `seed_data.json`. ⚠️ **Apaga** as tabelas de catálogo antes de recarregar. Nunca rode com um banco
que já tem conteúdo real.

**Entrar no painel sem Discord (só local):** no `.env` use `DEV_LOGIN_ENABLED=true` e `ENVIRONMENT=development`,
e coloque seu Discord ID em `SUPER_ADMIN_DISCORD_IDS` (Discord → Configurações → Avançado → Modo Desenvolvedor → botão
direito no seu nome → Copiar ID).

### 1.2 Site
```bash
cd NinWiki.Web
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                        # http://localhost:3000
```
Painel: http://localhost:3000/admin (login em `/login`).

### 1.3 Bot (opcional)
Veja `NinWiki.Bot/README.md`. Resumo: `cp .env.example .env`, preencher, `pip install -r requirements.txt`, `python main.py`.
(Use um venv separado do da API.)

### 1.4 Verificações
```bash
cd NinWiki.Api && python scripts/verificar_projeto.py   # confere código x migrations x banco x frontend
cd NinWiki.Web && npm run typecheck && npm run lint && npm run build
```

---

## 2. Como usar o painel

- **Cargos:** `S.Adm` (gerencia todos) > `Adm` (gerencia Creators) > `Creator` (só cria/edita conteúdo).
  Donos listados em `SUPER_ADMIN_DISCORD_IDS` viram S.Adm no primeiro login e não podem ser rebaixados.
- **Entrar:** `/login` → "Entrar com Discord". Só entra quem foi cadastrado na equipe (ter Discord não basta).
- **Conteúdo:** menu lateral do `/admin` → Conteúdo, Blog, Jutsus, Masteries, Vilas, Organizações. Cada item tem
  rascunho/publicado, imagem (upload até `MAX_UPLOAD_SIZE_MB`), histórico de edições e tradução automática PT→EN
  (se `DEEPL_API_KEY` estiver preenchida).
- **Quadro de avisos** (Visão Geral): todos da equipe leem e baixam os arquivos; **S.Adm e Adm** postam, fixam, editam, apagam e
  anexam arquivos (até 10 por aviso, `MAX_NOTICE_FILE_MB` MB cada; executáveis e HTML são recusados). Os arquivos ficam em
  `NinWiki.Api/staff_files/` (privados: só baixam logados) — faça backup dessa pasta junto com `uploads/`.
- **Vilas, Clãs e Organizações:** `/admin/villages` (cada clã tem nome, descrição e **imagem** com a logo e a roupa) e
  `/admin/organizations` (menu lateral → *Organizations*; liga cada organização às vilas em que atua).
- **Equipe** (`/admin/staff`, ou pelo bot `/equipe ...`) e **Permissões** (`/admin/permissions`): **só o S.Adm** enxerga.
  Em *Permissões* o S.Adm liga/desliga o que **Adm** e **Creator** podem fazer; vale na hora, com "Restaurar padrão".
- **Log geral:** `/admin/audit-log` mostra quem fez o quê, de onde (painel ou bot) e o IP.

---

## 3. Hospedar na SquareCloud

A SquareCloud hospeda **cada projeto como um app separado**. Você vai criar 3 apps (o bot é opcional)
e 1 banco PostgreSQL.

### 3.0 Antes de tudo — decisões importantes

1. **Domínio próprio é altamente recomendado.** O login usa cookie `SameSite=Lax`. Para o cookie ir do site para a API,
   os dois precisam estar no **mesmo site**, ex.: `wiki.seudominio.com` (Web) e `api.seudominio.com` (API).
   Com dois subdomínios `*.squareweb.app` diferentes o login pode não persistir.
   Na SquareCloud: app → *Custom Domain* e aponte o DNS como ela instruir (HTTPS é automático).
2. **Banco:** crie um PostgreSQL (painel da SquareCloud → *Databases*) ou use um externo (Neon, Supabase). Pegue a URL
   de conexão e converta para o formato da API: `postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/BANCO`
   (se o provedor exigir SSL, acrescente `?ssl=require`).
3. **Uploads de imagem** (`NinWiki.Api/uploads`) e **arquivos do quadro de avisos** (`NinWiki.Api/staff_files`) ficam em disco local. Fazer um novo deploy do app pode **apagar essas pastas**.
   Faça backup antes de redeployar (baixe os arquivos pelo painel) ou, no futuro, migre para um armazenamento externo (S3/R2).
4. Segredos ficam no arquivo `.env` **dentro do zip enviado** — nunca no Git.

### 3.1 Gerar os segredos
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"   # rode 2x: JWT_SECRET_KEY e BOT_API_TOKEN
```

### 3.2 App da API (`NinWiki.Api`)
1. Dentro de `NinWiki.Api`, crie o `.env` (base no `.env.example`) com **pelo menos**:
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
   TRUST_PROXY_HEADERS=false
   ```
   (`ENVIRONMENT=production` desliga `/docs`, ativa cookie `Secure` e a API **recusa iniciar** com `JWT_SECRET_KEY` fraco
   ou `DEV_LOGIN_ENABLED=true`.)
2. Zip o **conteúdo** da pasta (o `squarecloud.app` precisa ficar na raiz do zip), sem `venv`, `__pycache__` e `uploads`:
   ```bash
   cd NinWiki.Api && zip -r ../ninwiki-api.zip . -x "venv/*" ".venv/*" "__pycache__/*" "*/__pycache__/*" "uploads/*"
   ```
3. No painel da SquareCloud: *Add New → New Application* → envie `ninwiki-api.zip`.
   O arquivo `squarecloud.app` já define tudo (`MAIN=start.py`, 512 MB, porta 80).
4. O `start.py` roda `alembic upgrade head` (cria/atualiza as tabelas) e depois liga a API. Veja os logs: deve aparecer
   `iniciando API na porta 80`. Teste `https://api.seudominio.com/health`.
5. **Discord Developer Portal** → sua aplicação → *OAuth2 → Redirects* → adicione
   `https://api.seudominio.com/auth/discord/callback` (exatamente igual ao `DISCORD_REDIRECT_URI`).
6. Ajuste `SUBDOMAIN` no `squarecloud.app` (ou remova) se `ninwiki-api` já estiver em uso.

### 3.3 App do site (`NinWiki.Web`)
1. Dentro de `NinWiki.Web`, crie um arquivo `.env` (o Next lê no build):
   ```env
   NEXT_PUBLIC_API_URL=https://api.seudominio.com
   ```
   ⚠️ É embutido no site **durante o build**: se mudar o valor, faça novo deploy.
2. Zip sem `node_modules` e `.next`:
   ```bash
   cd NinWiki.Web && zip -r ../ninwiki-web.zip . -x "node_modules/*" ".next/*"
   ```
3. Envie como novo app. O `START` faz `npm run build && next start -p 80` (o primeiro start demora alguns minutos;
   por isso 1024 MB de RAM — se faltar memória no build, aumente `MEMORY`).
4. Configure o domínio `wiki.seudominio.com` neste app e `api.seudominio.com` no app da API.

### 3.4 App do bot (opcional, `NinWiki.Bot`)
1. Crie o `.env` (base em `.env.example`): `DISCORD_BOT_TOKEN`, `NINWIKI_API_URL=https://api.seudominio.com`,
   `BOT_API_TOKEN` (**igual** ao da API), `ALLOWED_GUILD_IDS` (recomendado).
2. `cd NinWiki.Bot && zip -r ../ninwiki-bot.zip . -x "venv/*" "__pycache__/*" "*/__pycache__/*"` e envie como app.
   Não precisa de subdomínio nem de porta.

### 3.4b Deploy automático pelo GitHub Actions (alternativa ao zip manual)

Cada app tem seu workflow (`deploy-api.yml`, `deploy-web.yml`, `deploy-bot.yml` em `.github/workflows`) que envia o app para a SquareCloud **só quando você clicar em
Actions → "Deploy API/Web/Bot na SquareCloud (manual)" → Run workflow**.
O `.env` fica guardado nos **Secrets** do GitHub (criptografados) — nunca no código.

1. Faça o primeiro envio de cada app pelo painel da SquareCloud (passos 3.2–3.4) para o app existir e ter um ID.
2. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**, crie:

| Secret | Valor |
|---|---|
| `SQUARE_API_KEY` | chave da API (SquareCloud → perfil → API) |
| `SQUARE_APP_ID_API` / `SQUARE_APP_ID_WEB` / `SQUARE_APP_ID_BOT` | ID de cada app (painel → app → configurações) |
| `API_ENV` | o conteúdo **inteiro** do `.env` da API (cole o arquivo todo) |
| `WEB_ENV` | o `.env` do site (`NEXT_PUBLIC_API_URL=...`) |
| `BOT_ENV` | o `.env` do bot (opcional) |

3. Para mudar uma configuração, edite o Secret e rode o workflow de novo (no site, isso também refaz o build).

⚠️ O workflow usa o endpoint `POST /v2/apps/{id}/commit` da API da SquareCloud. Se ela mudar, ajuste
`.github/scripts/deploy-squarecloud.sh`. Lembrete: o redeploy pode apagar `uploads/` da API (ver 3.0, item 3).

### 3.5 Primeiro acesso
1. Abra `https://wiki.seudominio.com/login` e entre com o Discord de um ID listado em `SUPER_ADMIN_DISCORD_IDS`.
2. Cadastre o resto da equipe em `/admin/staff`.
3. O banco começa vazio. Para importar o conteúdo inicial, rode o seed **uma única vez, na sua máquina**, apontando o
   `DATABASE_URL` do `.env` local para o banco da SquareCloud (`python -m app.seed`). Não rode em banco com dados reais.

### 3.6 Problemas comuns
| Sintoma | Causa provável |
|---|---|
| API não inicia, log fala de `JWT_SECRET_KEY` / `DEV_LOGIN_ENABLED` | `.env` inseguro com `ENVIRONMENT=production` — corrija |
| `connection refused` / erro de SSL no banco | `DATABASE_URL` errada; tente `?ssl=require` |
| Site abre mas diz "Não foi possível conectar à API" | `NEXT_PUBLIC_API_URL` errada (precisa novo deploy) ou API fora do ar |
| Login volta para `/login` sem erro | domínios em sites diferentes (cookie Lax), ou `FRONTEND_ORIGIN` diferente do endereço real do site (sem `/` no final) |
| `redirect_uri` inválido no Discord | redirect não cadastrado/igual no Developer Portal |
| Bot: "BOT_API_TOKEN diferente nos dois .env" | tokens diferentes entre bot e API |
| Imagens sumiram após deploy | pasta `uploads` apagada no redeploy (ver 3.0, item 3) |
| Build do site morre | pouca memória: aumente `MEMORY` em `NinWiki.Web/squarecloud.app` |

---

## 4. Variáveis de ambiente (referência)

API — todas em `NinWiki.Api/.env.example`, comentadas. Web — `NEXT_PUBLIC_API_URL`. Bot — `NinWiki.Bot/.env.example`.
