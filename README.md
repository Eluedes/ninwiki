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
  decidido — o que se faz é torná-la lenta e cara, e proteger o servidor. Com a **Cloudflare** na frente (ver 3.8) fica bem melhor.

---

## 3. Hospedar na SquareCloud (com o deploy automático do GitHub)

Este é o passo a passo **completo, do zero até o site no ar**, usando os **workflows do GitHub Actions** para enviar o
código. Você **não precisa** ter Python, Node nem Docker para publicar: o GitHub monta o pacote e manda para a SquareCloud.
(Docker só serve, no seu computador, para levar o conteúdo que você já tem localmente — passo 3.4.)

### 3.0 Visão geral — o que vai existir no final

| Peça | Onde roda | Endereço | Obrigatória |
|---|---|---|---|
| Banco PostgreSQL | *Databases* da SquareCloud | interno (host/porta + certificados) | sim |
| **API** (`NinWiki.Api`) | app da SquareCloud | `https://api.seudominio.com` | sim |
| **Site** (`NinWiki.Web`) | app da SquareCloud | `https://wiki.seudominio.com` | sim |
| **Bot** (`NinWiki.Bot`) | app da SquareCloud | — (não tem endereço) | não |

Como funciona o ciclo: você **empurra o código para o GitHub** → abre *Actions → Deploy ... → Run workflow* → o GitHub
zipa a pasta, grava o `.env` e os certificados **só dentro do zip** (vindos dos *Secrets*, nunca do Git) e envia para o app
na SquareCloud, que reinicia. A API, ao iniciar, aplica sozinha as migrações do banco.

**Ordem do passo a passo:** 3.1 contas e segredos → 3.2 Discord → 3.3 banco → 3.4 (opcional) levar seu conteúdo local →
3.5 criar os apps na SquareCloud → 3.6 GitHub Secrets → 3.7 rodar os workflows → 3.8 domínios → 3.9 conferir → depois, 3.10 no dia a dia.

> ⚠️ **Domínio próprio é obrigatório.** O login usa cookie `SameSite=Lax`: o site e a API precisam estar no **mesmo site**
> (`wiki.seudominio.com` + `api.seudominio.com`). Com os endereços gratuitos `*.squareweb.app` o navegador trata os dois
> como sites diferentes e **o login não funciona**. O recurso de domínio personalizado pode depender do plano da SquareCloud — confira no painel.

### 3.1 Antes de começar: contas e segredos
Você vai precisar de:
- conta na **SquareCloud** com plano que comporte 2–3 apps + 1 banco (API 512 MB, site 1024 MB, bot 256 MB);
- um **domínio** (ex.: `seudominio.com`) — de preferência com DNS na **Cloudflare** (3.8);
- este repositório no **GitHub** (você já tem) com permissão para criar *Secrets* e rodar *Actions*;
- uma **aplicação no Discord Developer Portal** (3.2).

Gere os dois segredos (rode 2×; **guarde os valores**, são senhas):
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"   # 1º = JWT_SECRET_KEY   2º = BOT_API_TOKEN
```
(Sem Python à mão? Qualquer gerador de senha com 48+ caracteres aleatórios serve.)

### 3.2 Discord: aplicação do login (e do bot)
1. <https://discord.com/developers/applications> → **New Application** (o nome aparece na tela de autorização).
2. **OAuth2** → copie **Client ID** e **Client Secret** (*Reset Secret* se precisar) → vão para `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`.
3. **OAuth2 → Redirects** → *Add Redirect*: `https://api.seudominio.com/auth/discord/callback` (idêntico ao `DISCORD_REDIRECT_URI`;
   esse mesmo endereço serve ao login da equipe **e** ao dos leitores do blog). Salve.
4. Seu **Discord ID** (vai em `SUPER_ADMIN_DISCORD_IDS`): Discord → Configurações → Avançado → *Modo Desenvolvedor* → botão
   direito no seu nome → *Copiar ID do usuário*.
5. **Só se for usar o bot:** aba **Bot** → *Reset Token* (vai em `DISCORD_BOT_TOKEN`; **não** é o Client Secret) → convide o bot
   ao seu servidor em *OAuth2 → URL Generator* (scopes `bot` e `applications.commands`; permissões *Ver canais*, *Enviar mensagens*, *Inserir links*).

### 3.3 Banco: criar o PostgreSQL na SquareCloud e baixar os certificados
A SquareCloud protege o PostgreSQL com **certificados TLS de cliente**: a conexão só abre para quem apresenta o certificado.
1. Painel da SquareCloud → *Databases* → **Create** → PostgreSQL → crie.
2. Abra o banco e anote **host, porta, usuário, senha e nome do banco**.
3. Na mesma tela baixe os **3 arquivos**: **Certificate CA** (`.crt`), **PEM** (`.pem`) e **Private Key** (`.key`).
   > ⚠️ São como uma senha: **nunca** vão para o Git (o `.gitignore` já ignora `certs/`, `*.pem` e `*.key`).
4. Você vai usá-los em **dois lugares**: nos *Secrets* do GitHub (3.6, para a API publicada) e, se for migrar dados do seu
   computador, numa pasta local `NinWiki.Api/certs/` (3.4).

### 3.4 (Opcional) Levar para a SquareCloud o conteúdo que você já tem no Docker
Pule este passo para **começar com o banco vazio** (a API cria as tabelas sozinha no primeiro start; o conteúdo você cria no painel).
Este é o **único passo que roda no seu computador** (precisa do Docker, com o container do banco no ar):
```bash
cd NinWiki.Api
python scripts/migrar_banco.py exportar        # gera backups/ninwiki-AAAAMMDD-HHMM.dump (do banco do seu Docker)
mkdir certs                                     # coloque aqui ca.crt, client.pem e client.key (3.3)
python scripts/migrar_banco.py importar backups/ninwiki-....dump \
  --url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO" \
  --ssl-ca certs/ca.crt --ssl-cert certs/client.pem --ssl-key certs/client.key --confirmo
```
- O `importar` **substitui** as tabelas do destino (por isso o `--confirmo`). Se o banco da SquareCloud já tem dados, faça antes um backup:
  `python scripts/migrar_banco.py exportar --url "postgresql://..." --ssl-ca ... --ssl-cert ... --ssl-key ...`.
- O script usa o próprio Docker para rodar `pg_dump`/`pg_restore` e já ajusta a permissão da chave; nada a instalar.
- **Imagens do blog/wiki** (`NinWiki.Api/uploads/`): o workflow **não** envia essa pasta (para nunca sobrescrever o que está
  em produção). Depois de criar o app da API (3.5), envie as imagens pelo painel do app → *Files* → pasta `uploads/`.
- Banco sem certificado de cliente (Neon, Supabase…)? Pule os `--ssl-*`, use `?sslmode=require` no `--url` e deixe `DB_SSL_*` vazio na 3.6.

### 3.5 Criar os apps na SquareCloud (uma vez só) e anotar os IDs
O workflow **atualiza** um app que já existe, então cada app precisa ser criado uma vez. Truque para não ter de zipar o projeto:
envie um **pacote mínimo**; o primeiro workflow (3.7) coloca o código de verdade por cima.

| App | Arquivos do pacote mínimo (copie da pasta indicada e zipe) |
|---|---|
| API | `NinWiki.Api/squarecloud.app` + `NinWiki.Api/start.py` |
| Site | `NinWiki.Web/squarecloud.app` + `NinWiki.Web/package.json` |
| Bot (opcional) | `NinWiki.Bot/squarecloud.app` + `NinWiki.Bot/main.py` |

No Windows: selecione os 2 arquivos → botão direito → *Enviar para → Pasta compactada*. Depois, para cada um:
1. Painel → **Add New → New Application** → envie o `.zip`. (Ele vai dar erro ao iniciar — é esperado, ainda falta o código.)
2. Se o `SUBDOMAIN` (`ninwiki-api`, `ninwiki`) já estiver em uso, troque no `squarecloud.app` do pacote **e** no do repositório.
3. Anote o **ID do app** (aparece na página do app, e na URL).

Depois pegue sua **chave da API da SquareCloud**: painel → seu perfil/conta → **API Key** (gere/regenere). É a `SQUARE_API_KEY`.
> Tratar a chave como senha: quem a tem controla todos os seus apps.

### 3.6 GitHub Secrets (onde ficam o `.env` e os certificados)
GitHub → o repositório → **Settings → Secrets and variables → Actions → New repository secret**. Crie um por linha:

| Secret | Valor | Obrigatório |
|---|---|---|
| `SQUARE_API_KEY` | chave da API da SquareCloud (3.5) | sim |
| `SQUARE_APP_ID_API` | ID do app da API (3.5) | sim |
| `SQUARE_APP_ID_WEB` | ID do app do site (3.5) | sim |
| `SQUARE_APP_ID_BOT` | ID do app do bot (3.5) | só se usar o bot |
| `API_ENV` | conteúdo **inteiro** do `.env` da API (modelo abaixo) | sim |
| `WEB_ENV` | conteúdo **inteiro** do `.env` do site (modelo abaixo) | sim |
| `BOT_ENV` | conteúdo **inteiro** do `.env` do bot (modelo abaixo) | só se usar o bot |
| `DB_SSL_CA` | texto completo do arquivo `.crt` (`-----BEGIN CERTIFICATE-----` até o `END`) | se o banco usa certificado |
| `DB_SSL_CERT` | texto completo do arquivo `.pem` | idem |
| `DB_SSL_KEY` | texto completo do arquivo `.key` | idem |

Para colar um certificado: abra o arquivo no Bloco de Notas, selecione **tudo** (Ctrl+A), copie e cole no campo do Secret.

**Modelo do `API_ENV`** (troque tudo que está em MAIÚSCULAS/`seudominio`):
```env
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/BANCO
DATABASE_SSL_CA=certs/ca.crt
DATABASE_SSL_CERT=certs/client.pem
DATABASE_SSL_KEY=certs/client.key
JWT_SECRET_KEY=COLE_O_PRIMEIRO_SEGREDO_GERADO
FRONTEND_ORIGIN=https://wiki.seudominio.com
API_BASE_URL=https://api.seudominio.com
DISCORD_CLIENT_ID=SEU_CLIENT_ID
DISCORD_CLIENT_SECRET=SEU_CLIENT_SECRET
DISCORD_REDIRECT_URI=https://api.seudominio.com/auth/discord/callback
SUPER_ADMIN_DISCORD_IDS=SEU_DISCORD_ID
DEV_LOGIN_ENABLED=false
TRUST_PROXY_HEADERS=true
BOT_API_TOKEN=COLE_O_SEGUNDO_SEGREDO_GERADO
DEEPL_API_KEY=
```
- Os 3 `DATABASE_SSL_*` apontam para os arquivos que o workflow cria a partir dos Secrets `DB_SSL_*` (não mude os caminhos). Sem
  certificado de cliente: apague essas 3 linhas e use `?ssl=require` no fim da `DATABASE_URL`.
- `ENVIRONMENT=production` desliga `/docs`, liga cookie `Secure`/HSTS, e a API **recusa iniciar** com `JWT_SECRET_KEY` fraco ou `DEV_LOGIN_ENABLED=true`.
- `TRUST_PROXY_HEADERS=true` é necessário atrás da SquareCloud/Cloudflare (senão todos os visitantes parecem ter o mesmo IP).
- `DEEPL_API_KEY` (opcional): ativa a tradução automática EN→PT. Chaves gratuitas terminam em `:fx`.

**Modelo do `WEB_ENV`:**
```env
NEXT_PUBLIC_API_URL=https://api.seudominio.com
NEXT_PUBLIC_SITE_URL=https://wiki.seudominio.com
# opcionais: WEB_RATE_LIMIT_PER_MINUTE=300   BLOCK_SCRAPER_UAS=true
```
⚠️ Esses valores são embutidos **no build**: mudou algo → edite o Secret e rode o workflow do site de novo.

**Modelo do `BOT_ENV`** (detalhes de cada opção em `NinWiki.Bot/.env.example`):
```env
DISCORD_BOT_TOKEN=TOKEN_DO_BOT
NINWIKI_API_URL=https://api.seudominio.com
BOT_API_TOKEN=O_MESMO_SEGUNDO_SEGREDO_DA_API
ALLOWED_GUILD_IDS=ID_DO_SEU_SERVIDOR
LOG_CHANNEL_ID=ID_DO_CANAL_DE_LOG
ERROR_CHANNEL_ID=ID_DO_CANAL_DE_ALERTAS
SITE_URL=https://wiki.seudominio.com
```

### 3.7 Rodar os workflows (nesta ordem)
GitHub → aba **Actions** → escolha o workflow na lista da esquerda → **Run workflow** (branch `main`, ou a que você publica) → **Run workflow**.
1. **Deploy API na SquareCloud (manual)** → espere ficar verde. Painel da SquareCloud → app da API → **Logs**: deve aparecer
   `aplicando migrations...` e depois `iniciando API na porta 80...`. Teste `https://api.seudominio.com/health` (depois do 3.8; antes
   disso use o endereço `*.squareweb.app` do app só para testar).
2. **Deploy Web na SquareCloud (manual)** → o primeiro start **demora alguns minutos** (faz o `npm install` e o `next build`; precisa dos 1024 MB). Acompanhe nos Logs até `Ready`.
3. **Deploy Bot na SquareCloud (manual)** (opcional) → Logs: o bot conecta e, em até 1 h (ou na hora com `DEV_GUILD_ID`), os comandos `/team` aparecem.

O que o workflow faz por você: monta o `.env` a partir do Secret, grava os certificados em `certs/`, zipa a pasta **sem** `node_modules`, `.next`, `venv`,
`uploads`, `staff_files` e `backups`, envia pela API da SquareCloud e apaga tudo (`.env`, certificados, zip) do runner no fim.
Se algo der errado, o log do workflow mostra a resposta da SquareCloud (nunca o conteúdo do `.env`).

### 3.8 Domínios e DNS
1. Em **cada app** (API e site) → painel → *Custom Domain* → informe `api.seudominio.com` / `wiki.seudominio.com`. A SquareCloud mostra o **registro DNS** a criar (normalmente um CNAME).
2. No DNS do domínio (Cloudflare recomendada) crie esses registros exatamente como a SquareCloud mostrou.
3. **Cloudflare (recomendado):** nuvem laranja ligada, modo SSL **Full (strict)**, *Bot Fight Mode* ligado e uma regra de rate limit.
   Com isso `TRUST_PROXY_HEADERS=true` usa o IP real do visitante (`CF-Connecting-IP`) e floods são barrados antes de chegar na SquareCloud.
4. Espere o DNS propagar (minutos a horas) e confira `https://api.seudominio.com/health`.

### 3.9 Conferir se está tudo certo (checklist)
- [ ] `https://api.seudominio.com/health` → `{"status":"ok","environment":"production"}`
- [ ] `https://api.seudominio.com/health/ready` → `{"status":"ok","database":"ok"}` (se `503`, a API não alcança o banco: revise `DATABASE_URL` e os certificados)
- [ ] `https://wiki.seudominio.com` abre a Home; `/blog` abre (vazio, se começou sem dados)
- [ ] `https://wiki.seudominio.com/login` → **Entrar com Discord** com a conta do `SUPER_ADMIN_DISCORD_IDS` → cai no `/admin`
- [ ] Em `/admin/staff` cadastre o resto da equipe e ajuste `/admin/permissions`
- [ ] Crie um post de teste com imagem; confira a imagem no site (se não aparecer, `API_BASE_URL` está errado)
- [ ] Num navegador sem login: abra um post, entre com o Discord (leitor), comente e curta
- [ ] Bot: `/team ...` responde e os canais de log/erros recebem mensagens

### 3.10 No dia a dia
- **Publicar uma atualização:** *commit/push* no GitHub → Actions → rode **só** o workflow do que mudou (API, site ou bot). A API reinicia e
  aplica migrações novas sozinha; se a migração falhar, **a API não sobe** (o banco nunca fica desatualizado em silêncio).
- **Mudar uma configuração:** edite o Secret (`API_ENV`/`WEB_ENV`/`BOT_ENV`) e rode o workflow de novo. Você pode desmarcar *Reiniciar o app* se quiser reiniciar depois.
- **Voltar uma versão:** em *Run workflow* escolha outra branch/tag (ou faça *revert* no Git e rode de novo). Migrações **não** voltam sozinhas: se a versão antiga for incompatível com o banco, restaure um backup.
- **Backup do banco:** `python scripts/migrar_banco.py exportar --url "postgresql://..." --ssl-ca ... --ssl-cert ... --ssl-key ...` (no seu computador, com Docker). Faça antes de mudanças grandes.
- **Backup das imagens:** painel do app da API → *Files* → baixe `uploads/` e `staff_files/` (um redeploy do app inteiro pelo painel pode apagá-las; o workflow não mexe nelas).
- **Ver o que está acontecendo:** painel do app → *Logs*; no Discord, canais de log e de erros do bot; no site, `/admin/errors` (S.Adm).

### 3.11 Problemas comuns
| Sintoma | Causa provável / o que fazer |
|---|---|
| Workflow: `Secret/variável 'SQUARE_API_KEY' vazia` (ou `APP_ID`/`APP_ENV`) | o Secret não existe ou tem outro nome — confira a tabela da 3.6 (maiúsculas exatas) |
| Workflow: `Deploy falhou (HTTP 401/403)` | `SQUARE_API_KEY` errada, regenerada ou sem permissão |
| Workflow: `HTTP 404` | `SQUARE_APP_ID_*` errado (ID de outro app ou digitado errado) |
| Workflow verde, mas o app não funciona | olhe os **Logs do app** na SquareCloud — o erro real aparece lá |
| API não inicia: `JWT_SECRET_KEY` / `DEV_LOGIN_ENABLED` | `.env` inseguro com `ENVIRONMENT=production` — corrija o `API_ENV` |
| API: `Arquivo de certificado do banco nao encontrado` | Secrets `DB_SSL_CA/CERT/KEY` não criados (ou o `API_ENV` aponta para outro caminho) |
| API: `SSL error`, `certificate verify failed`, `connection refused` | `DATABASE_URL`/porta errada, certificado trocado ou colado incompleto (precisa do `BEGIN`/`END`) |
| API: `private key file ... has group or world access` | já tratado automaticamente; se aparecer, atualize para a versão mais recente do repositório |
| API 500 em `/posts` ou `/auth/me` logo após atualizar | migração não aplicada: veja nos Logs se `aplicando migrations` terminou; reinicie o app |
| Site: "Não foi possível conectar à API" | `NEXT_PUBLIC_API_URL` errada no `WEB_ENV` (rode o workflow do site de novo) ou API fora do ar |
| Build do site morre / reinicia sozinho | pouca memória: aumente `MEMORY` em `NinWiki.Web/squarecloud.app` e rode o workflow de novo |
| Build do site: `unrs-resolver install scripts blocked` | já resolvido no `package.json` (`allowScripts`) — rode o workflow com o repositório atualizado |
| Login volta para `/login` sem erro | site e API em "sites" diferentes (use `wiki.` e `api.` do mesmo domínio) ou `FRONTEND_ORIGIN` diferente do endereço real do site |
| `redirect_uri` inválido no Discord | redirect da 3.2 não cadastrado ou diferente do `DISCORD_REDIRECT_URI` |
| Muitos `429` para todo mundo | `TRUST_PROXY_HEADERS=false` atrás de proxy, ou limite baixo: aumente `PUBLIC_REQUESTS_PER_MINUTE` / `WEB_RATE_LIMIT_PER_MINUTE` |
| Bot: "BOT_API_TOKEN diferente nos dois .env" | o `BOT_ENV` e o `API_ENV` precisam ter o **mesmo** `BOT_API_TOKEN` |
| Canal de log/erros vazio | `LOG_CHANNEL_ID` errado, bot sem permissão no canal, ou nada aconteceu ainda (o log começa "de agora") |
| Imagens sumiram | pasta `uploads` apagada em um redeploy feito pelo painel (restaure do backup — 3.10) |
| Imagens aparecem quebradas | `API_BASE_URL` errado no `API_ENV` (precisa ser o endereço público da API) |

### 3.12 Alternativa sem GitHub Actions (envio manual do zip)
Se preferir não usar os workflows: crie o `.env` dentro da pasta do app, zipe o **conteúdo** da pasta (sem `venv`, `node_modules`, `.next`,
`uploads`, `staff_files`, `backups`) e envie pelo painel. Na API inclua também `certs/`. O resto (Discord, domínios, conferência) é igual.

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
