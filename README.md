# Nin Codex

**Nin Codex** (antes Nin Online Wiki / NinWiki) é a wiki do jogo **Nin Online**, com painel administrativo (mais uma página extra do Guima). O *jogo* continua se chamando Nin Online; as pastas e os nomes técnicos continuam `NinWiki.*` de propósito (renomear quebraria workflows e backups). Projetos independentes na mesma pasta:

| Pasta | O que é | Tecnologia | Porta local |
|---|---|---|---|
| `NinWiki.Api` | API + banco (conteúdo, login, equipe, avisos, uploads) | Python, FastAPI, PostgreSQL | 8000 |
| `NinWiki.Web` | Site público + painel `/admin` | Next.js 16, React 18 | 3000 |
| `Guima.Site` | Página única "em construção" da Guima Company (Node sem dependências, segurança embutida; ver `Guima.Site/README.md`) | Node | 3100 |
| `NinWiki.Bot` | Bot de Discord (`/status`, `/search`, `/language`, log, erros e painel de status no canal) | Python, discord.py | — |

Outros documentos: `ROADMAP.md` (estado real do que está feito / falta / obsoleto e as próximas fases), `FASE2_LOCAL.md` (login e cargos),
`NinWiki.Bot/README.md`, `Cloudflare/README.md`, [`Azure/LEIA-ME.md`](Azure/LEIA-ME.md) (plano B: hospedagem no Azure, não usada agora) e `CONTEXTO_PARA_IA.md` (regras para qualquer IA).
Os antigos guias `GUIA_DE_EDICAO.md`/`MAESTRIAS.md` e o fluxo de seed (`app/seed.py`, `lib/*-data.ts`) foram **removidos**; o conteúdo é editado no painel.

> **Hospedagem:** o Nin Codex roda na **SquareCloud** (seção 3; passo a passo de entrada em produção na **3.13**). O **Azure** (seção 3A e pasta `Azure/`) é só o **plano B**, pronto e sem uso por enquanto.

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
- `REQUIRE_DISCORD_2FA` = `true` (padrão) exige que a conta do Discord de quem entra no painel tenha o **2FA** ligado; `false` desliga a exigência (veja "Segurança reforçada" abaixo).
  botão direito no seu nome → *Copiar ID do usuário*);
- para entrar **sem** criar app no Discord: `DEV_LOGIN_ENABLED=true` (só funciona com `ENVIRONMENT=development`).

Teste: <http://localhost:8000/health>; documentação interativa em <http://localhost:8000/docs> (só em desenvolvimento).

**Conteúdo inicial:** o script de seed antigo foi removido. Para ter o conteúdo de verdade, restaure um backup (`restaurar_backup.py`) ou use o banco do dono.

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
python scripts/verificar_readme.py          # README x código (variáveis, permissões, comandos do bot, migrações, telas); --corrigir regera a tabela de permissões
python scripts/testar_permissoes.py        # 803 verificações de segurança/permissões/traduções/erros/blog (precisa do banco no ar)
python scripts/testar_bot_integracao.py    # 145 verificações do bot + log + erros (precisa do banco no ar)
cd ../NinWiki.Web && npm run typecheck && npm run lint && npm run build
pip-audit -r requirements.txt && npm audit # vulnerabilidades conhecidas nas bibliotecas (pip install pip-audit)
```
> Se o Python reclamar de `No module named app` ao rodar um script, rode com `PYTHONPATH=.`
> (Linux/Mac) ou `$env:PYTHONPATH="."` (PowerShell).

### 1.5 Testar uma branch na sua máquina antes de ir para produção
O deploy sai da `main`. Para testar o que está numa branch (ex.: `claude/sweet-edison-d5di2d`) **sem mexer na `main`**:
```bash
git fetch origin claude/sweet-edison-d5di2d          # baixa SÓ essa branch
git switch claude/sweet-edison-d5di2d                # 1ª vez: cria a branch local ligada à remota
git pull origin claude/sweet-edison-d5di2d           # nas próximas vezes: só atualiza
```
Depois de trocar de branch, atualize o que mudou (rode só o que se aplica):
```bash
cd NinWiki.Api && pip install -r requirements.txt && alembic upgrade head   # bibliotecas novas + migrations novas
cd ../NinWiki.Web && npm install                                            # pacotes novos do site
cd ../NinWiki.Bot && pip install -r requirements.txt                        # (se mexeu no bot)
```
Seus `.env`, `certs/` e `uploads/` **não são do Git**: ficam como estão ao trocar de branch. Se o Git reclamar de alterações locais,
guarde-as com `git stash` antes do `switch` (e `git stash pop` depois). Para voltar: `git switch main`.
Quando estiver tudo certo, faça o merge da branch na `main` (pull request no GitHub) e rode os workflows de deploy (seção 3.7).
> Só quer baixar essa branch numa pasta nova? `git clone --branch claude/sweet-edison-d5di2d --single-branch <URL-do-repositório>`.

---

## 2. Como usar

### 2.1 Painel (`/admin`)
- **Cargos:** `S.Adm` (dono, tudo) > `Adm` > `Creator`. Quem está em `SUPER_ADMIN_DISCORD_IDS` vira S.Adm no primeiro login e
  não pode ser rebaixado. **Equipe** e **Permissões** são **só do S.Adm**.
- **Entrar:** `/login` → "Entrar com Discord". Só entra quem foi cadastrado na equipe (ter Discord não basta).
- **Conteúdo / Blog / Jutsus / Masteries:** rascunho ou publicado, imagem (upload), histórico, tradução automática EN→PT
  (com `DEEPL_API_KEY`). O blog público fica em `/blog` e os 3 últimos posts aparecem na Home. Visual estilo Steam: lista em cards grandes (o post mais novo em destaque), post com capa larga no topo e índice "Neste post" fixo na lateral (no celular vai antes do texto).
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
  anexam arquivos (até 10 por aviso, `MAX_NOTICE_FILE_MB` MB cada, padrão **200 MB** — o envio é gravado aos pedaços, sem encher a memória; se o site estiver atrás da Cloudflare grátis, ela corta uploads acima de 100 MB; executáveis e HTML são recusados).
- **Remover da equipe:** em `/admin/staff` o botão **Remove** (só S.Adm, permissão `staff.delete`) tira a pessoa de vez — o acesso cai na hora, o histórico dela no log continua (com o nome) e os posts/avisos dela ficam sem autor. Continua valendo: não remove a si mesmo, nem um dono (`SUPER_ADMIN_DISCORD_IDS`), nem o último S.Adm. Para tirar o acesso só por um tempo, use **Deactivate**.
- **Nome (nick) da equipe:** em `/admin/staff` (só S.Adm) o lápis ao lado do nome edita o nome de qualquer um, **inclusive o seu**. O nome editado
  fica salvo: o login com o Discord não o sobrescreve mais.
- **Permissões** (`/admin/permissions`, só S.Adm): liga/desliga o que **Adm** e **Creator** podem fazer; vale na hora.
- **Tabela de permissões** (gerada do código, `app/core/permissions.py`; o S.Adm ajusta Adm/Creator em `/admin/permissions`; as *exclusivas* nem aparecem para os outros cargos; as `media.cat.*` liberam ver cada categoria do banco de imagens):

<!-- permissoes:inicio (gerado por NinWiki.Api/scripts/verificar_readme.py --corrigir; nao edite a mao) -->
| Permissão | O que libera | Quem tem por padrão |
|---|---|---|
| `content.create` | Criar conteúdo | Creator, Adm, S.Adm |
| `content.edit` | Editar conteúdo | Creator, Adm, S.Adm |
| `content.publish` | Publicar / despublicar conteúdo | Adm, S.Adm |
| `content.delete` | Apagar conteúdo | Adm, S.Adm |
| `content.import` | Importar conteúdo em massa | Adm, S.Adm |
| `content.bulk_type` |  | S.Adm (exclusiva) |
| `posts.create` | Criar posts | Creator, Adm, S.Adm |
| `posts.edit` | Editar posts | Creator, Adm, S.Adm |
| `posts.publish` | Publicar / despublicar posts | Adm, S.Adm |
| `posts.delete` | Apagar posts | Adm, S.Adm |
| `lore.edit` | Editar Masteries, Jutsus, Vilas e Organizações | Adm, S.Adm |
| `lore.delete` | Apagar Jutsus, Vilas e Organizações | Adm, S.Adm |
| `uploads.create` | Enviar imagens | Creator, Adm, S.Adm |
| `translation.retranslate` | Retraduzir conteúdo | Creator, Adm, S.Adm |
| `translation.import` | Importar as traduções oficiais do jogo | Adm, S.Adm |
| `media.upload` | Enviar imagens pelo banco de imagens (lote) | S.Adm |
| `media.closed` | Ver a categoria fechada do banco de imagens | S.Adm (exclusiva) |
| `media.reset_ids` | Renumerar os IDs do banco de imagens | S.Adm (exclusiva) |
| `media.categorize` | Mudar a categoria das imagens do banco de imagens | S.Adm |
| `media.manage` | Renomear/apagar imagens do banco de imagens | S.Adm |
| `staff.view` | Ver a equipe | S.Adm (exclusiva) |
| `staff.create` | Cadastrar equipe | S.Adm (exclusiva) |
| `staff.edit` | Trocar cargo | S.Adm (exclusiva) |
| `staff.deactivate` | Desativar / reativar equipe | S.Adm (exclusiva) |
| `staff.delete` | Remover alguém da equipe | S.Adm (exclusiva) |
| `notices.view` | Ver avisos e baixar arquivos | Creator, Adm, S.Adm |
| `notices.manage` | Postar, editar e apagar avisos | Adm, S.Adm |
| `announcement.manage` | Editar o anúncio da Home | Adm, S.Adm |
| `site.maintenance` | Ligar/desligar o modo manutenção do site | S.Adm (exclusiva) |
| `roles.manage` | Editar permissões dos cargos | S.Adm (exclusiva) |
| `comments.moderate` | Moderar comentários e banir leitores | Adm, S.Adm |
| `reports.manage` | Ver e tratar os reports dos visitantes | Adm, S.Adm |
| `volunteers.manage` | Ver, avaliar e apagar as inscrições de voluntários | Adm, S.Adm |
| `tournaments.manage` | Moderar torneios dos jogadores (esconder, corrigir texto, apagar) | Adm, S.Adm |
| `discord.links` | Ligar servidores e cargos do Discord à vila e ao rank do perfil dos jogadores | S.Adm (exclusiva) |
| `errors.view` | Ver erros e problemas do wiki | S.Adm (exclusiva) |
| `analytics.view` | Ver os acessos ao site | Adm, S.Adm |
| `audit.view` | Ver o log de conteúdo | Adm, S.Adm |
| `audit.view_all` | Ver o log completo (com IPs) | S.Adm (exclusiva) |
| `audit.clear` | Limpar o log | S.Adm (exclusiva) |
<!-- permissoes:fim -->

- **Cargos personalizados** (mesma tela, seção *Custom roles*): o S.Adm cria cargos como *Tradutor*, *Moderador* ou *Redator* — nome, **cor**, descrição e as permissões que quiser (até 25) — e dá o cargo em `/admin/staff` (aparece no seletor de cargo). Regras: ficam no nível do **Creator** (nunca gerenciam a equipe nem as permissões, nada exclusivo do S.Adm pode ser dado), a edição vale na hora para quem tem o cargo, e um cargo só é apagado quando ninguém o tem. Criar/editar/apagar vai para o log. Migration nova: `39ea91f5adab`.
- **Log geral:** `/admin/audit-log` (quem fez o quê; o IP só o S.Adm vê). O **S.Adm pode limpar o log** (tudo, ou só o mais antigo que 7/30 dias) para a
  equipe não ver o histórico antigo; a própria limpeza fica registrada como a primeira linha do log novo.
- **Barra de envio (upload):** todo envio de arquivo do painel (campo de imagem, imagem no editor do blog, **banco de imagens** — inclusive em lote — e anexos de avisos) mostra uma **barra com % e MB enviados** ("Enviando 2,3 / 4,8 MB · 48%"). Quando a barra enche e aparece "o servidor está processando…", o arquivo já saiu do seu computador e a espera é do servidor; se a barra anda devagar, a lentidão é a sua conexão (upload costuma ser bem mais lento que o download — GIF animado grande é o caso típico).
- **Seletor de emoji:** nos campos *Icon (emoji)* (conteúdo) e *Emblem* (vilas) há um botão 😀 ao lado do campo: abre uma janelinha com ~500 emojis em abas (Itens, Armas, Roupas, Comida, Natureza, Bichos, Fantasia, Pessoas, Símbolos, Lugares); um clique preenche o campo. Dá para continuar digitando/colando qualquer emoji.
- **Atributos (itens/armas):** no editor cada linha tem o **valor** com **setinhas** (cima = +1, baixo = −1; aparece `0`, `+2` ou `-1`, e dá para digitar à mão, ex.: `+5%`) e um **seletor** com os atributos do jogo — Fortitude, Chakra, Strength, Intellect e Agility. Atributos antigos com outro nome continuam aparecendo como opção extra.
- **Manutenção automática (memória e banco):** a cada 6 h (`MAINTENANCE_INTERVAL_HOURS`; 0 desliga) a API apaga o que ficou velho e inútil — esquece contadores vencidos do limitador de requisições/freio de erros/aviso de flood (memória), problemas já **resolvidos** há 30 dias (`ERROR_RETENTION_DAYS_RESOLVED`) e qualquer problema sem ocorrer há 90 (`ERROR_RETENTION_DAYS`), linhas do log geral com mais de 365 dias (`AUDIT_RETENTION_DAYS`; 0 = nunca), impressões digitais de visitantes (2 dias), contagens de acessos com mais de 400 dias e arquivos temporários de backup. **Não mexe** em conteúdo, imagens, usuários nem posts. O Web também limpa o seu contador por IP a cada minuto.
- **Jutsu / Attacks dos monstros:** cada ataque pode ser **ligado a um jutsu do catálogo** (campo de busca ao lado do nome — digite parte do nome e clique no resultado; o selo verde "Jutsu" desliga): o nome vem do jutsu (e acompanha renomeações, em inglês e português) e, na página do monstro, o selo vira **link para a página da skill**. Golpes que não existem como jutsu continuam como texto livre. (Exige `alembic upgrade head`: coluna `jutsu_id` em `content_item_attacks`.)
- **Requisitos da arma:** o campo *Requirement to use* aceita **até 3 requisitos** (botão *Adicionar requisito*, ex.: `60 Agility`, `20 Chakra`); na ficha aparecem **num só bloco "Stat Req."**, um embaixo do outro. Por baixo ficam num só campo, um por linha (até 100 caracteres cada).
- **Mobs não têm raridade:** o editor não mostra o campo *Rarity* para mobs (o banco guarda Common por baixo), e o site, os cards do bestiário e o bot não mostram raridade de mob. O tipo comum se chama **Monster**.
- **Páginas inexistentes dão 404 de verdade:** vila, mastery, jutsu e entry que não existem agora respondem HTTP 404 com a tela "Página não encontrada" (antes mostravam uma mensagem com status 200, que o Google guardaria como se a página existisse).
- **Não aponte o ambiente local para o banco da SquareCloud:** o que você salva ali aparece NA HORA no site que já está no ar (que ainda roda o código antigo); valores novos (raridade Unique, jutsu sem mastery…) podem derrubar a API antiga; e as imagens enviadas localmente ficam só no seu computador, mas o banco guarda o endereço `localhost` delas. Use um banco **local** (copie os dados com o backup e `scripts/restaurar_backup.py`), teste, faça o deploy (as migrações rodam sozinhas) e só então mexa no conteúdo pelo painel do site. Os scripts de teste **recusam** rodar contra um banco que não seja local.
- **Raridade Event:** além de Common, Uncommon, Rare, Epic, Legendary, Unique e Enchanted, existe **Event** (rosa), para itens de evento do jogo (exige `alembic upgrade head`).
- **Itens:** na lista de Itens do painel, o **S.Adm** (permissão exclusiva `content.bulk_type`; Adm e Creator nem veem o seletor e a API responde 404) pode marcar vários itens e usar **Mudar o tipo do item...** + **Aplicar tipo** para trocar o *Item type* de todos de uma vez (pede confirmação; só vale para entries da categoria Itens, as outras são ignoradas; fica no log como `bulk-item-type`). No editor, o campo **Item type** tem Geral, **Gear** (antigo Wardrobe), **Ring**, Consumível, Moeda, Cast, Authority, **Pack**, **Tools / Pills** (ferramentas e pílulas), **Scrolls / Manuals** (pergaminhos e manuais; migração `2e6a34cbe1d4`), **Recipes**, **Furniture**, **Food**, **Trophies** e **Others** (migração `b10e73ac8a7c`). Cada tipo tem o seu **grupo e o seu botão de filtro** no catálogo de Itens (a ordem: Consumables, Food, Materials, Gear, Rings, Tools / Pills, Scrolls / Manuals, Recipes, Furniture, Trophies, Packs, Special Items, Others; os botões saem da lista de categorias do código, então categoria nova entra sozinha) e os nomes ficam no **plural**. Os itens existentes continuam como estão: mude o tipo de cada um no editor ou de vários de uma vez (S.Adm); ao escolher **Gear** aparece um 2º seletor com a peça — **Accessory, Shirt, Vest, Pant, Hat, Mask e Shoe** (o tipo gravado é a própria peça). O **Ring** tem categoria própria: opção direta no editor e filtro **Rings** no catálogo (o guarda-roupa tem o filtro **Wardrobe**). Todo equipamento (ring, acessório e roupas) mostra nível. **Pack** tem seu próprio filtro no catálogo de itens, Consumível, Moeda, Cast e **Authority** (itens de Autoridade do clã) — o tipo *Material* saiu da lista (só aparece em itens antigos que já o têm) e itens de **Moeda** ficam no filtro **Materials** do catálogo; raridades Common, Uncommon, Rare, Epic, Legendary, **Unique** (vermelha), **Enchanted**, **Premium** (laranja) e **Organization** (indigo; exige `alembic upgrade head`, migration `b4d6f8a0c1e3`). **Nível 0 = item/arma sem nível**: nada de "Level" aparece no site. O **Max Stack** ("Can hold max 500 per Stack") vale para Moeda, Authority, Consumível, Material e **Pack**. A página do item mostra a imagem grande sobre um brilho **na cor da raridade**, selos (tipo, raridade, nível) e uma ficha lateral com Detalhes/Atributos; os cards das listas têm brilho e selo de raridade. (Novos valores de raridade/tipo exigem `alembic upgrade head`, que o Deploy API já faz.)
- **Jutsu NPC:** no editor do jutsu, a caixa **Jutsu NPC** marca a versão do jutsu ensinada/usada por NPC (mesmo nome do jutsu de mastery ou de Utilidade — crie como um jutsu à parte). Ele **não tem nível, tier nem ficha de jogador**: ao marcar a caixa o editor esconde esses campos (e a *Short description*) e mostra só **nome, ID, Mastery, ícone, Cooldown, Cast Type, imagem/GIF e descrição completa**; a página pública mostra nome, ícone, imagem, descrição e uma seção com Cooldown e Cast Type. Esses jutsus **não aparecem em Masteries** (nem nas páginas das masteries, nem como card): só quem clica no **link direto** do jutsu (ex.: o ataque ligado em um monstro) ou abre `/masteries/npc`. Exige `alembic upgrade head`.
- **Jutsus de Utilidade (categoria Utility):** no editor do jutsu, o campo *Mastery* tem a opção **Utility (sem mastery — qualquer pessoa pode usar)**: o jutsu fica sem mastery e sem caminho. Utility **não é mastery**: na lista pública de masteries aparece uma seção própria **Técnicas Utilitárias** (só se houver pelo menos um jutsu assim) que leva para `/utility` (`/masteries/utility` redireciona para lá), com a lista desses jutsus; no painel há o filtro *Utility*. Não existe uma mastery "Utility" no banco: é um jutsu com `mastery_id` vazio (exige `alembic upgrade head`).
- **Jutsus:** a página mostra a ficha em seções que abrem e fecham (Requisitos, Aquisição, Detalhes da técnica, Dados de batalha). No editor você preenche
  nível/atributo exigido, tipo de pergaminho + tier (**1 a 5**), nível máximo com **nome (opcional), dano e recarga por nível** (o nome por nível serve para jutsus que **mudam de nome** ao subir, ex.: no nível 4 — deixe vazio nos níveis em que o nome não muda; a **DeepL traduz o nome por nível** ao salvar — troque o nome em inglês e ele é retraduzido; sem mexer, a tradução é mantida; o botão *Retraduzir* também a refaz; a ficha mostra, dentro das listas de dano e recarga, uma linha-divisória **"A partir do nível 4: Great Fireball"** antes do nível em que o nome muda), tipo de conjuração, debuff e armas permitidas (os campos *Classe* e *Loja* saíram do formulário e da ficha; o ícone agora é um **dropdown** com prévia dos ícones disponíveis);
  linha vazia some da página.
- **Textos de ajuda nos formulários:** abaixo dos campos de texto de jutsu, conteúdo, vila e mastery há uma linha cinza explicando o campo (com exemplo). Os textos ficam em `NinWiki.Web/lib/field-hints.ts` (uma linha por campo, em inglês e português; campo sem entrada ali fica sem ajuda).
- **Banner do post do blog:** aparece **inteiro**, no tamanho real da arte (até 960 px) e centralizado, com a mesma arte desfocada preenchendo as laterais; a arte padrão (`public/images/blog/steam-banner.webp`) tem 960×311 px — para ficar mais nítida em telas grandes, troque por uma versão de 1920 px ou mais na mesma proporção.
- **Usando o Claude Code no VS Code:** o arquivo `CLAUDE.md` na raiz é lido automaticamente e traz as regras do projeto (idioma, comentários, testes, não mexer no banco de produção, README sempre em dia). Antes de encerrar qualquer mudança, rode `py scripts/verificar_readme.py` na pasta `NinWiki.Api`: ele confere variáveis, permissões, comandos do bot, migrações e telas citados aqui contra o código e também roda no GitHub (aba *Actions*) e dentro de `verificar_projeto.py`.
- **Telas do painel:** `/admin` (Visão Geral), `/admin/content` (conteúdo: itens, mobs, armas, missões, guias), `/admin/masteries`, `/admin/jutsus`, `/admin/import` (importar JSON e nomes novos do jogo), `/admin/translations`, `/admin/media`, `/admin/blog-posts`, `/admin/comments`, `/admin/reports`, `/admin/announcement`, `/admin/villages`, `/admin/organizations`, `/admin/staff`, `/admin/permissions`, `/admin/audit-log`, `/admin/errors` (cada uma só aparece para quem tem a permissão — veja a tabela acima).
- **Temas de cor do site (botão da paleta no topo):** **Canarinho** (o **Canary**, verde; é o **padrão**), Laranja (a cor do logo original do jogo), Sangue, Ouro e Anil. Quem já escolheu um tema continua com o dele; quem nunca escolheu vê o Canary. O tema fica no navegador (`localStorage`). Cores em `app/globals.css` (`data-color-theme`), a marca do **Nin Codex** é um **livro único** (`public/images/logo/nin-codex-livro.svg`/`.png`) com o emblema do jogo na capa; o logo temático de 5 variantes foi removido. O favicon e os ícones (`app/favicon.ico`, `icon.png`, `apple-icon.png`) usam só o emblema, e a imagem de compartilhamento é `og-nin-codex.png`. Tudo sai de `py scripts/gerar_logo.py` (pasta `NinWiki.Api`; idempotente).
- **Seleção em massa por clique:** nas tabelas do painel (Conteúdo e Jutsus) e na grade do **banco de imagens**, clicar em **qualquer ponto** da linha/cartão marca ou desmarca (não precisa acertar a caixinha); **Shift+clique** marca o intervalo desde o último clique. Links, botões, campos e a própria caixinha continuam com a função deles. No banco de imagens só vale para quem tem `media.manage`. No banco de imagens a **barra de seleção** (Selecionar tudo, N marcadas, Aplicar categoria, Apagar) fica **fixa no topo ao rolar** a página e traz também os **botões Anterior/Próxima** (os de baixo continuam), então dá para trocar de página e confirmar a ação sem subir ou descer.
- **Onde encontrar (mobs) em lista, como o "Found in" do Atlas:** no editor do mob, **Onde encontrar (lugares)** é uma lista — um lugar por linha, com **zona** (Safe, Danger, War, Arena, Parkour ou sem zona) e, se quiser, o nome em português. A ficha pública mostra cada lugar numa linha com um ponto na cor da zona e o nome da zona (verde = segura, laranja = perigo, vermelho = guerra). O texto livre antigo só vale quando a lista está vazia, e o botão **Transformar o texto antigo em lista** converte "A, B, C" em linhas. O bot (`/search`) usa a mesma lista. `python scripts/importar_locais_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; sem `--aplicar` é só simulação) preenche a lista dos monstros a partir dos mapas do Nin Atlas, com o nome em português do arquivo oficial do jogo; **só preenche mob que ainda não tem lista** e nunca troca uma que você montou. Migration nova: `c5e7a9b1d4f6` (rode o **Deploy API** antes do Web).
- **NPC da arma com link:** no editor da arma, o campo **NPC (onde conseguir)** ganhou a busca de páginas (só mobs/NPCs): ligado, o nome **acompanha a página** do NPC (inclusive em português) e vira **link** na ficha da arma — o link só aparece se a página do NPC está **publicada** (senão fica só o nome). O selo verde desliga o vínculo e volta ao texto livre. Esse campo é para o NPC que **vende ou entrega** a arma; quem **dropa** a arma aparece sozinho em "Dropado por". Mesma migration `c5e7a9b1d4f6` (coluna `weapon_npc_id`).
- **"Vendido em" (lojas de NPC) nos itens e armas:** a ficha de item/arma mostra **em que loja de NPC ele é vendido**, onde a loja fica e **quanto custa** (o preço que o **jogador paga**; a moeda é o nome de um item — Ryo, Halloween Token, Sealable Scroll...; "por N" quando vem mais de uma unidade). No editor há o cartão **Vendido por NPCs (lojas)**: loja, preço, quantidade e moeda (os lugares vêm da importação). `python scripts/importar_vendas_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; sem `--aplicar` é só simulação) traz as 112 lojas do Nin Atlas para as páginas de mesmo nome e **só preenche página que ainda não tem lista**. ⚠️ O valor que o NPC **paga** quando o jogador **vende** um item não existe no Atlas nem no cliente do jogo, então não é importado. Migration nova: `d6f8b0c2e5a7` (rode o **Deploy API** antes do Web).
- **Filtro de rascunhos no Conteúdo:** na lista do painel há os botões **Todos / Publicado / Rascunho** para ver só os itens em rascunho.
- **Proficiências (seção própria) e Guia reformulado:** a seção **Proficiências** (`/proficiencies`, acessada pelo **Guia**; não fica no menu do topo): as regras gerais (nível máximo 500, +1% de bônus a cada 10 níveis, chance final = base × (1 + bônus), XP para passar do nível L = 128·L − 64), uma **calculadora de XP** e os cards das 11 proficiências — coleta (Pesca, Forrageamento, Mineração, Corte de Madeira) e criação (Forja, Culinária, Tecelagem, Carpintaria, Transmutação, Fuinjutsu, Engenharia). Cada uma abre `/proficiencies/<id>` com descrição, dicas, **o que se coleta e o que cai**, **todas as receitas** (com **busca**, ingredientes com imagem, nível, bancada e o item que ensina a receita) e **ferramentas com preço** (varas de pesca). **Visual em abas** (Visão geral, Recursos, Receitas, Ferramentas — só as que têm dados): as receitas têm busca e filtros (nível, bancada, aprendida com item ou conhecida de início) com miniatura e link do item; cada recurso mostra **onde coletar** (áreas do mapa, link `/map#map/<id>`, lido de `public/game-maps/areas-info.json`); os cartões do índice mostram a faixa de nível das receitas. O Atlas não traz tempo nem XP de receita, então não são exibidos. Itens viram link quando a página existe e está publicada. Os valores gerais vêm do Nin Online Wiki (Fandom) e do Nin Atlas — o jogo pode mudá-los. `python scripts/importar_profissoes_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; simulação por padrão, `--aplicar` grava, só preenche profissão sem detalhes, `--forcar` refaz) traz isso do Atlas, **cria as 6 profissões de criação que faltavam** e corrige as descrições em inglês das 5 antigas. No painel, **Proficiências** (`/admin/professions`) edita nome, tipo, emoji e descrição em inglês/português (receitas, recursos e ferramentas não são editados ali: vêm do script). Migration: `e7a9c1d3f6b8` (coluna `professions.details`).
- **Jutsus em rascunho + todos os jutsus do jogo criados:** o jutsu agora tem **situação** (Publicado/Rascunho): o editor termina com os botões **Salvar rascunho** e **Publicar** (como o editor de conteúdo), e a lista do painel mostra a situação, com filtro. Rascunho **só a equipe vê** — some do site, da busca do bot, das denúncias e do mapa do site (a ficha responde 404 para o visitante). Os jutsus já existentes continuam publicados. `python scripts/criar_jutsus_do_jogo.py` (simulação por padrão; `--aplicar` grava) cria **como rascunho** os jutsus da lista do jogo que ainda não têm página (627: 507 de jogador e 120 de NPC com "(NPC)"), só com **nome em inglês e em português**, sem mastery/descrição — o jogo não liga descrição a jutsu, o resto é preenchido no painel. A lista do jogo mistura alguns nomes que não são jutsu (poções, montarias, abóboras...): apague ou ajuste no painel. Salvar rascunho aceita a ficha incompleta; para publicar a descrição é obrigatória. Migration nova: `f8b0c2e4a6d9` (rode o **Deploy API** antes do Web).
- **Jutsus preenchidos com os dados do Fandom (`importar_jutsus_fandom.py`):** os rascunhos criados a partir do cliente do jogo vinham só com o nome. O script (na pasta `NinWiki.Api`: `python scripts/importar_jutsus_fandom.py`, simulação por padrão) lê a ficha `{{Jutsu}}` e o texto das páginas das categorias Techniques/Jutsu/Advanced Jutsu do Nin Online Wiki e **só preenche campo vazio** (maestria, tier e tipo de pergaminho, nível e atributo exigidos, loja, nível máximo, tempo e tipo de conjuração, classe, alcance, efeitos, custo de chakra, recarga e dano por nível, descrição em inglês). Jutsus de NPC (`-npc`) são ignorados e jutsu sem página no Fandom continua como estava. `--aplicar` grava e `--publicar-completos` publica os que ficaram com maestria, tier, descrição, dano ou chakra e tempo de conjuração. Só roda em banco local (`--permitir-remoto` para o de produção, com backup). Os valores são da comunidade e mudam a cada atualização do jogo: revise no painel; a tradução PT não vem do script.
- **Jutsus completados com o Nin Atlas (`importar_jutsus_atlas.py`):** na pasta `NinWiki.Api`, `python scripts/importar_jutsus_atlas.py` (simulação por padrão) cruza os pergaminhos "Manual" do Nin Atlas (nível e atributo exigidos, texto), os nomes do cliente do jogo e as fichas do Fandom. **Só preenche campo vazio**, nunca mexe em jutsu NPC nem em buffs/montarias/GM, cria como rascunho o jutsu que o jogo tem e o wiki não, deduz a mastery pelo texto do pergaminho (sem mastery citada = Utility) e `--aplicar --publicar-completos` publica só os completos: descrição, tempo de conjuração, dano ou chakra, mastery (ou Utility) e tier conhecido. O Atlas não traz dano/tempo/tier (isso só vem do Fandom); `--permitir-remoto` para produção, com backup. A tradução PT fica para o botão do painel.
- **Classificação dos jutsus e área Utility (`classificar_jutsus.py`):** as masteries com caminhos (medical, taijutsu, water, weapon, wind) só listavam jutsu cujo `path_id` batesse com um caminho, e a maioria dos importados não tinha caminho; por isso pareciam vazias. Na pasta `NinWiki.Api`, `python scripts/classificar_jutsus.py` (simulação por padrão) dá o caminho pelo atributo exigido, atribui mastery pela tabela do script (cada linha com a evidência: Fandom, pergaminho Manual do Atlas ou posts da Steam), preenche a ficha das invocações animais e, com `--aplicar --publicar`, publica só os jutsus com evidência e descrição, mesmo com ficha parcial (dano/custo/cast vazios não são inventados). O que só tem o nome como indício continua rascunho e sai no relatório como INCERTO. Ordem: `classificar_jutsus.py --aplicar`, `importar_jutsus_atlas.py --aplicar`, `classificar_jutsus.py --aplicar --publicar`. No site, jutsu sem caminho aparece em "Outros jutsus da mastery", a ficha esconde tier/CP/nível máximo quando são só o padrão do rascunho, e **Utility não é mais mastery**: fica na área própria `/utility` ("Técnicas Utilitárias", linkada abaixo das masteries); `/masteries/utility` redireciona para ela.
- **Guia com artigos próprios (Artigos do Guia):** o **Guia** (`/catalog/guides`) deixou de ter atalhos para Vilas, Mapa, Maestrias, Jutsus, Itens, Armas e Monstros (essas áreas têm página própria) e a aba Ranks. Agora ele mostra **artigos** por seção — **Comece por aqui, Combate e PvP, Progressão, Controles e interface, Dinheiro** —, um bloco **Sistemas do jogo** (Proficiências; as Missões saíram do Guia, veja abaixo) e, em "Mais em Guias", as abas Atributos, Story Arcs e Summons. Cada artigo abre em `/guide/<id>` (texto rico em inglês e português, ícone, resumo no card, entra no sitemap). **No painel:** `/admin/guides` (menu Wiki > Artigos do Guia) lista com filtro Rascunho/Publicado e o editor tem seção, posição, ícone, situação, título, resumo e texto rico nos dois idiomas (o que ficar vazio em português a DeepL traduz ao salvar). Usa as permissões de Lore (`lore.edit` para criar/editar, `lore.delete` para apagar); rascunho só a equipe vê (visitante recebe 404). `python scripts/criar_guias_do_fandom.py` (simulação por padrão; `--aplicar` grava; `--publicar` cria já publicados) cria **17 artigos como rascunho** — Comece por aqui, Atualizações diárias, Zonas e PvP, Sistema de Crimes, Recompensas, Ninja Desertor, Desmaio, Ferimentos de Batalha, Equipes, Níveis, Atributos, Carregar Chakra, Espaços de Jutsu, Títulos, Controles, Comandos de chat e Como ganhar Ryo —, reescritos com palavras próprias a partir das páginas do Nin Online Wiki (Fandom), só com os fatos estáveis; **revise e publique no painel**. Migration nova: `a1d3f5b7c9e2` (tabela `guide_articles`; rode o **Deploy API** antes do Web).
- **Missões como seção própria e Guia mais completo:** as **Missões** saíram do Guia e têm página própria: lista em `/missions` (busca por nome/NPC; filtros por tipo — Diária, Repetível, História, Secundária —, região, faixa de nível e rank; cartões) e detalhe em `/missions/<id>` (pedido do jogo, quem dá e onde, requisitos, objetivos numerados, recompensas, observações; nomes de itens/mobs/armas **publicados** viram miniatura + link). `/catalog/missions` redireciona (308) para `/missions`; o cartão da Home e o sitemap apontam para lá. **De onde vêm os dados:** a tabela de conteúdo não tem campos de missão (objetivos, recompensas, tipo, rank), então a ficha mora no json estático `NinWiki.Web/data/missions.json`, gerado por `python scripts/importar_missoes_fandom.py` (pasta `NinWiki.Api`, python do venv; **só lê o Nin Online Wiki do Fandom, não mexe no banco**; rode de novo quando a comunidade atualizar): **154 missões** (90 com objetivos, 122 com o nome confirmado nos textos do cliente do jogo — selo verde na página; as sem objetivo/recompensa mostram "ficha parcial"). Valores da comunidade (CC-BY-SA), com aviso e link da fonte na página. As **658 entradas de missão em rascunho** no banco (só o nome, vindas do cliente) continuam em `/admin/content/missions`, sem uso público; para editar missões pelo painel seria preciso uma **tabela nova (migração)**. **Guia:** o índice (`/catalog/guides`) ganhou busca, **Comece por aqui** (passos numerados), cartões por assunto com contagem e atalho, listas por assunto e Proficiências; cada artigo (`/guide/<id>`) ganhou **breadcrumbs com o assunto**, tempo de leitura, **sumário lateral** (a partir dos títulos H2/H3; some em artigo sem títulos), **anterior/próximo** dentro do assunto e **guias relacionados**. **Páginas de assunto:** cada assunto do Guia tem página própria em `/guide/topics/<slug>` (`start-here`, `combat`, `progression`, `interface`, `economy`; slugs em `lib/guide-topics.ts`), com ícone, descrição, contagem, breadcrumb, todos os guias do assunto e atalhos para os outros assuntos; assunto sem guia publicado dá 404. Os cartões "Explorar por assunto" do índice levam a essas páginas (o índice **não repete** a lista de guias de cada assunto: ela fica só na página do assunto); entram no sitemap. `python scripts/criar_guias_do_jogo.py` (simulação por padrão; `--aplicar` grava; `--publicar` cria já publicados) cria **17 artigos como rascunho**, em inglês, a partir do **livro de guias do próprio cliente do jogo** (`data files/guide/*.json`): Bem-vindo, Academia, Vilas, Mesa de missões, Diário de missões, Amigos e Ignorar, Fama, Regeneração de vida, Maestrias, Ranks ninja, Ranks de jutsu, Summons, Profissões, Clãs, Exames Chunin, Cupons de evento e Gold/Silver Ninja — o texto é o do jogo, reformatado, com a fonte no fim; a tradução PT sai pelo botão de tradução do painel. **Revise e publique em `/admin/guides`.** Sem migração nova.
- **Conferência com o cliente do jogo:** `py scripts/importar_missoes_fandom.py --so-verificar` (pasta `NinWiki.Api`; sem internet) compara cada missão de `missions.json` com os textos do cliente (`English.json`) e grava `clientStatus` (confirmed/partial/divergent/fandom-only), `clientName` e `clientNote`; missão `fandom-only` ou `divergent` ganha selo âmbar na ficha. O cliente só tem **nomes e textos** (nível, rank, EXP e recompensas vêm só do Fandom). `py scripts/verificar_com_cliente.py` (simulação; `--aplicar` grava só no banco local) corrige nome com erro de digitação e `name_pt` vazio/igual ao inglês de jutsus, itens, armas e mobs publicados com a tradução do jogo.
- **Menu do painel "Conteúdo" e favicon:** o grupo **Wiki** do menu lateral agora se chama **Conteúdo** e, em vez de uma página só com botões de categoria, cada categoria tem a sua própria entrada — **Monstros, Itens, Armas e Missões** (`/admin/content/mobs`, `/items`, `/weapons`, `/missions`; `/admin/content/guides` também existe) —, como já era com Artigos do Guia. Cada página tem busca, filtro Rascunho/Publicado e ações em massa; "Nova entrada" já abre o editor com aquela categoria e, ao salvar, volta para a lista dela (`/admin/content` continua listando tudo). O ícone da aba do navegador (`NinWiki.Web/app/favicon.ico`) é o favicon do Nin Online Wiki (Fandom) — a espiral laranja (`Site-favicon.ico` deles), em 16, 24, 32, 48 e 64 px.
- **Modo manutenção do site e permissão de categoria de imagem:** o **S.Adm** liga/desliga a manutenção em **Painel > Sistema > Manutenção** (`/admin/maintenance`; os outros cargos nem veem o item e a API responde 404). Ligada, qualquer página do site mostra a **página de manutenção** — tela cheia **animada, sem menu, rodapé nem links** (só o botão de login da equipe e as opções de idioma/tema), status 503, mensagem opcional em inglês/português — para quem não é da equipe; `/login`, `/admin` e a própria página continuam abertos. **A equipe sai da manutenção pelo login:** na página há o botão **Entrar (equipe)**; depois de logada, a página troca a sessão por um **passe de 12 horas** (`POST /site/pass`, cookie `ninwiki_pass` gravado em `/maintenance-pass`) e o site abre normalmente — o painel nunca fecha para a equipe. **Sair da conta (ou a sessão expirar) apaga o passe** (`DELETE /maintenance-pass`), e o site volta a mostrar a manutenção; se você tinha entrado antes dessa correção, o passe antigo dura até 12 h (apague o cookie `ninwiki_pass` ou use janela anônima). O `proxy.ts` confere o passe na API (cache de 30 s) e, se a API não responder, deixa o site aberto. **Limite honesto:** a manutenção esconde as *páginas*; os dados públicos da API continuam legíveis de propósito. Migration nova: `b2e4a6c8d0f1` (tabela `site_maintenance`; rode o **Deploy API** antes do Web). Permissão nova **`site.maintenance`** (exclusiva do S.Adm) e **`media.categorize`**: deixa um cargo **só mudar a categoria das imagens** (uma, em lote ou ao enviar), sem renomear nem apagar; libere em `/admin/permissions` (padrão: só S.Adm; `media.manage` continua valendo para tudo).
- **Segurança reforçada (CSP com nonce e 2FA obrigatório):** (1) a **Content-Security-Policy** do site não usa mais `'unsafe-inline'` em scripts: o `proxy.ts` gera um **nonce novo a cada página** (`lib/csp.ts`), o Next.js e o tema escuro/claro levam esse nonce e nenhum `<script>` injetado sem ele roda. Efeito colateral: todas as páginas passam a ser geradas a cada pedido (já eram quase todas). (2) **2FA obrigatório para entrar no painel:** o Discord informa no perfil se a conta tem a verificação em duas etapas ligada e a API **recusa o login da equipe sem 2FA** (aviso na tela de login) — não guardamos segredo nenhum. Vale para toda a equipe, inclusive os donos, só no login real com Discord (o login de desenvolvimento local não passa por isso). **Antes de subir em produção, ative o 2FA na SUA conta do Discord** (Configurações > Minha conta); para desligar, `REQUIRE_DISCORD_2FA=false` no `.env` da API e reinicie.
- **Nível desconhecido ("???"):** no editor de conteúdo, ao lado do campo **Nível** há a caixa **"Nível desconhecido (o site mostra ???)"** (mobs, armas, missões e os itens que mostram nível). Marcada, o número é ignorado (fica 0) e o site mostra **`???`** no card, na ficha, na barra lateral, na comparação e na resposta do bot; no catálogo esses itens ficam num grupo próprio **"Levels ???"**, no fim da lista. Desmarcar volta a usar o número. Campo novo `content_items.level_unknown` (padrão falso, nada existente muda). Migration nova: `c3f5a7b9d1e4` (rode o **Deploy API** antes do Web). O nível dos **jutsus** (`requiredLevel`) já é texto livre: dá para escrever `???` direto.
- **Nomes do jogo que ainda não têm página:** o cliente guarda nomes em `locales/English.json` (`ItemKeys`, `NpcNameKeys`, `JutsuKeys`...) **sem IDs, descrições pareadas nem preços**. Para ver o que falta no wiki, use **/admin/import → nomes novos do arquivo do jogo** (cria rascunhos com o nome oficial em português).
- **Navegação:** Menu lateral agrupado em seções recolhíveis — Wiki, Comunidade, Mundo, Sistema — e cabeçalho com breadcrumb + "Ver site", no estilo do CoreUI.
- **Onde encontrar com link para o mapa:** na ficha do mob, cada lugar da lista vira link para `/map#map/<id da área>` (o mapa abre já focado e com o painel da área). O nome do lugar (EN ou PT, sem diferenciar maiúsculas, acentos e pontuação) é casado com os nomes de `public/game-maps/areas-info.json` (`components/map/area-lookup.ts`, carregado só quando a ficha do mob abre). Lugar sem área correspondente fica só texto; o cartão do bestiário continua sendo um único link para a ficha.
- **"Feito por craft" (automático):** a ficha de um item/arma que é **resultado de uma receita** das proficiências mostra o bloco **Crafted / Feito por craft** (martelo): profissão (link para `/proficiencies/<id>#recipe-<slug>`, que abre a aba Receitas, rola até a receita e a destaca), nível, se precisa de bancada e os ingredientes com quantidade. Nada é cadastrado à mão: a API lê `Profession.details.recipes` (casando `result.slug` com o slug do item) em `GET /content-items/{id}` e `/slug/{slug}`, campo `craftedBy` (somente leitura, sem migration). O catálogo não mostra o selo (exigiria o dado extra em cada cartão da listagem).
- **"Dropado por" (automático):** a ficha de um item/arma lista sozinha os mobs publicados que o dropam — vale o drop ligado ao item na página do mob e também o drop digitado com o mesmo nome do item. Nada é cadastrado à mão no item (a API calcula em `GET /content-items/{id}` e `/slug/{slug}`, campo `droppedBy`).
- **Reports dos visitantes:** toda página de conteúdo, jutsu e mastery tem o botão **Reportar** (sem login): o visitante escolhe *Informação desatualizada*, *Erro de tradução* ou *Outro* e descreve o problema. A equipe trata em **/admin/reports** (menu Comunidade; permissão `reports.manage`, padrão: Adm e S.Adm — o S.Adm pode liberar para o Creator em /admin/permissions): filtra por status/tipo, abre a página citada e marca como resolvido, descartado, reabre ou apaga (tudo vai para o log de auditoria). Defesas: só aceita a origem do site, limite de 3 por minuto e 20 por dia por IP, campo-isca anti-robô, texto simples de 10 a 1000 caracteres com no máximo 1 link, página conferida no banco (não aceita rascunho nem página inexistente), teto de 200 por hora no site todo e sem duplicados. O IP fica guardado só para barrar abuso e nunca aparece no painel. Reports resolvidos/descartados somem sozinhos depois de 60 dias (manutenção automática); os abertos nunca. **Requer a migração `d9c1e3f5a768` (Deploy API).**
- **Aviso de report no Discord:** quando chega um report novo, o bot posta um aviso azul no canal de erros (`ERROR_CHANNEL_ID`) com o tipo, a mensagem e o link da página; na primeira vez ele começa "a partir de agora" (não despeja o histórico). A API expõe isso em `GET /bot/reports` (só com o token do bot, sem IP).
- **Formulário de voluntários:** página pública **`/volunteer`** (fora do menu; sem login) onde a pessoa se inscreve como voluntária (só criação de conteúdo e edição): Discord, nick no jogo, idiomas, áreas de interesse (Tradução, Edição do wiki, Coleta de dados e prints, Mapas, Moderação, Outro), disponibilidade, motivação, e-mail opcional e **consentimento obrigatório** (com texto de privacidade: para que usamos, quem vê = só a equipe, como pedir exclusão = pelo Discord). A equipe avalia em **/admin/volunteers** (menu Comunidade; permissão `volunteers.manage`, padrão: Adm e S.Adm, **não** o Creator): lista paginada com filtro de status e busca, detalhe, status (Nova, Em avaliação, Aprovada, Recusada, Contatada), notas internas e apagar (direito de exclusão; o log guarda só o id). **Interruptor:** no topo de **/admin/volunteers** há o botão **Fechar/Abrir inscrições** (permissão `volunteers.manage`, grava no banco na tabela `volunteer_settings`, padrão **aberto**, registra no log). Fechado, a página `/volunteer` mostra "inscrições fechadas" e a API (`POST /volunteers/apply`) responde 403; `GET /volunteers/status` (público, só leitura) informa se está aberto. Para divulgar: em **/admin/announcement** ponha o link `/volunteer` (caminho do próprio site é aceito). Defesas do envio (`POST /volunteers/apply`): só a origem do site, limite de 5 por hora e 10 por dia por IP (em memória, **o IP não vai para o banco**), campo-isca anti-robô, tamanhos máximos e teto de 100 inscrições por dia no site todo. A tabela `volunteer_applications` entra no backup e na mescla da produção (`mesclar_producao.py`, produção vence); **não há apagamento automático**: apague pelo painel quando a avaliação acabar. **Requer as migrações `9d0f3bc1cc39` (cria a tabela) e `01a430b27ba0` (tira nome e experiência, cria o interruptor); o Deploy API roda `alembic upgrade head`; depois faça o Deploy Web.**
- **Torneios e perfis de jogadores (estilo Challonge, focado no Nin Online):** páginas públicas **`/tournaments`** (lista com filtro de estado, busca e "meus torneios"), **`/tournaments/new`** (criar), **`/tournaments/<id>`** (chave desenhada, fases em abas, inscritos, painel do organizador), **`/players/<id>`** (perfil público: nome no jogo, vila, rank, avatar/nome do Discord, histórico, vitórias/derrotas e troféus) e **`/profile`** (o leitor edita só o nome no jogo; vila e rank vêm do Discord, veja o item "Vila e rank do perfil" abaixo). **Quem organiza:** qualquer **leitor logado com o Discord** (o mesmo login de comentar no blog, cookie próprio, sem acesso ao painel) cria um torneio e vira o **organizador**: só ele edita, abre/fecha inscrição, cria fases, monta a chave, lança placar e encerra; visitante sem login só lê; outro leitor recebe 403 (404 em rascunho). **Equipe só modera:** permissão **`tournaments.manage`** (padrão: Adm e S.Adm) e tela **/admin/tournaments** (menu Comunidade): esconder/mostrar, corrigir o nome ou apagar (vai para o log). **Fases:** quantas o organizador quiser, cada uma com modo de equipe **1v1, 2v2, 3v3 ou personalizado (1 a 10)** e formato **eliminatória simples** (com folgas/bye quando o número não é potência de 2; as melhores sementes ganham a folga) ou **todos contra todos** (vitória 3 pts, empate 1; desempate por saldo, pontos marcados e semente). Eliminatória dupla **não** foi feita. Entre fases o organizador escolhe quem avança (o botão "Preencher com os sugeridos" pré-seleciona quem venceu ao menos uma partida, **ordenado pelo desempenho** — campeão primeiro, depois quem foi mais longe, empate pela semente anterior, e os integrantes de cada equipe juntos — porque essa ordem vira a semente da fase seguinte; no todos-contra-todos, a metade de cima da tabela) e monta as equipes a partir dos inscritos; a fase anterior precisa estar concluída. **Placar:** só o organizador lança (pontos dos dois lados e/ou o vencedor); o vencedor avança sozinho. **Correção:** trocar o vencedor de uma partida cuja seguinte já foi jogada é **recusado (409)**: corrija a seguinte primeiro; se a seguinte ainda não foi jogada, o novo vencedor a substitui sozinho. Dá para desfazer a chave (se só houve folgas) e reabrir fase/torneio. A **última fase** define o campeão e as colocações (eliminatória: campeão 1, finalista 2, semifinalistas 3, quartas 5...), que entram no histórico dos perfis (só torneios **públicos**, já iniciados e não escondidos contam). Participante "sem conta" (só nome) é adicionado pelo organizador; o leitor logado se inscreve sozinho enquanto as inscrições estão abertas, usando o nome do perfil. **Limites anti-abuso** (constantes no topo de `NinWiki.Api/app/api/tournaments.py`): 5 torneios criados por pessoa por dia, 10 ativos por pessoa, 256 inscritos por torneio, 8 fases, 120 escritas por minuto por leitor, textos em texto simples com tamanho máximo, e origem/CSRF conferida em toda escrita. O perfil guarda `game_name`, `village_id` e `ninja_rank_id` na tabela `readers`; o endereço público usa o UUID do leitor, **nunca o Discord ID**. Tabelas novas: `tournaments`, `tournament_entries`, `tournament_phases`, `tournament_competitors`, `tournament_team_members`, `tournament_matches`. A lógica das chaves está em `NinWiki.Api/app/core/brackets.py` e é testada em `scripts/testar_permissoes.py` (seções 38 e 38b). O bot do Discord **não** tem comandos de torneio. **Visibilidade pelo organizador:** na aba Gerenciar há o interruptor **Visível ao público / Oculto (só você vê)** (campo `organizerHidden`, `PATCH /tournaments/<id>`); o torneio **nasce oculto** (o formulário de criação tem a opção "Deixar visível para todos já") para dar tempo de arrumar fases e inscritos. Oculto: some da lista e da busca, o link dá **404** para visitante e outros leitores, não conta no perfil público dos jogadores; o organizador vê a página com a etiqueta **Oculto**, e a equipe com `tournaments.manage` continua vendo e moderando em /admin/tournaments. É independente de "escondido pela moderação" (`hidden`): se a equipe escondeu, o organizador **não** consegue mudar a visibilidade (403). Torneios que já existiam continuam visíveis. **Importar lista de inscritos:** em Gerenciar > Inscritos, o botão **Importar lista** abre uma caixa (cole um nome por linha, ou separados por vírgula/ponto e vírgula, ou linhas `nome;seed`; para **equipes** use `Nome da equipe: Jogador 1, Jogador 2` ou, **sem nome de equipe**, `Jogador 1 + Jogador 2` (também vale `&`): a equipe sem nome aparece com o **nome dos integrantes** ("Jogador 1 & Jogador 2"), em vez de "Team 1"; a equipe importada fica gravada (migração `08352b8f48eb`, colunas `team_name`/`team_group` nos inscritos) e o construtor da fase a sugere **pronta** quando o tamanho bate com o da fase, com um selo de equipe na lista de inscritos; no construtor, o campo do nome da equipe mostra os nomes dos integrantes enquanto estiver vazio; dá para soltar um .txt/.csv, lido só no navegador), mostra a prévia (quantos entram, duplicados sem diferenciar maiúsculas/acentos, nomes com mais de 60 caracteres ou inválidos, vazios ignorados) e envia para `POST /tournaments/<id>/entries/bulk` (só o organizador, mesma regra de estado de adicionar convidado, máx. 10 importações por minuto, teto de 256 inscritos, numa transação só; resposta `{added, skipped:[{name, reason}], tournament}`). **Requer as migrações `c7d358341cac` e `c3d7e91b5f20` (coluna `tournaments.organizer_hidden`); o Deploy API roda `alembic upgrade head`; depois faça o Deploy Web (o bot não precisa reiniciar).**
- **Histórico de versões (conteúdo):** cada edição de uma página de conteúdo guarda o estado de antes (as últimas 25 por página). Na tela de edição, a seção **Versões anteriores** lista e permite **Restaurar** (mesmas regras de permissão da edição; restaurar também entra no histórico, então dá para desfazer). **Requer a migração `e1d3f5a7b982` (Deploy API).**
- **Cartão de link (Discord/WhatsApp/Google):** páginas de conteúdo, jutsu e mastery agora têm título, resumo e imagem de compartilhamento (a imagem da própria página, ou o logo do wiki se não houver). Depende de `NEXT_PUBLIC_SITE_URL` estar certo no build do site.
- **"Atualizado em" e selo de tradução automática:** a página de conteúdo mostra a data da última edição; em português, se o texto veio da tradução automática (DeepL) e ninguém revisou, aparece o selo **Tradução automática** (some quando alguém corrige/escreve o português no painel). Conteúdo antigo fica sem selo (não dá para saber de onde veio o português). **Requer a migração `f2e4a6b8c093` (Deploy API).**
- **Comparar itens/armas:** o botão **Comparar** na página de item/arma abre `/compare?a=&b=`: dois seletores com busca e uma tabela lado a lado (tipo, raridade, nível, dados da arma, stack e atributos), com as linhas diferentes destacadas. O link da comparação pode ser compartilhado.
- **Traduções oficiais do jogo:** em **/admin/translations** (menu Wiki; permissão `translation.import`, padrão: Adm e S.Adm) você escolhe o arquivo `…Brazilian_Portuguese-all-….json` exportado do Nin Online (formato `nin-online-translation`: texto em inglês → tradução). O wiki procura nos seus registros (conteúdo, jutsus, masteries, vilas, clãs e organizações) os textos em inglês que existem no arquivo — **acerto exato**, sem diferenciar maiúsculas — e preenche o português (`_pt`) com o texto oficial: nome, descrição, descrição completa, lore, sinergia, local de spawn, lema, clima e nome por nível do jutsu. Primeiro o botão **Ver o que vai mudar** mostra contagem por tipo, exemplos antes/depois e os nomes sem tradução oficial (para conferir a grafia); só depois **Aplicar**. Por padrão só preenche o que está **vazio** (ou veio da tradução automática); o português escrito à mão é mantido, a menos que você marque *Trocar também o português que já existe*. Descrições (campo rico) só são trocadas quando o texto inteiro bate (ou todos os parágrafos), no mesmo formato do campo. Dá para rodar de novo a cada atualização do jogo (é idempotente). O arquivo em **English** não precisa ser importado (os textos à esquerda e à direita são iguais): a tela recusa arquivo de outro idioma. Fica no log de auditoria.
- **Nomes novos do arquivo do jogo (em /admin/import):** escolha o arquivo em **inglês** (e, junto, o de Brazilian Portuguese para trazer o nome oficial em português) e o wiki lista os textos que **parecem nomes** (curtos, sem pontuação de frase, sem rótulos de tela como "Click to hide") e que você **ainda não tem** — compara com o nome e o slug de todo o conteúdo (rascunho ou no ar) e com jutsus, masteries, vilas, clãs e organizações. Dá para filtrar, esconder o que parece jutsu (`…Technique`, `(NPC)`), marcar e escolher a categoria; os marcados viram **rascunhos** pelo mesmo import em massa, já com o nome oficial em português. **A lista é um palpite**: o arquivo do jogo não diz o que é item, mob, NPC, lugar ou texto de tela — confira antes de criar. Duplicados são pulados.
- **Cache nas leituras públicas (API):** `GET` de conteúdo, masteries, jutsus, vilas, organizações, guias, anúncio, tags e atributos, feitos por quem chega **sem cookie/token**, recebem `ETag` + `Cache-Control: public, max-age=5` (só 5 segundos, para uma página despublicada/corrigida sumir logo) e respondem **304** (sem corpo) quando nada mudou — inclusive com ETag "fraco" (`W/`) de proxy/CDN. Quem está logado na equipe sempre recebe a resposta fresca (com rascunhos) e nunca vai para o cache (`Vary: Cookie, Authorization, X-Bot-Token`); erros, respostas que definem cookie e rotas sensíveis nunca ficam em cache; as rotas são comparadas por segmento inteiro. **Limite:** o 304 economiza só o tráfego — a API ainda executa a rota (consulta ao banco) e conta no limite de uso; o site em si busca dados no servidor, então a diferença nele é pequena.
- **Bot — `/drop` e `/patchnotes`:** `/drop item` lista os mobs que dropam o item e a chance de cada um; `/patchnotes` mostra as 3 notícias mais recentes do blog; `/search` e `/drop` sugerem nomes enquanto você digita (autocompletar). Rotas novas só-leitura da API do bot: `/bot/suggest`, `/bot/drops`, `/bot/latest-posts`. **`/recipe item`** mostra como fazer o item (profissão, nível, bancada, receita de origem e ingredientes com quantidade e link; lê as receitas das profissões; rota `/bot/recipe`). Depois de subir: **Deploy API** e **reiniciar o bot** (o comando novo é registrado ao ligar).
- **Vila e rank do perfil automáticos pelo Discord (bot):** a vila e o rank ninja do jogador **não se editam mais à mão** (`/profile` mostra os dois só para leitura, com a origem: *"definido pelo seu cargo no servidor X"* ou *"padrão"*; `PUT /players/me` aceita só `gameName` e recusa `villageId`/`ninjaRankId` com 422). Quem preenche é o **bot**, que só informa **fatos** (servidores onde está, cargos de cada servidor e os cargos dos **leitores cadastrados**); a **API decide** (`app/core/discord_profile.py`). Rotas do bot (token, limite de 300 chamadas/min): `GET /bot/reader-ids` (Discord IDs dos leitores, paginado), `POST /bot/guilds-sync` (servidores + cargos) e `POST /bot/member-roles` (cargos dos leitores num servidor, até 500 por chamada; `present:false` = saiu). **Configuração no painel:** permissão **`discord.links`** (padrão: Adm e S.Adm), tela **`/admin/discord-links`** (menu Comunidade): por servidor, a **vila** do servidor e, por cargo, o **rank** (cargo sem mapeamento vale pelo **nome igual ao do rank**, sem diferenciar maiúsculas: `Chunin`, `Genin`...). **Regras:** (1) em cada servidor vale o **maior** rank entre os cargos do jogador; (2) só a vila mapeada e nenhum cargo de rank = vila do servidor + o **menor** rank da hierarquia (Academy Student); servidor sem vila e sem cargo de rank = sem informação; (3) **vários servidores:** vale o servidor onde o jogador tem o **MAIOR rank** (Genin < Chunin < Jonin Special < Jonin < Conselho < Kami), e a **vila é a daquele servidor** (quem está nos servidores das 3 vilas fica com a do rank mais alto); empate de rank = **fica o servidor que já valia** (a vila não troca sozinha) ou, se ele não está entre os empatados, o de menor ID; (4) sem nada (saiu, perdeu o cargo, bot fora do servidor) = **padrão: vila Takumi + rank Rogue**. **Dados novos (migração `d5a91f3c7e28`):** vila **Takumi** (`takumi`) e rank **Rogue** (`rogue`, PT *Renegado*, `order` 0 = fora da escada Academy Student→Kami, nunca é "o menor rank"); os leitores que já existiam passam para Takumi/Rogue até o bot ler os cargos. Tabelas `discord_guilds`, `discord_roles`, `discord_member_roles` e coluna `readers.profile_source`. **Bot:** `ninwiki_bot/member_sync.py` — sincronização completa ao ligar e a cada 30 min, mais `on_member_update`/`on_member_join`/`on_member_remove` na hora (só para quem é leitor). **Para ligar:** (a) no **Discord Developer Portal** → seu app → **Bot** → *Privileged Gateway Intents* → ligue **SERVER MEMBERS INTENT**; (b) **Deploy API** (roda a migração) e **reinicie o bot**; (c) no painel, abra `/admin/discord-links` e ligue cada servidor a uma vila (e cargos a ranks, se o nome não for igual). Sem a intent o bot **continua funcionando** (liga sem ela, avisa no terminal em português) e só essa função fica desligada; `MEMBER_ROLES_SYNC=false` no `.env` do bot desliga de propósito. Um leitor **novo** nasce Takumi/Rogue e é preenchido na próxima sincronização (até 30 min) ou na primeira mudança de cargo. **Lista de membros dos servidores (painel `/admin/bot`, migração `e30805d7f1c9`):** além dos cargos dos leitores, o bot manda a **lista de membros** de cada servidor (`POST /bot/guild-members`, lotes de até 500; o último lote leva `final` + `syncToken` e a API apaga quem não veio; `remove` tira quem saiu). No painel, cada servidor tem a seção **Membros (N)** (abre sob demanda) com busca por nome ou ID, 50 por página, ID copiável, etiqueta *Bot*, cargos por nome e a data da última sincronização (`GET /discord-links/guilds/{id}/members?q=&limit=&offset=`, permissão `discord.links`; a listagem de servidores traz só a contagem). **Teto:** 20.000 membros guardados por servidor (acima disso guarda os primeiros e o painel mostra *lista parcial*). Antes da primeira sincronização o painel avisa *ainda não sincronizado* e lembra de ligar a Server Members Intent. **Privacidade (LGPD):** a tabela `discord_guild_members` guarda **só** Discord ID, nome de usuário, nome de exibição, se é bot, data de entrada e IDs de cargo; **nada** de e-mail ou mensagens; só a equipe com `discord.links` vê, e a linha some ao tirar o servidor (cascata). O bot só informa fatos (sem regra de cargo) e `MEMBER_LIST_SYNC=false` desliga só a lista (os cargos dos leitores continuam). Sincronização completa ao ligar e a cada 30 min (usa o cache; se incompleto, `guild.chunk()`; 0,5 s entre lotes) e eventos de entrada, saída e mudança de cargo/nome. **Para ligar:** Deploy API (migração) e reiniciar o bot (a Server Members Intent já é a mesma dos cargos). Testes: seção 38c de `testar_permissoes.py` e `testar_bot_integracao.py`. **Ranks (migração `a48aeefd4d0b`):** a hierarquia é Estudante da Academia → Genin → Chunin → **Jonin Special** → Jonin → **Conselho** → **Kami** (o Jonin Special fica **abaixo** do Jonin; migração `4bce34061269` ajusta a ordem) (o antigo Kage mudou de nome; o id interno continua `kage`, então perfis e mapeamentos de cargo seguem ligados). A descrição dos dois ranks novos é curta e neutra: refine no painel do Guia. Cargo do Discord vale pelo nome (EN ou PT) ou pelo id: um cargo "Conselho" ou "Jonin Special" já é reconhecido sozinho; para o Kami, cargo "Kami" (ou "Kage", pelo id) também. **Atalho do painel:** se o Discord de quem está logado como leitor é de alguém da **equipe ativa**, o menu do usuário (desktop e celular) mostra **Painel da equipe**, que abre `/admin` (a API informa `isStaff` em `/auth/reader/me`). É só conforto: o painel continua com o login e as permissões próprios (o cookie de leitor **não** vale como sessão da equipe); quem está desativado não vê o atalho.
- **Painel do bot (`/admin/bot`, menu *Bot* → *Servidores do bot*):** só leitura, mesma permissão `discord.links`, que agora é **exclusiva do S.Adm**: toda a categoria **Bot** do painel (*Servidores do bot* e *Ligações com o Discord*) só aparece e só responde para o S.Adm (Adm e Creator recebem 404 nas rotas, como nas outras permissões exclusivas). Mostra cada servidor onde o bot está com o **nome, o ID do servidor, a quantidade de membros** e os **cargos com os IDs** (com botão de copiar e filtro). O próprio bot informa isso à API (`/bot/guilds-sync`, campo `memberCount`); a migração `71a539f5a975` guarda a quantidade de membros. Depois do **Deploy API**, **reinicie o bot** para ele enviar a contagem (até lá aparece "membros: ainda não informado"). As *Ligações com o Discord* ficaram no mesmo grupo do menu. **Migrações em sequência no Deploy API** (todas rodam sozinhas): `a48aeefd4d0b` (ranks Jonin Special/Conselho/Kami), `c3d7e91b5f20` (torneio oculto pelo organizador), `e30805d7f1c9` (membros dos servidores do Discord) e a de junção `57fde6c42da0`, que une as duas últimas numa só head.
- **Bot — painel de servidores e remoções:** `/map` e `/random` foram **removidos** (e a rota `GET /bot/random`). Novo: com `GUILDS_CHANNEL_ID` o bot mantém uma mensagem editada com os servidores em que está e avisa entradas/saídas (`ninwiki_bot/guilds_feed.py`, `guilds_state.json`). **Reinicie o bot** e rode o **Deploy API**.
- **Bot — consulta (`/item` `/mob` `/jutsu` `/mastery` `/compare` `/help`):** qualquer pessoa, no idioma do servidor (`/language`). `/item`, `/mob`, `/jutsu` e `/mastery` mostram o cartão do resultado do tipo pedido (igual ao `/search`); `/compare a b` põe dois itens/armas/mobs/jutsus lado a lado; `/help` lista tudo (só quem pediu vê). **Cada comando sugere só o seu tipo **e busca só o seu tipo** (`/bot/search?kind=`: até 10 resultados do tipo, sem itens/mobs de outros tipos ocupando as vagas)** enquanto você digita (`/mastery tail` só sugere masteries; `/item` itens e armas; `/mob` mobs; `/jutsu` jutsus; `/drop` itens e armas; `/recipe` só itens que alguma profissão fabrica); só `/search` e `/compare` sugerem de tudo (rota `/bot/suggest` com o parâmetro opcional `kind`: item, weapon, mob, jutsu, mastery, recipe; sem `kind` = geral). O autocompletar guarda as sugestões 2 min em memória (por tipo) e desiste em 2,5 s. Os loops dos feeds (log, erros, saúde, versão, backup) agora sobrevivem a qualquer exceção inesperada (antes o `discord.ext.tasks` parava de vez). **Reinicie o bot** e rode o **Deploy API** (rota nova; o `kind` do autocompletar também exige os dois).
- **Convite do bot (site):** o cartão da Home e o botão do rodapé foram refeitos (ícone do Discord, 4 comandos de exemplo, passo a passo *Convidar → Autorizar → /help*, textos EN/PT em `lib/i18n.ts`, `invite`). Continua escondido sem `NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID`.
- **Visão Geral:** quadro de avisos, contadores, **gráfico de acessos** (7/30/90 dias), **países que mais acessam** e páginas mais vistas
  **Cidades e estados:** o cartão de acessos também lista as cidades/estados que mais acessam, mas **só se a Cloudflare mandar a localização**: no painel da Cloudflare vá em *Rules → Settings → Managed Transforms* e ligue **“Add visitor location headers”** (grátis). A API lê só `cf-region` e `cf-ipcity` (e só com `TRUST_PROXY_HEADERS=true`), guarda **contagens por dia + país + estado + cidade, nunca o IP**, e some com dados de mais de 400 dias. Sem isso o cartão mostra a dica e continua com os países. A cidade vem da Cloudflare (aproximada, às vezes a do provedor de internet).
  (seção 2.2c; permissão `analytics.view`), atividade recente e páginas desatualizadas. No rodapé do menu lateral: **"Web x · API y"** = versão
  publicada de cada parte (`dev`/`old` = não foi feito deploy com versão — útil para saber se o site no ar é o código novo).
- **Editor de texto (Tiptap):** negrito/itálico/sublinhado/tachado, títulos, listas, alinhamento, link, ficha, tabela; **cor da letra e cor de fundo**
  no estilo Word (grade do tema, cores padrão, usadas recentemente e "Mais cores"), **18 fontes** (8 do site + comuns do sistema), **tamanho da letra** e
  **limpar formatação**. **Spoiler** (blog): selecione o texto e clique no olho riscado — ele vai para dentro de um bloco que o leitor abre com um clique.
  A API só aceita cor/fonte/tamanho em formato conhecido (proteção contra CSS malicioso).
- **Bestiário e Armas:** páginas com cartões ricos (vida, dano, XP, alcance, respawn; arma com tipo, requisito, NPC, dano base, habilidade especial,
  knockback). No painel, o campo extra de armas chama **Stat Bonus**. A **descrição é opcional nos mobs** (nas demais categorias continua obrigatória); sem texto, a página pública não mostra o cartão de descrição.
- **Mapa (estilo do Nin Atlas):** o **mapa-mundi** (a página `/map` tem só ele; a antiga aba/grade de Áreas foi removida e as áreas abrem pelo mapa, busca e painel) (`NinWiki.Web/components/map/`: `world-atlas.tsx` é a tela, `atlas-engine.ts` o canvas, `atlas-data.ts` os dados/estilos, `area-panel.tsx` o painel, `area-pins.tsx` os pinos) é um canvas como o do Atlas: **fundo** escuro com o terreno/neblina do mundo (`world-bg.webp`, baixado do Atlas pelo script; a ilustração do jogo foi abandonada), as áreas coladas nas posições do jogo (imagens do cliente: mosaico de 1 px por bloco e, a partir do zoom 1,6, a imagem de 4 px por bloco de cada área), **sombra** por área, **rótulos** por tamanho sem sobreposição, nome das **vilas** de longe, **casas** por área, **ligações** tracejadas entre áreas vizinhas e **rotas de viagem** (barco, sapo...), **marcadores** por tipo que aparecem conforme o zoom (hospital, bounty, missões, chefes, calabouços, viagem, lojas, correio, mural, barbeiro, ranking, casamento, ponto de captura...; prédios viram um marcador na porta), botão **Mob levels** (tinge cada área pela faixa de nível dos mobs), **legenda** (Map key: liga/desliga cada tipo e pisca os marcadores ao passar o mouse), **busca** global (áreas, lugares, chefes, e mobs/recursos), **dica** ao passar o mouse, **painel** da área (imagem, zona, números, faixa de nível, abas Mobs/Locais/Recursos, saídas clicáveis que levam à área vizinha, link compartilhável `/map#map/<id>`), arrastar com inércia, zoom suave (roda, botões, `+`/`-`/`0`/setas com o mapa focado) e **pinça/toque duplo** no celular (painel vira folha embaixo), e **tela cheia** (Esc sai). **Ligação com o wiki:** mobs e recursos do painel e dos pinos viram link para a página publicada (`/detail/<slug>`, busca por nome EN/PT sem diferenciar maiúsculas, com miniatura da imagem); o índice vem de uma única chamada a `/content-items?status=published` (cache em memória, `wiki-index.ts`) e a seta ao lado do mob mostra o que ele dropa (carrega a ficha só ao abrir). Sem correspondência publicada, só o nome, sem link. O botão **View area map** abre a imagem da área com **pinos** por camada (lugares, prédios, portas para outras áreas — clicáveis —, mobs, NPCs e recursos; `area-pins.json`), e Sand (51)/Mist (100) têm o **pergaminho** do jogo. Os dados vêm do mesmo `py scripts/extrair_mapas_do_jogo.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; rode de novo quando o jogo atualizar): `world.json` (posições em blocos do mundo inteiro, 5042x2836), `world-atlas.json` (marcadores agrupados, ligações, rotas, regiões, níveis), `area-pins.json`, `areas-info.json` e `maps.json`; as posições e os dados de lugares/mobs vêm do Nin Atlas **só na hora de gerar** (3 áreas ficam sem posição), o site não depende do Atlas. Diferenças do Atlas: ícones desenhados com símbolos (não os sprites do jogo), sem as abas Bestiary/Items e sem as salas interiores. Para pôr a página em manutenção de novo, use `MAINTENANCE_PATHS` em `lib/maintenance.ts`.
- **Erros e problemas** (`/admin/errors`, só S.Adm): tudo que quebrou no wiki — erros da API, erros de tela do site, falhas da DeepL e
  alertas de flood — agrupados (um problema = uma linha com o contador), com local no código e traceback mascarado. Resolva
  com um clique; se voltar a acontecer, reabre sozinho. O card "Open" da Visão Geral mostra quantos estão abertos.

### 2.2 Log, erros e alertas no Discord (bot)
O bot cuida de **dois canais** (podem ser o mesmo). Os comandos e as mensagens do bot são em **inglês**. **Qualquer pessoa** do servidor usa só 3 comandos: `/status`, `/search` e `/language` (este último só com a permissão *Gerenciar servidor*: define o idioma do bot **naquele servidor**, English ou Português; `/search` aceita ainda `language:` para escolher na hora). Os comandos `/team ...` foram **removidos** (equipe e limpeza do log agora só pelo painel). `/status` (API, banco e site no ar agora, com tempo de resposta) e `/search <termo>` (procura itens, mobs, armas, jutsus, masteries e posts **publicados** e mostra o melhor resultado com **imagem, dados da ficha e resumo**, botão para a página completa menu para trocar de resultado e rodapé com **quem pesquisou** e a marca da equipe (resumo e rótulos em português quando o servidor/busca estiver em `pt`; o que ainda não tem tradução é traduzido pela DeepL na hora da busca e **fica salvo** — precisa de `DEEPL_API_KEY` na API; no máximo 4 itens por busca); ambos usam Components V2, têm limite por pessoa e respeitam `ALLOWED_GUILD_IDS`).

**Log geral** (`LOG_CHANNEL_ID`): o que acontece no painel (criou/editou/apagou, logins, mudanças de equipe e de permissões, tentativas
negadas). Mostra o **IP** de quem agiu no rodapé (`Panel · IP x`) — desligue com `LOG_SHOW_IP=false` no `.env` do bot; deixe esse canal **só para a equipe**. Nunca mostra o texto dos conteúdos.

**Erros e alertas** (`ERROR_CHANNEL_ID`; vazio = usa o canal de log): o bot avisa quando
- a **API** dá erro (5xx / exceção) — com tipo do erro, local no código, rota e quantas vezes;
- o **site** quebra na tela de um visitante (o navegador reporta sozinho);
- a **DeepL** para de funcionar (chave recusada, cota do plano gratuito acabou, fora do ar);
- alguém estoura o limite de requisições (possível flood/cópia em massa);
- a **API, o banco ou o site** (`SITE_URL`) **caem** — e quando **voltam**.
**Painel de status ao vivo** (`STATUS_PANEL=true`, padrão): uma mensagem **📡 Nin Codex status** no canal do monitor (`STATUS_CHANNEL_ID`; vazio = o de erros), **editada a cada checagem** (online/offline, ms, uptime desde que o bot ligou; o banco aparece como "unknown" se a API estiver fora). Mensagens novas de "caiu/voltou" ficam **desligadas** por padrão (o painel basta); ligue com `STATUS_ALERTS=true`. O site conta como no ar se **responder** (qualquer status abaixo de 500; 403 da Cloudflare incluso); 5xx, timeout, erro de conexão e redirecionamento em loop contam como fora do ar, e o motivo vai para o log do bot.
Anti-spam: o 1º aviso sai na hora; se o mesmo problema continua, só um novo aviso a cada 10 min (com "+N desde o último").
Problema marcado como resolvido no painel não é repostado (se voltar a acontecer, reabre). Detalhes e traceback: `/admin/errors`.

Como ligar:
1. Crie o(s) canal(is) só para a equipe e copie o ID (Modo Desenvolvedor → botão direito no canal → *Copiar ID*).
2. Dê ao bot, **nesses canais**, *Ver canal*, *Enviar mensagens* e *Inserir links*.
3. No `.env` do bot: `LOG_CHANNEL_ID`, `ERROR_CHANNEL_ID`, `SITE_URL=https://nincodex.guima.net` (opcional: `LOG_POLL_SECONDS`,
   `HEALTH_POLL_SECONDS`, `LOG_IGNORE_ACTIONS=login,logout`).
4. Reinicie o bot. Ele guarda onde parou em `log_state.json` e `error_state.json` (não repete nem perde avisos ao reiniciar).
Se o **próprio bot** ou a SquareCloud inteira caírem, ninguém avisa — vale ter também um monitor externo (ex: UptimeRobot) no `/health/ready` da API.

### 2.2c Acessos ao site (Visão Geral do painel)
A Visão Geral mostra um **gráfico de acessos** (7/30/90 dias: visualizações e visitantes), os **países que mais acessam** (bandeira, barra e %) e as páginas mais vistas — só para quem tem a permissão `analytics.view` (grupo Log; ajuste em *Permissões*).
- **Privacidade:** só contagens por dia/país/página. Sem cookies e sem guardar IP; o "visitante único" é um hash com sal diário que é **apagado em 2 dias**. Robôs e o painel (`/admin`) não contam.
- **País:** vem do cabeçalho `CF-IPCountry` da **Cloudflare** (precisa de `TRUST_PROXY_HEADERS=true`) ou do banco offline **DB-IP Lite** (CC BY 4.0), que o deploy da API baixa sozinho para `NinWiki.Api/geoip/country.mmdb`. Sem nenhum dos dois, os acessos aparecem como "Desconhecido".
- Nova migration (`alembic upgrade head`) — o deploy da API já roda.
- A página **Mapa** está liberada (ver a seção do mapa acima); `lib/maintenance.ts` continua servindo para tirar qualquer página do ar.

### 2.2d Convidar o bot e anúncio da Home
- **Banco de imagens** (`/admin/media`, menu *Images*): toda imagem enviada (aqui, pelo campo de imagem ou pelo editor) ganha um **ID** (#1, #2...). Nos campos de imagem de
  **conteúdo, blog (capa), jutsu, mastery, vila e clã** dá para digitar o ID — `img:12`, `#12` ou só `12` — e a API troca pelo endereço do arquivo ao salvar (ID que não existe = erro claro).
  **Arrastar e soltar:** solte uma ou várias imagens da sua pasta em qualquer lugar da tela *Images* (ou dentro da janela *Image library*) e elas sobem juntas, 3 por vez, com andamento ("Enviando 2/5"); o que não for imagem é ignorado e uma imagem com erro não cancela as outras. Nos campos de imagem, soltar um arquivo usa a primeira imagem.
  Cada campo de imagem também tem o botão **Image library** (escolher numa grade com **filtro de categoria** — sem contagem; "Todas" por padrão, só as categorias que o seu cargo pode ver — e busca por nome/ID, ou enviar na hora) e o editor do blog tem um botão para inserir imagem do banco.
  A tela mostra miniatura, tamanho, ID com **Copiar ID / Copiar endereço**; para apagar várias de uma vez marque as caixinhas (ou *Select all on this page*) e use **Delete selected** (as que estão em uso pedem uma segunda confirmação); quem tem `media.manage` (S.Adm por padrão) renomeia, apaga (avisa onde a imagem está em uso; precisa confirmar para apagar mesmo assim)
  e usa **Import from the uploads folder** para dar ID às imagens que já estavam em `uploads/` (a primeira abertura da tela já importa sozinha se o banco estiver vazio). Ver = `uploads.create`. Migration nova: `7b16dcfc1960`.
  **Categorias e páginas:** a tela mostra **100 imagens por página** (Anterior/Próxima) e tem botões de filtro por categoria com a contagem (`weapon`, `gear`, `consumable`, `currency`, `material`, `ring`, `scroll`, `npc`, `monster`, `furniture`, `hair_beard` (Cabelo/Barba), `skin` (Skins), `vanity` (Vanity), `tools` (Ferramentas), `closed`, `other` e *Sem categoria*; **não existe mais "Todas"**: a tela abre em *Sem categoria*, e a busca por texto procura em todas as categorias visíveis). Escolha a categoria dos novos envios no seletor ao lado do botão de enviar; arquivos nomeados `categoria__nome.png` (o script `imagens_em_folhas.py` gera assim) já entram com a categoria e o nome certos (ex.: `weapon__sword_2.png` → categoria Weapons, nome `sword_2`). Só quem tem `media.manage` — **por padrão apenas o S.Adm** (ele pode liberar em *Admin → Permissions*) — renomeia, apaga, escolhe/muda a categoria (a categoria enviada por quem não tem essa permissão é ignorada) e importa da pasta; muda a categoria de uma imagem pelo seletor do cartão, ou de várias (marque e use *Mudar categoria...* + *Aplicar*). Migration: `c4e8a1d92f37` (rode o **Deploy API** antes do Web). A categoria **`clothing` virou `gear`** (Equipamentos/Gear, igual ao Nin Atlas) — migration `a3f5b7c9d0e2` renomeia as imagens, a permissão `media.cat.gear` e os cargos personalizados.
  **Quem pode enviar pelo banco de imagens:** a permissão nova **`media.upload`** (*Enviar imagens pelo banco de imagens*). **Por padrão só o S.Adm**; em *Admin → Permissions* o S.Adm libera para Adm ou Creator quando quiser (também para cargos personalizados). **Categoria `closed`** (permissão exclusiva `media.closed`, só S.Adm): as imagens dela são privadas — só o S.Adm vê o botão, a lista, a contagem e o seletor; para qualquer outro cargo elas não existem (somem da lista/contagem/busca e dão 404). **Trancar categorias por cargo:** cada categoria (inclusive *Sem categoria*) tem uma permissão própria — `media.cat.weapon`, `media.cat.gear`, ..., `media.cat.hair_beard`, `media.cat.skin`, `media.cat.tools`, `media.cat.none` — num grupo *Categorias do banco de imagens* em *Admin → Permissions*. Por padrão Adm e Creator (e cargos personalizados) **veem todas**; o S.Adm **tranca** uma categoria para um cargo desmarcando a caixinha. Para quem está trancado a categoria se comporta como a `closed`: some da lista, da contagem, dos botões e da busca, e tentar abrir uma imagem dela dá o aviso de acesso negado. `closed` continua exclusiva do S.Adm (não dá para liberar). Observação: quem não tem `media.manage` envia imagens sem categoria; se *Sem categoria* estiver trancada para esse cargo, ele não verá o que enviou.
  **Aviso de acesso negado:** quem não é S.Adm e tentar ver essa imagem — chutando o ID (`GET /media/12`), filtrando por `closed`, usando `img:12` num campo de imagem, ou renomeando/apagando/mudando categoria — recebe **403 com a mensagem "Access denied: this image is in a closed (restricted) category..."**; a *busca por nome ou ID* que bater com uma imagem closed não mostra nada dela, mas exibe um aviso amarelo ("você não tem acesso para ver essa informação"). Isso confirma que algo existe com aquele ID/nome (é o comportamento pedido). Limite: o arquivo em `/uploads/...` é público para quem souber o endereço exato (nome aleatório de 32 caracteres) — `closed` protege o *painel e a API*, não é cofre.
  **Resetar IDs** (botão só do S.Adm, permissão exclusiva `media.reset_ids`): renumera todas as imagens a partir do #1 mantendo a ordem (a mais antiga vira #1) e ajusta a contagem; com a biblioteca vazia a contagem volta para #1. Os arquivos e o conteúdo já salvo não mudam (o conteúdo guarda o endereço, não o ID); só quem digitou um ID e ainda não salvou perde a referência. Para recomeçar do zero: apague as imagens (S.Adm) e clique em *Resetar IDs*.
  O envio pelos **campos de imagem** dos formulários (`uploads.create`) não mudou: Creator/Adm continuam enviando a imagem do próprio conteúdo.
- **Categorizar o banco de imagens pelo Nin Atlas:** `python scripts/sincronizar_imagens_atlas.py` (na pasta `NinWiki.Api`, com `$env:PYTHONPATH="."`) olha as imagens `N_item`/`N_fundo` (o N é o número do **ícone** no cliente do jogo — **não** é o ID do item no [Nin Atlas](https://nin-atlas.vercel.app): a ligação é feita **comparando as imagens pixel a pixel**, `scripts/atlas_icones.py`) que **ainda estão sem categoria** e põe a categoria pelo tipo do item (arma → `weapon`; roupas e acessórios → `gear`; anel → `ring`; consumível → `consumable`; moeda → `currency`; manual/pergaminho → `scroll`; mobília → `furniture`; o resto → `other`). Imagem cujo ícone **nenhum item do Atlas usa** vai para `closed` (só S.Adm). **Não mexe em imagem que já tem categoria**, a menos que você use `--corrigir-divergentes`, que corrige só as que contradizem o tipo do Atlas (ex.: anel em `furniture`; `closed` nunca é mexida). No Atlas "Currency" é quase tudo loot de mob, então vira `material` (só Ryo/Token/Coin/Coupon são `currency`) e `Cast` (shuriken, kunai, pílulas) vira `consumable`. Também cria `N_item`/`N_fundo` para os itens do Atlas que faltam no banco, lendo o `{id}.znin` da pasta do cliente do jogo (`--cliente`); itens que não têm ícone na pasta do cliente são pulados. Sem `--aplicar` é só **simulação**; recusa banco que não seja local, a menos que use `--permitir-remoto` (faça um backup antes).
- **Importar os monstros do Nin Atlas:** `python scripts/importar_mobs_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`) traz os **monstros que lutam** do [Nin Atlas](https://nin-atlas.vercel.app) (nível, dano, XP, respawn, alcance, tipo Monster/Boss, drops e retrato). Mob que o wiki **já tem** (mesmo nome) só recebe o que está **vazio** — a vida que você digitou fica; mob que não existe vira **rascunho**; **nada é publicado** (a menos que use `--publicar`, que publica só os monstros que o Atlas cobre). Os drops são ligados aos itens do wiki pelo nome ("Over 10%" / "Below 1%", como o jogo mostra) e só entram em mob que ainda não tem drops. A **vida** não existe no Atlas: fica vazia. O retrato é o 1º quadro da folha de sprites (`Characters/{sprite}.png`, 16×4 quadros), recortado e ampliado 4×, e vai para o banco de imagens na categoria `monster` (`--personagens` muda a pasta). Sem `--aplicar` é só simulação; recusa banco que não seja local, a menos que use `--permitir-remoto` (faça um backup antes).
- **Retratos novos dos lobos (patch v6.0.2.4):** `py scripts/atualizar_retratos_lobos.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`) troca o retrato de Wolf, Snow Wolf, Enraged Wolf e Rabid Wolf pelos sprites novos do cliente (610/608/609/607): cria imagem **nova** (`mob_{sprite}`, categoria `monster`, enviada por "Cliente do jogo") e aponta o mob para ela, sem mexer na antiga. Simulação por padrão; `--aplicar` grava; `--permitir-remoto` para produção (backup antes; envie antes os 4 arquivos novos de `uploads/`). Rodar de novo não duplica.
- **Importar os itens do Nin Atlas:** `python scripts/importar_itens_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`) — rode **depois** do `sincronizar_imagens_atlas.py`. Item/arma que o wiki **já tem** (mesmo nome) só recebe o que está **vazio** (tipo, nível, descrição, a imagem do **ícone certo** do banco de imagens (`N_item`, achada por `atlas_icones.py` — o ID do item no Atlas não é o do ícone; `--corrigir-imagens` troca as imagens ligadas errado pelas primeiras versões deste script), stack e, nas armas, dano base e requisito de Strength); a raridade só muda em **rascunho** que ainda está em Common. O que não existe vira **rascunho**; **nada é publicado** (a menos que use `--publicar`, que publica só as páginas que o Atlas cobre — nunca os outros rascunhos). Arma do Atlas em rascunho passa de Items para Weapons; tipos sem categoria própria (Manual, Recipe, Furniture...) ficam `general`; nomes repetidos (variantes) viram uma página só. No fim liga os drops dos mobs que estavam soltos ao item de mesmo nome. **Não importa** bônus de atributo, vida/chakra/crítico, requisitos que não são Strength, receitas nem lojas. Sem `--aplicar` é só simulação; recusa banco que não seja local, a menos que use `--permitir-remoto` (faça um backup antes).
- **Itens novos do jogo como rascunho:** `python scripts/criar_itens_do_jogo.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; simulação por padrão, `--aplicar` grava, `--permitir-remoto` só com backup novo) cria em **rascunho** os itens que entraram no cliente novo (`ItemKeys` do English.json, descrição do próprio cliente, nome PT oficial), renomeia `Kuronami Cloak (Style 2)` para `Kuronami Cloak 2`, e registra no banco de imagens os ícones novos `2507-2538` (`N_item` + `N_fundo`; só adiciona). Os arquivos novos de `uploads/` são listados no fim: inclua no zip de imagens da produção.
- **Corrigir armas pelos patches do jogo:** `python scripts/corrigir_armas_do_jogo.py` (mesmas opções; `--atlas arquivo.js` usa cópia local) ajusta dano/requisito/descrição de armas que ficaram para trás do post v6.0.2.4 (Jakuma, Wooden Boomerang, Hisui Fans, Nitoryu Fan, Jinbu, Shinboku, Blood Iron Fan) e preenche **só os `weapon_speed` vazios** (post da Steam, senão Nin Atlas). Mostra a tabela antes → depois com a citação do post; nunca despublica e não troca valor já ajustado à mão.
- **Corrigir dados em português no campo principal:** `python scripts/corrigir_idioma_dados.py` (simulação; `--aplicar` grava, `--permitir-remoto` para a produção, sempre depois de um `pg_dump`) troca por inglês os textos em português de Attributes, Villages, Ninja Ranks, Organizations, Story Arcs, Summons, uma Mastery (e seus caminhos), Clans e `effect`/`range`/`cast_time` de Jutsus (move o português para `_pt` quando o campo existe e está vazio; pula o que não bater e lista o português sobrescrito).
- **Mandar banco + imagens para a produção de uma vez:** `python scripts/enviar_para_producao.py preparar` (pasta `NinWiki.Api`, Docker ligado, `$env:PYTHONPATH="."`). Ele **não mexe** no seu banco local nem na produção: copia o banco local para um banco temporário, troca `http://localhost:8000` por `https://api.guima.net` em todas as colunas de texto/JSON (sem isso as imagens ficam quebradas na produção), gera `envio/ninwiki-producao.dump` e junta as imagens **novas** (ID maior que `--desde-id`, padrão 4799 = o que a produção já tinha) em `envio/imagens.zip`. Depois: (1) backup da produção e **Deploy API** (migrations) antes; (2) o comando `migrar_banco.py importar envio/ninwiki-producao.dump ...` que o `preparar` imprime — ele **substitui as tabelas** da produção, então vale só se ninguém editou lá desde o backup (confira em `/admin/audit-log`); (3) `python scripts/enviar_para_producao.py enviar-imagens --teste` e depois `--confirmo` (precisa de `SQUARE_API_KEY` e `SQUARE_APP_ID_API`; envia o zip para dentro do app da API com o mesmo envio do deploy, sem reiniciar). Sem chave, suba o `envio/imagens.zip` pelo painel do app. A pasta `envio/` não vai para o Git nem para a produção.
- **Converter as imagens do cliente do jogo (`.znin`) em PNG:** `python scripts/decodificar_znin.py` (pasta `NinWiki.Api`, venv ativado). O `.znin` **não é criptografia**: é um PNG comprimido com **LZ4** (4 bytes de assinatura + 4 bytes com o tamanho original + o bloco LZ4), então o PNG sai **idêntico ao original**. O script **só lê** a pasta do cliente (`--origem`, padrão `E:\Nin Online - Wiki\data files\graphics`) e grava na pasta de destino (`--destino`, padrão `Wiki-Image\graphics_png`), com as mesmas subpastas; confere o tamanho, a assinatura PNG e se a imagem abre, e lista o que falhar. Rode de novo a cada atualização do jogo (`--forcar` regrava o que já existe).
- **Dar nome às imagens sem nome:** `python scripts/nomear_imagens_publicadas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; sem `--aplicar` é só simulação). Só mexe em imagem com nome **vazio** ou com o nome-padrão do cliente (`N_item`/`N_fundo`) ou do Atlas (`mob_N`, as imagens de monstros): usa o nome da página **publicada** que a usa (item, mastery, clã, vila; pula se páginas com nomes diferentes dividem a imagem) e, para as que nenhuma página usa, herda o nome de uma imagem **com os mesmos pixels** que já tem nome (vira `Nome [id]`; precisa dos arquivos em `uploads/`, então rode no computador local). Recusa banco que não seja local, a menos que use `--permitir-remoto`.
- **Limpar marcação do jogo no texto (`<color=yellow>Hand Weapon</color>`):** `python scripts/limpar_marcacoes_do_jogo.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; sem `--aplicar` é só simulação, com antes → depois e contagem por tabela/coluna). Tira as tags do cliente do jogo (`<color=..>`, `<b>`, `<i>`, `<u>`, `<size=..>`, `<sprite..>`, `<link..>`; `<br>` vira quebra de linha) de todas as colunas de texto de conteúdo (itens/armas, jutsus, masteries, guias, vilas, posts…), inclusive `_pt`; texto simples só perde a tag, e em documentos do editor só os nós de texto são limpos (estrutura e marcas ficam; não vira negrito). Idempotente e sem migração. **Na produção:** depois do Deploy API, `python scripts/limpar_marcacoes_do_jogo.py --permitir-remoto` (simulação), faça backup (`pg_dump -Fc`) e rode `python scripts/limpar_marcacoes_do_jogo.py --aplicar --permitir-remoto`. **Regra na gravação:** a mesma limpeza roda sozinha toda vez que um texto de conteúdo é salvo (painel, bot, importadores; `app/core/text.py::limpar_marcacao_jogo`, ligada em `app/models/base.py` e em `validate_rich_content`), no dicionário oficial do jogo (a tradução automática não copia mais a marcação para o `_pt`) e, como rede de segurança, na leitura (bot e `components/lore/rich-text.tsx`). Um `<` de comparação (`HP < 50`) nunca é apagado.
- **Dar o nome do item às imagens (e tirar cópias):** `python scripts/nomear_imagens_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`; sem `--aplicar` é só simulação). Renomeia as imagens que ainda têm o nome-padrão `N_item` / `N_fundo` para o nome do item no seu padrão — `Ryo` e `Ryo_fundo` — quando o ícone é de **um** item do Atlas (ligação por imagem, `scripts/atlas_icones.py`). **Não** renomeia ícone que vários itens dividem (todos os "Manual"), ícone que nenhum item do Atlas usa, nem imagem que você já renomeou; nome repetido no jogo vira `Nome [N]`. Também **remove as cópias** que os scripts do Atlas criaram de uma imagem que já existia (compara os pixels, mesmo que você tenha renomeado a original): as páginas passam a usar a original. Os scripts do Atlas reconhecem a imagem pelo **conteúdo**, não pelo nome, então renomear não os confunde nem gera cópias.
- **Botão "Convidar o bot"** (rodapé de todas as páginas + cartão na Home): abre o convite do Discord com as **permissões mínimas**. Para aparecer, ponha o *Application ID* do bot
  em `NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID` (Secret `WEB_ENV`; Discord Developer Portal → sua aplicação do bot → *General Information*) e rode o **Deploy Web**.
  O link gerado é `https://discord.com/oauth2/authorize?client_id=ID&permissions=117760&scope=bot%20applications.commands`. As permissões (**117760**) são:
  *View Channels*, *Send Messages*, *Embed Links* e *Read Message History* — nada de Administrator, gerenciar mensagens/cargos/canais nem @everyone.
  Se o bot for **privado**, desmarque *Public Bot* no Portal (só você o adiciona; o botão do site passa a servir só para você).
- **Anúncio da Home** (`/admin/announcement`, permissão `announcement.manage`, Adm por padrão): uma faixa no topo da página inicial, com estilo (informação, novidade, aviso, evento),
  link opcional (só `https://` ou página do site) e tradução automática para português (DeepL; dá para corrigir a mão). **Sem mensagem, nada aparece.** O visitante pode fechar a faixa
  (volta a aparecer se o texto mudar). Publicar/remover vai para o log. Migration nova: `11d847610b08`.

### 2.2b Inglês por padrão + DeepL em tudo
O site, o painel, as mensagens da API e o bot são **inglês por padrão**. Todo conteúdo é escrito em **inglês** e a **DeepL traduz EN→PT-BR**
para os campos `_pt` ao salvar (se estiverem vazios; correção manual nunca é sobrescrita; botão **Retranslate** refaz). Vale para:
conteúdo (mobs/itens/armas…), masteries, jutsus, **vilas** (lema, descrição, descrição completa, clima), **clãs** e **organizações** (nome e
descrição) e **posts do blog**. O visitante escolhe PT/EN no seletor; a escolha **fica salva** no navegador. Sem `DEEPL_API_KEY` tudo
funciona, só não traduz sozinho.

**Como a tradução funciona agora (3 passos, nesta ordem):**
1. **Dicionário do jogo (oficial, grátis):** `NinWiki.Api/app/data/game_pt.json` (~2 MB, ~18.500 pares) vem do `Brazilian Portuguese.json` do próprio Nin Online.
   Se o texto em inglês **inteiro** (ou todos os parágrafos da descrição) existe lá, o português é o do jogo, **sem selo de "Tradução automática"** e sem gastar a DeepL.
2. **DeepL (opcional):** só se o dicionário não tem o texto e há `DEEPL_API_KEY`. A cota grátis (500 mil caracteres/mês) **renova todo mês** e o uso normal do
   wiki é de poucos milhares. Se a cota acabar (erro 456), a API registra **um** erro agrupado em `/admin/errors` (fonte `deepl`), pausa as tentativas por 1 hora e segue.
3. **Vazio:** o campo `_pt` fica vazio e o site mostra o inglês (nada quebra; salvar no painel e a busca do bot continuam funcionando).

**Também no sentido PT→EN (escreveu só em português):** em cada par (campo inglês, campo `_pt`): inglês vazio + `_pt` escrito → o inglês é gerado ao
salvar; `_pt` vazio + inglês escrito → o PT é gerado (como antes); **os dois escritos → nunca mexe**. Texto em português digitado por engano no campo
inglês **não** é "traduzido" sozinho (só o campo `_pt` dispara PT→EN). Ordem no PT→EN: (1) dicionário do jogo **inverso** (só se o PT inteiro é a tradução
oficial de **um único** inglês; PT ambíguo é ignorado; a caixa alta/baixa é reconstruída por uma regra simples), (2) DeepL (`reverse`), (3) vazio.
O **nome/título em inglês é obrigatório**: se só o `_pt` veio escrito e não há tradução disponível (sem `DEEPL_API_KEY` configurada na SquareCloud, cota
acabada ou DeepL fora do ar), o salvamento responde **422** com a mensagem "escreva também em inglês" (nunca copiamos o português para o campo inglês).
Campos opcionais (descrições) ficam vazios. Cobre: conteúdo (itens/mobs/armas/guias/missões), masteries, jutsus, artigos do Guia, proficiências,
organizações, clãs e posts; o painel aceita "pelo menos um dos dois" no nome/título. **Não cobre:** avisos do site, tags, nome da vila e o bot
(o bot só faz EN→PT, no máximo 4 por busca). O selo "Tradução automática" continua só para o português gerado (não há coluna para o inglês).
A pausa de 1 h após a cota (456) vale nos dois sentidos. Teste sem banco: `py scripts/testar_traducao_reversa.py`.

Nunca sobrescreve `_pt` já preenchido; o botão *Retranslate* também tenta o dicionário do jogo primeiro. Scripts (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`):
```bash
py scripts/extrair_dicionario_jogo.py            # refaz app/data/game_pt.json a partir do arquivo do jogo (rode quando o jogo atualizar)
py scripts/traduzir_com_jogo.py                  # SIMULAÇÃO: resumo por tabela/campo + exemplos; só `_pt` VAZIO
py scripts/traduzir_com_jogo.py --aplicar        # grava (1 linha por tabela no log de auditoria; 2ª rodada = 0 mudanças)
py scripts/traduzir_com_jogo.py --aplicar --permitir-remoto   # PRODUÇÃO (DATABASE_URL de produção; faça backup antes)
py scripts/testar_dicionario_jogo.py             # teste sem banco
```
**Descrições de jutsus (tradução manual, sem DeepL):** os 123 jutsus que tinham `description`/`long_description` sem `_pt` foram traduzidos à mão e guardados em
`NinWiki.Api/app/data/jutsus_pt.json` (chave = `id` do jutsu; só os nós de texto do Tiptap mudam; números e nomes de técnicas iguais ao original). Só preenche `_pt` vazio:
```bash
py scripts/aplicar_traducao_jutsus.py                              # SIMULAÇÃO (contagens)
py scripts/aplicar_traducao_jutsus.py --aplicar                    # banco local (2ª rodada = 0 mudanças)
py scripts/aplicar_traducao_jutsus.py --aplicar --permitir-remoto  # PRODUÇÃO: rode a simulação com --permitir-remoto primeiro, só depois do Deploy API e com backup
```
O que o jogo **não** cobre: guias, missões e textos escritos pela equipe — esses seguem pela DeepL ou à mão.

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
  Ajustes: `PUBLIC_REQUESTS_PER_MINUTE`, `WRITE_REQUESTS_PER_MINUTE`, `UPLOAD_REQUESTS_PER_MINUTE`, `MEDIA_UPLOAD_REQUESTS_PER_MINUTE` (API) e
  `WEB_RATE_LIMIT_PER_MINUTE`, `BLOCK_SCRAPER_UAS=false` (site).
- Cabeçalhos de segurança + **CSP** + HSTS no site e na API; corpo de requisição limitado (413); uploads com limite de pixels.
- Texto rico validado no servidor (só blocos/formatações permitidos, links `javascript:` recusados) e filtro no "colar" do editor.
- **Nada de documentação em produção:** o deploy não envia `*.md`, `*.example`, `scripts/`, dumps nem mapas de código para a SquareCloud, e **para** (falha em vermelho)
  se algum desses arquivos entrar no pacote por engano. Quem extrair o pacote não acha o README, o ROADMAP nem os testes.
  Para isso valer de verdade, mantenha o **repositório do GitHub privado** (se for público, os `.md` ficam à vista lá).
- **Bibliotecas:** o workflow *Segurança* (toda segunda e a cada push na `main`) roda `pip-audit` e `npm audit` e fica vermelho se houver falha conhecida;
  o aviso aparece na aba *Actions* (sem abrir branches nem pull requests). Última checagem: 0 vulnerabilidades no que vai para produção (API, bot e site). No site, as ferramentas de **build/lint** (`tailwindcss`, `eslint-config-next`...) ficam em `devDependencies`: elas só rodam no seu computador e no GitHub, nunca na SquareCloud. O `npm install` pode mostrar avisos "high" delas por causa do `braces` (negação de serviço com padrões de glob aninhados) — **ainda não existe versão corrigida** do `braces`; como esses padrões vêm só dos nossos próprios arquivos de configuração (nunca de visitante), não há como explorar. Confira com `npm audit --omit=dev` (deve dar 0) e rode `npm audit` de vez em quando: quando sair a correção, `npm update` resolve.
- Texto rico: cor, fundo, fonte e tamanho só em formato conhecido (sem injeção de CSS). Bot: só leitura (busca, log sem IP, erros sem traceback, backup) — não existe mais comando para gerir equipe pelo Discord.
- **O que só você pode fazer:** 2FA no Discord, GitHub e SquareCloud; Cloudflare na frente; backup do banco com restauração testada; não colar segredos em chat/print.
- Honestidade: conteúdo **público** precisa ser legível por qualquer visitante, então ninguém impede 100% a cópia por um robô
  decidido — o que se faz é torná-la lenta e cara, e proteger o servidor. Com a **Cloudflare** na frente (ver 3.8) fica bem melhor.

---

## 3. Hospedar na SquareCloud (hospedagem ATUAL, com o deploy automático do GitHub)

> **Esta é a hospedagem em uso.** O Nin Codex continua na SquareCloud (o plano foi renovado). O Azure (seção 3A) ficou como **plano B pronto**, sem uso por enquanto. Endereços reais: site `https://nincodex.guima.net` (antes `ninwiki.guima.net`) e API `https://api.guima.net`. Para colocar a versão nova no ar, siga a **seção 3.13**.

Este é o passo a passo **completo, do zero até o site no ar**, usando os **workflows do GitHub Actions** para enviar o
código. Você **não precisa** ter Python, Node nem Docker para publicar: o GitHub monta o pacote e manda para a SquareCloud.
(Docker só serve, no seu computador, para levar o conteúdo que você já tem localmente — passo 3.4.)

### 3.0 Visão geral — o que vai existir no final

| Peça | Onde roda | Endereço | Obrigatória |
|---|---|---|---|
| Banco PostgreSQL | *Databases* da SquareCloud | interno (host/porta + certificados) | sim |
| **API** (`NinWiki.Api`) | app da SquareCloud | `https://api.guima.net` | sim |
| **Site** (`NinWiki.Web`) | app da SquareCloud | `https://nincodex.guima.net` | sim |
| **Bot** (`NinWiki.Bot`) | app da SquareCloud | — (não tem endereço) | não |

Como funciona o ciclo: você **empurra o código para o GitHub** → abre *Actions → Deploy ... → Run workflow* → o GitHub
zipa a pasta, grava o `.env` e os certificados **só dentro do zip** (vindos dos *Secrets*, nunca do Git) e envia para o app
na SquareCloud, que reinicia. A API, ao iniciar, aplica sozinha as migrações do banco.

**Ordem do passo a passo:** 3.1 contas e segredos → 3.2 Discord → 3.3 banco → 3.4 (opcional) levar seu conteúdo local →
3.5 criar os apps na SquareCloud → 3.6 GitHub Secrets → 3.7 rodar os workflows → 3.8 domínios → 3.9 conferir → depois, 3.10 no dia a dia.

> ⚠️ **Domínio próprio é o recomendado.** O login usa cookie `SameSite=Lax`: o site e a API precisam estar no **mesmo site**
> (`nincodex.guima.net` + `api.guima.net`). Com os endereços `*.squareweb.app` (ex.: `ninwiki.squareweb.app` + `ninwiki-api.squareweb.app`)
> o navegador pode tratá-los como sites diferentes e **o login não persiste**. Para **testar sem domínio**, ponha `COOKIE_SAMESITE=none` no `API_ENV`
> (funciona em Chrome/Edge/Firefox; o Safari e navegadores que bloqueiam cookies de terceiros continuam sem funcionar). Com domínio próprio, deixe o padrão (`lax`).
> O domínio personalizado pode depender do plano da SquareCloud — confira no painel.

### 3.1 Antes de começar: contas e segredos
Você vai precisar de:
- conta na **SquareCloud** com plano que comporte 2–3 apps + 1 banco (API 512 MB, site 512 MB, bot 256 MB);
- um **domínio** (`guima.net`) — de preferência com DNS na **Cloudflare** (3.8);
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
3. **OAuth2 → Redirects** → *Add Redirect*: `https://api.guima.net/auth/discord/callback` (idêntico ao `DISCORD_REDIRECT_URI`;
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
mkdir certs                                     # coloque aqui os 3 arquivos baixados (3.3), com o nome que vieram
python scripts/migrar_banco.py importar backups/NOME-DO-SEU-ARQUIVO.dump --url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO" --ssl-ca certs/ca-certificate.crt --ssl-cert certs/certificate.pem --ssl-key certs/private-key.key --confirmo
```
> 📁 Os nomes dos 3 arquivos (`--ssl-ca`, `--ssl-cert`, `--ssl-key`) têm que ser **exatamente** os que estão na sua pasta `certs/`.
> A SquareCloud costuma baixar como `ca-certificate.crt`, `certificate.pem` e `private-key.key` (use `dir certs` para conferir).
> O erro `Certificado nao encontrado: certs/...` quer dizer que o nome (ou a pasta `certs/` dentro de `NinWiki.Api`) está diferente.
> ⚠️ Escreva o comando **numa linha só** (como acima). No PowerShell a barra invertida `\` **não** continua a linha — ela vira um
> argumento solto e dá o erro `unrecognized arguments: \`. Se quiser quebrar a linha: no PowerShell use o acento grave `` ` `` no fim
> de cada linha; no Linux/Mac use `\`.
> Troque `NOME-DO-SEU-ARQUIVO.dump` pelo nome real que o `exportar` gerou (veja a pasta `backups/`; ex.: `backups/ninwiki-20261001-1530.dump`).
> A URL do `--url` é a do banco da **SquareCloud** (destino), com `postgresql://` no começo (sem `+asyncpg`); se a senha tiver `@ : / #`,
> troque por `%40 %3A %2F %23`.
- O `importar` **substitui** as tabelas do destino (por isso o `--confirmo`). Se o banco da SquareCloud já tem dados, faça antes um backup:
  `python scripts/migrar_banco.py exportar --url "postgresql://..." --ssl-ca ... --ssl-cert ... --ssl-key ...`.
- O script usa o próprio Docker para rodar `pg_dump`/`pg_restore` e já ajusta a permissão da chave; nada a instalar.
  Com `--url` (banco da SquareCloud) ele usa a imagem **`postgres:17-alpine`**, porque o banco de lá é o **PostgreSQL 17** e o `pg_dump` 16 do seu container local recusa (`server version mismatch`). O banco local continua no container 16. Um backup da produção feito assim só restaura em Postgres 17 (não no container local 16).
- **Imagens do blog/wiki** (`NinWiki.Api/uploads/`): o workflow **não** envia essa pasta (para nunca sobrescrever o que está
  em produção). Depois de criar o app da API (3.5), envie as imagens pelo painel do app → *Files* → pasta `uploads/`.
- Banco sem certificado de cliente (Neon, Supabase…)? Pule os `--ssl-*`, use `?sslmode=require` no `--url` e deixe `DATABASE_SSL_*` vazio.

### 3.5 Criar os apps na SquareCloud (uma vez só) e anotar os IDs
O workflow **atualiza** um app que já existe, então cada app precisa ser criado uma vez. Truque para não ter de zipar o projeto:
envie um **pacote mínimo**; o primeiro workflow (3.7) coloca o código de verdade por cima.

| App | Arquivos do pacote mínimo (copie da pasta indicada e zipe) |
|---|---|
| API | `NinWiki.Api/squarecloud.app` + `NinWiki.Api/start.py` |
| Site | `NinWiki.Web/squarecloud.app` + um arquivo vazio chamado `server.js` (crie no Bloco de Notas) |
| Bot (opcional) | `NinWiki.Bot/squarecloud.app` + `NinWiki.Bot/main.py` |

No Windows: selecione os 2 arquivos → botão direito → *Enviar para → Pasta compactada*. Depois, para cada um:
1. Painel → **Add New → New Application** → envie o `.zip`. (Ele vai dar erro ao iniciar — é esperado, ainda falta o código.)
2. Se o `SUBDOMAIN` (`ninwiki-api`, `ninwiki`) já estiver em uso, troque no `squarecloud.app` do pacote **e** no do repositório.
3. Anote o **ID do app** (aparece na página do app, e na URL).

Depois pegue sua **chave da API da SquareCloud**: painel → seu perfil/conta → **API Key** (gere/regenere). É a `SQUARE_API_KEY`.
> Tratar a chave como senha: quem a tem controla todos os seus apps.

### 3.6 GitHub Secrets (onde ficam o `.env` e os certificados)
GitHub → o repositório → **Settings → Secrets and variables → Actions → New repository secret**. Crie um por linha:

> **Migração (`.env` → Variáveis de Ambiente da SquareCloud).** O deploy **não grava mais `.env`** no pacote (e a trava barra qualquer `.env` no zip), então
> ninguém que abrir os arquivos do app vê as senhas. **Antes do primeiro deploy novo**, em cada app (API, Bot, Web) abra *Variáveis de Ambiente* → **Importar**,
> cole o conteúdo do antigo `API_ENV`/`BOT_ENV`/`WEB_ENV` e salve. Para o Web, o `WEB_ENV` continua no GitHub só para o build. Depois do deploy, apague o
> `.env` antigo que ficou no File Manager do app. Os certificados do banco (`certs/`) continuam indo como arquivos.


| Secret | Valor | Obrigatório |
|---|---|---|
| `SQUARE_API_KEY` | chave da API da SquareCloud (3.5) | sim |
| `SQUARE_APP_ID_API` | ID do app da API (3.5) | sim |
| `SQUARE_APP_ID_WEB` | ID do app do site (3.5) | sim |
| `SQUARE_APP_ID_BOT` | ID do app do bot (3.5) | só se usar o bot |
| `API_ENV` | **não é mais enviado.** Use como rascunho/modelo e cole o conteúdo em *Variáveis de Ambiente* do app da API na SquareCloud (botão **Importar**) | não |
| `WEB_ENV` | conteúdo **inteiro** do `.env` do site (modelo abaixo) | sim |
| `BOT_ENV` | **não é mais enviado.** Cole o conteúdo em *Variáveis de Ambiente* do app do bot (botão **Importar**) | não |

**Certificados do banco (passo a passo).** Eles **não** vão no repositório nem no pacote (o deploy barra `certs/`, `.pem`, `.key`, `.crt`). Em produção, o **texto** de cada arquivo vai nas *Variáveis de Ambiente* do app da API:
1. Baixe os 3 arquivos no painel do banco da SquareCloud (`.crt`, `.pem`, `.key`).
2. Abra cada um no Bloco de Notas, selecione tudo (Ctrl+A) e copie (começa em `-----BEGIN` e termina em `-----END ...-----`).
3. No app da API → *Variáveis de Ambiente* → crie `DATABASE_SSL_CA` (texto do `.crt`), `DATABASE_SSL_CERT` (texto do `.pem`) e `DATABASE_SSL_KEY` (texto do `.key`). Se o painel não aceitar quebra de linha no valor, cole tudo em **uma linha** trocando cada quebra por `\n`.
3b. O painel avisa "Variável de ambiente sem aspas" para valores com espaços (o texto do certificado tem). Clique em **Aplicar correção e reiniciar** (ele coloca aspas duplas) ou coloque você mesmo `"..."` em volta do valor. A API ignora essas aspas e também **reconstrói o formato do certificado** caso o painel troque as quebras de linha por espaços ou junte tudo numa linha.
4. Salve e reinicie. A API grava esse texto num arquivo temporário (permissão 0600, fora da pasta do app, apagado ao sair), só para o TLS conseguir ler.
5. Apague a pasta `certs/` antiga no File Manager do app e, no GitHub, os Secrets `DB_SSL_CA/CERT/KEY` (não são mais usados).
6. Localmente o `.env` pode continuar apontando para arquivos (`certs/ca.crt`...): os dois formatos funcionam.

**Modelo do `API_ENV`** (troque tudo que está em MAIÚSCULAS):
```env
ENVIRONMENT=production
# ATENÇÃO: começa com postgresql+asyncpg:// (com o +asyncpg) e TERMINA com /NOME_DO_BANCO (o nome do banco do painel; costuma ser igual ao usuário)
DATABASE_URL=postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO
DATABASE_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----   # texto do .crt (veja o passo a passo acima)
DATABASE_SSL_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----  # texto do .pem
DATABASE_SSL_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----       # texto do .key
JWT_SECRET_KEY=COLE_O_PRIMEIRO_SEGREDO_GERADO
FRONTEND_ORIGIN=https://nincodex.guima.net
API_BASE_URL=https://api.guima.net
DISCORD_CLIENT_ID=SEU_CLIENT_ID
DISCORD_CLIENT_SECRET=SEU_CLIENT_SECRET
DISCORD_REDIRECT_URI=https://api.guima.net/auth/discord/callback
SUPER_ADMIN_DISCORD_IDS=SEU_DISCORD_ID
DEV_LOGIN_ENABLED=false
TRUST_PROXY_HEADERS=true
# COOKIE_SAMESITE=none   # só se usar os endereços *.squareweb.app em vez de domínio próprio (ver aviso da 3.0)
# FRONTEND_ORIGINS=https://ninwiki.guima.net   # só durante a troca de endereço (aceita o site antigo); apague depois (ver 3.13)
BOT_API_TOKEN=COLE_O_SEGUNDO_SEGREDO_GERADO
DEEPL_API_KEY=
# ---- opcionais (valores padrão entre parênteses; descrição na seção 4) ----
# MAX_NOTICE_FILE_MB=200
# MAX_UPLOAD_SIZE_MB=5
```
- Os 3 `DATABASE_SSL_*` recebem o **texto** dos certificados (ou, localmente, o caminho do arquivo). Sem
  certificado de cliente: apague essas 3 linhas e use `?ssl=require` no fim da `DATABASE_URL`.
- `ENVIRONMENT=production` desliga `/docs`, liga cookie `Secure`/HSTS, e a API **recusa iniciar** com `JWT_SECRET_KEY` fraco ou `DEV_LOGIN_ENABLED=true`.
- `TRUST_PROXY_HEADERS=true` é necessário atrás da SquareCloud/Cloudflare (senão todos os visitantes parecem ter o mesmo IP).
- `DEEPL_API_KEY` (opcional): ativa a tradução automática EN→PT. Chaves gratuitas terminam em `:fx`.

**Modelo do `WEB_ENV`:**
```env
NEXT_PUBLIC_API_URL=https://api.guima.net
NEXT_PUBLIC_SITE_URL=https://nincodex.guima.net
NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID=ID_DA_APLICACAO_DO_BOT   # liga o botão "Convidar o bot" (ver 2.2d)
# opcionais: WEB_RATE_LIMIT_PER_MINUTE=300   BLOCK_SCRAPER_UAS=true
```
⚠️ Esses valores são embutidos **no build**: mudou algo → edite o Secret e rode o workflow do site de novo.

**Modelo do `BOT_ENV`** (detalhes de cada opção em `NinWiki.Bot/.env.example`):
```env
DISCORD_BOT_TOKEN=TOKEN_DO_BOT
NINWIKI_API_URL=https://api.guima.net
BOT_API_TOKEN=O_MESMO_SEGUNDO_SEGREDO_DA_API
ALLOWED_GUILD_IDS=ID_DO_SEU_SERVIDOR
LOG_CHANNEL_ID=ID_DO_CANAL_DE_LOG
ERROR_CHANNEL_ID=ID_DO_CANAL_DE_ALERTAS
SITE_URL=https://nincodex.guima.net
# ---- opcionais (valores padrão entre parênteses; descrição na seção 4) ----
# STATUS_PANEL=true
# LOG_SHOW_IP=true
# HEALTH_POLL_SECONDS=60
# LOG_POLL_SECONDS=20
# LOG_IGNORE_ACTIONS=login,logout
```

### 3.7 Rodar os workflows (nesta ordem)
GitHub → aba **Actions** → escolha o workflow na lista da esquerda → **Run workflow** (branch `main`, ou a que você publica) → **Run workflow**.
1. **Deploy API na SquareCloud (manual)** → espere ficar verde. Painel da SquareCloud → app da API → **Logs**: deve aparecer
   `aplicando migrations...` e depois `iniciando API na porta 80...`. Teste `https://api.guima.net/health` (depois do 3.8; antes
   disso use o endereço `*.squareweb.app` do app só para testar).
2. **Deploy Web na SquareCloud (manual)** → o site é **compilado no próprio GitHub** (leva 2–4 min no workflow) e só o resultado vai para a SquareCloud, que apenas executa `node server.js` (uns 200 MB de RAM). Nos Logs do app deve aparecer `Ready`. (Compilar dentro da SquareCloud estoura a memória e o processo morre com `Killed` — por isso não fazemos assim.)
3. **Deploy Bot na SquareCloud (manual)** (opcional) → Logs: o bot conecta e, os comandos aparecem na hora nos servidores de `ALLOWED_GUILD_IDS`/`DEV_GUILD_ID` (sem nenhum deles, em até 1 h em todos).

O que o workflow faz por você: monta o `.env` a partir do Secret, grava os certificados em `certs/`, zipa a pasta **sem** `node_modules`, `.next`, `venv`,
`uploads`, `staff_files` e `backups`, envia pela API da SquareCloud e apaga tudo (`.env`, certificados, zip) do runner no fim.
Se algo der errado, o log do workflow mostra a resposta da SquareCloud (nunca o conteúdo do `.env`).

### 3.8 Domínios e DNS
1. Em **cada app** (API e site) → painel → *Custom Domain* → informe `api.guima.net` / `nincodex.guima.net`. A SquareCloud mostra o **registro DNS** a criar (normalmente um CNAME).
2. No DNS do domínio (Cloudflare recomendada) crie esses registros exatamente como a SquareCloud mostrou.
3. **Cloudflare (recomendado):** nuvem laranja ligada, modo SSL **Full (strict)**, *Bot Fight Mode* ligado e uma regra de rate limit.
   Com isso `TRUST_PROXY_HEADERS=true` usa o IP real do visitante (`CF-Connecting-IP`) e floods são barrados antes de chegar na SquareCloud.
4. Espere o DNS propagar (minutos a horas) e confira `https://api.guima.net/health`.

### 3.9 Conferir se está tudo certo (checklist)
- [ ] `https://api.guima.net/health` → `{"status":"ok","environment":"production"}`
- [ ] `https://api.guima.net/health/ready` → `{"status":"ok","database":"ok"}` (se `503`, a API não alcança o banco: revise `DATABASE_URL` e os certificados)
- [ ] `https://nincodex.guima.net` abre a Home; `/blog` abre (vazio, se começou sem dados)
- [ ] `https://nincodex.guima.net/login` → **Entrar com Discord** com a conta do `SUPER_ADMIN_DISCORD_IDS` → cai no `/admin`
- [ ] Em `/admin/staff` cadastre o resto da equipe e ajuste `/admin/permissions`
- [ ] Crie um post de teste com imagem; confira a imagem no site (se não aparecer, `API_BASE_URL` está errado)
- [ ] Num navegador sem login: abra um post, entre com o Discord (leitor), comente e curta
- [ ] Bot: `/search` responde e os canais de log/erros recebem mensagens

### 3.10 No dia a dia
- **Publicar uma atualização:** *commit/push* no GitHub → Actions → rode **só** o workflow do que mudou (API, site ou bot). A API reinicia e
  aplica migrações novas sozinha; se a migração falhar, **a API não sobe** (o banco nunca fica desatualizado em silêncio).
- **Mudar uma configuração:** edite em *Variáveis de Ambiente* do app na SquareCloud (API/bot/web: salve e reinicie). `WEB_ENV` só vale para o build do site: mudou um `NEXT_PUBLIC_*`, edite o Secret e rode o **Deploy Web**. Você pode desmarcar *Reiniciar o app* se quiser reiniciar depois.
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
| API: `could not read root certificate file ... no certificate or crl found` | o texto de `DATABASE_SSL_CA` está incompleto/cortado ou não é o `.crt`: recopie o arquivo inteiro (do `-----BEGIN` ao `-----END`) e use a versão mais nova da API |
| API: `Arquivo de certificado do banco nao encontrado` | variáveis `DATABASE_SSL_CA/CERT/KEY` ausentes no painel (ou `DATABASE_SSL_*` aponta para um arquivo que não existe: em produção cole o texto do certificado) |
| API: `Can't load plugin: sqlalchemy.dialects:driver` ou `DATABASE_URL nao esta definida` | o `API_ENV` não tem a linha `DATABASE_URL` (ou o Secret está vazio/em *Environment secrets*) |
| API: `Can't load plugin ... postgresql`, `No module named psycopg2` ou banco não encontrado | `DATABASE_URL` sem `+asyncpg` ou sem `/NOME_DO_BANCO` no final — use `postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO` |
| API: `SSL error`, `certificate verify failed`, `connection refused` | `DATABASE_URL`/porta errada, certificado trocado ou colado incompleto (precisa do `BEGIN`/`END`) |
| API: `private key file ... has group or world access` | já tratado automaticamente; se aparecer, atualize para a versão mais recente do repositório |
| API 500 em `/posts` ou `/auth/me` logo após atualizar | migração não aplicada: veja nos Logs se `aplicando migrations` terminou; reinicie o app |
| Site: "Não foi possível conectar à API" | `NEXT_PUBLIC_API_URL` errada no `WEB_ENV` (rode o workflow do site de novo) ou API fora do ar |
| Site: log com `Creating an optimized production build ...` e depois `Killed` | o app ainda está com a versão antiga (que compilava dentro da SquareCloud). Rode o workflow **Deploy Web** atualizado; se o app seguir com o comando antigo, no painel do app ajuste o arquivo principal para `server.js` e o comando de início para `HOSTNAME=0.0.0.0 PORT=80 node --env-file=.env server.js` |
| Aviso `unrs-resolver install scripts blocked` | era do build dentro da SquareCloud; com o build no GitHub não aparece mais (e o `package.json` já tem o `allowScripts`) |
| Login volta para `/login` sem erro | site e API em "sites" diferentes (use endereços do mesmo domínio (`nincodex.guima.net` e `api.guima.net`)) ou `FRONTEND_ORIGIN` diferente do endereço real do site |
| `redirect_uri` inválido no Discord | redirect da 3.2 não cadastrado ou diferente do `DISCORD_REDIRECT_URI` |
| Muitos `429` para todo mundo | `TRUST_PROXY_HEADERS=false` atrás de proxy, ou limite baixo: aumente `PUBLIC_REQUESTS_PER_MINUTE` / `WEB_RATE_LIMIT_PER_MINUTE` |
| Bot: "BOT_API_TOKEN diferente nos dois .env" | o `BOT_ENV` e o `API_ENV` precisam ter o **mesmo** `BOT_API_TOKEN` |
| Canal de log/erros vazio | `LOG_CHANNEL_ID` errado, bot sem permissão no canal, ou nada aconteceu ainda (o log começa "de agora") |
| Imagens sumiram | pasta `uploads` apagada em um redeploy feito pelo painel (restaure do backup — 3.10) |
| Imagens aparecem quebradas | `API_BASE_URL` errado no `API_ENV` (precisa ser o endereço público da API) |

### 3.12 Alternativa sem GitHub Actions (envio manual do zip)
Se preferir não usar os workflows: crie o `.env` dentro da pasta do app, zipe o **conteúdo** da pasta (sem `venv`, `node_modules`, `.next`,
`uploads`, `staff_files`, `backups`) e envie pelo painel. Na API inclua também `certs/`. O resto (Discord, domínios, conferência) é igual.

### 3.13 Entrada em produção do Nin Codex na SquareCloud (passo a passo, na ordem segura)
Situação: o site antigo (`ninwiki.guima.net`) está no ar na SquareCloud; queremos pôr no ar o **Nin Codex** (`https://nincodex.guima.net`, API `https://api.guima.net` — a mesma de antes) com o banco novo
(`NinWiki.Api/envio/ninwiki-final-dominio.dump`, já com os endereços de imagem trocados para `https://api.guima.net`) e as 4.832 imagens novas. **Ninguém pode gravar no site entre o backup e o fim da troca.**
Comandos de PC: PowerShell, pasta `NinWiki.Api`, venv ativo, Docker ligado, `$env:PYTHONPATH="."`. **Nunca cole senhas/certificados em chat.** Faça tudo em ordem; se um passo falhar, **pare** e vá para "Rollback" no fim.

**A. Preparar (nada muda para o visitante)**
1. **Backup novo da produção.** Pegue o backup mais recente do canal de backup do Discord (todas as partes `.nbk.01-of-NN...`) **e**, além dele, um dump do banco da SquareCloud (uma linha só; gera `backups/ninwiki-AAAAMMDD-HHMM.dump`; guarde uma cópia fora do PC também):
   `py scripts/migrar_banco.py exportar --url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO" --ssl-ca certs/ca-certificate.crt --ssl-cert certs/certificate.pem --ssl-key certs/private-key.key`
   Baixe também a pasta `uploads/` do app da API (painel → *Files*).
2. **A produção mudou desde o backup de 30/10 01:50?** O banco final foi montado com aquele backup. Veja em `/admin/audit-log` se há registros **depois de 30/10 01:50**, se saiu post novo da Steam em `/admin/posts`, comentário novo, ou mudança de equipe/cargos em `/admin/staff`. **Se mudou:** o dump final está desatualizado — refaça a mescla com o backup novo: restaure-o num banco temporário (`py scripts/restaurar_backup.py CAMINHO.nbk.01-of-NN --confirmo`, com o `DATABASE_URL` do `.env` local apontando para `ninwiki_prod_copy`, como explica o topo do `restaurar_backup.py`), rode `py scripts/mesclar_producao.py --prod ninwiki_prod_copy --destino ninwiki_merged` (simulação; depois igual com `--aplicar`), exporte o resultado com `migrar_banco.py exportar` e converta: `py scripts/converter_urls_dump.py ENTRADA.dump envio/ninwiki-final-dominio.dump --dominio https://api.guima.net` (precisa dar `SOBRARAM_LOCALHOST=0`). **Se não mudou:** siga com o dump pronto.
3. Confira o dump: `certutil -hashfile envio\ninwiki-final-dominio.dump SHA256` (anote). O Alembic do dump é `c3f5a7b9d1e4`, a mesma head do código (`py -m alembic heads`).

**B. Troca (a partir daqui o site fica em manutenção)**
4. **Ligue a manutenção:** `/admin/maintenance` (S.Adm). O site mostra a página de manutenção; a equipe entra pelo login.
5. **Variáveis do app da API** (painel → app da API → *Variáveis de Ambiente*; salve, o Deploy do passo 6 reinicia). Só estas mudam (o resto, incluindo `DATABASE_URL` e os 3 `DATABASE_SSL_*`, **continua igual**):
   - `FRONTEND_ORIGIN=https://nincodex.guima.net` (o login sempre volta para ele).
   - `FRONTEND_ORIGINS=https://ninwiki.guima.net` (**só durante a transição**: aceita o endereço antigo no CORS/CSRF; apague depois de uns dias).
   - `API_BASE_URL=https://api.guima.net` e `DISCORD_REDIRECT_URI=https://api.guima.net/auth/discord/callback` (iguais aos de hoje; só confira — nada muda no Discord Developer Portal).
   - `COOKIE_SAMESITE=lax` (ou apague a linha: `lax` é o padrão). Se hoje está `none`, era porque site e API estavam em "sites" diferentes; agora os dois ficam em `guima.net`, então `lax` é mais seguro. **Mantenha `none` só se** o teste do passo 15 mostrar que o login não persiste (ou se for testar pelos endereços `*.squareweb.app`). Teste: entrar com o Discord em `nincodex.guima.net`, recarregar e continuar logado; abrir `/admin`.
   - `TRUST_PROXY_HEADERS=true` (como já estava) e `TRUSTED_PROXY_CIDRS`: **deixe vazio** por enquanto. O aviso no log da API (`TRUST_PROXY_HEADERS=true sem TRUSTED_PROXY_CIDRS`) quer dizer só "a API confia no cabeçalho de IP vindo de qualquer um"; na SquareCloud o app só é alcançado pelo proxy dela (e pela Cloudflare), então é aceitável e é o comportamento de antes. Só preencha se descobrir **o IP que a API enxerga como quem abriu a conexão** (o proxy da SquareCloud, que **não** é a faixa da Cloudflare): se a lista estiver errada, a API ignora o IP real e **todos os visitantes parecem ter o mesmo IP** (o limite de uso passa a barrar todo mundo). As faixas oficiais da Cloudflare estão em <https://www.cloudflare.com/ips/> (só servem se a conexão chegar mesmo da Cloudflare; confirme com o suporte da SquareCloud antes). Teste depois de mexer: em `/admin` → Visão Geral os IPs/países têm que variar, não ser um só.
   - `BOT_LOG_SHOW_IP=false` (padrão). Ponha `true` só se quiser que o bot mostre o IP de quem agiu no canal de log (canal só da equipe).
6. **Deploy API** (GitHub → Actions → *Deploy API na SquareCloud (manual)*, na branch do Nin Codex). Ele envia o código e **reinicia** a API, que roda `alembic upgrade head` ao iniciar. Nos *Logs* do app: `aplicando migrations...` e depois `iniciando API`. Se a migração falhar a API não sobe: **pare** (Rollback).
7. **Importar o banco final** (**substitui as tabelas; a produção antiga é apagada** — por isso os passos 1 e 4). Antes, pare o **bot** (painel do app do bot → *Stop*). No PC, **uma linha só**:
   `py scripts/migrar_banco.py importar envio/ninwiki-final-dominio.dump --url "postgresql://USUARIO:SENHA@HOST:PORTA/BANCO" --ssl-ca certs/ca-certificate.crt --ssl-cert certs/certificate.pem --ssl-key certs/private-key.key --confirmo`
   A URL é a do banco da SquareCloud, começando em `postgresql://` (sem `+asyncpg`); os 3 certificados ficam em `NinWiki.Api/certs/` (nunca no Git). O script usa o Docker com `postgres:17-alpine` e roda `pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error`: **apaga e recria as tabelas que estão no dump** e para no primeiro erro de verdade (avisos "does not exist, skipping" são normais). **Atenção:** `error_events` (lista de erros) e `traffic_visitors` (impressões digitais de visitantes, que a API apaga em 2 dias) ficam **como no banco local**; os da produção antiga se perdem (o registro de erros recomeça; os contadores de acesso vêm da mescla). Se o comando falhar no meio, o banco pode ficar pela metade: **não ligue o site**, vá para o Rollback.
   Depois **reinicie o app da API** e confira: `https://api.guima.net/health/ready` → `database: ok`.
8. **Enviar as 4.832 imagens novas** (35 MB; o banco já aponta para elas, sem isso as imagens quebram). Com a chave e o ID do app da API (3.5), no PowerShell:
   `$env:SQUARE_API_KEY="..." ; $env:SQUARE_APP_ID_API="..."`
   `py scripts/enviar_para_producao.py enviar-imagens --teste` — manda só `uploads/_teste_envio.txt`. No painel do app da API → *Files* confira que ele apareceu **e que `uploads/` e o resto do app continuam lá** (não foi verificado se o envio por pacote preserva o que já existe; por isso o teste vem antes e o passo 1 baixa a `uploads/`).
   `py scripts/enviar_para_producao.py enviar-imagens --lista envio/imagens_novas.txt --confirmo` — monta `envio/imagens-novas.zip` só com as imagens da lista e envia sem reiniciar. (**Não** use `enviar-imagens --confirmo` sozinho: ele manda o `envio/imagens.zip` antigo, de 19/10, que não tem as 4.832.) Sem a chave, envie o `envio/imagens-novas.zip` (criado por esse comando) pelo painel. Depois abra um item com imagem nova e confira; reinicie a API se preciso.
9. **Variáveis do Web.** No GitHub, edite o Secret **`WEB_ENV`** (vale só para o **build**; os `NEXT_PUBLIC_*` ficam embutidos no site): `NEXT_PUBLIC_API_URL=https://api.guima.net`, `NEXT_PUBLIC_SITE_URL=https://nincodex.guima.net`, `NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID=1549636610323120128` (ID público do bot; liga o botão "Convidar o bot"). Mudou algum? Precisa rodar o **Deploy Web** de novo. No painel do app do site (*Variáveis de Ambiente*, valem ao rodar) ponha `LEGACY_SITE_HOSTS=ninwiki.guima.net` (sem `https://`): quem chegar por esse nome recebe **redirecionamento 308** para o endereço novo (ponha também no `WEB_ENV` por garantia).
10. **Deploy Web** (Actions → *Deploy Web na SquareCloud (manual)*). O site é compilado no GitHub e só roda na SquareCloud; leva alguns minutos e fica fora do ar um instante (o Worker mostra a manutenção). *Logs* do app: `Ready`.
11. **Bot.** No `BOT_ENV` (painel do app do bot) ponha `SITE_URL=https://nincodex.guima.net`; `NINWIKI_API_URL=https://api.guima.net` e o `BOT_API_TOKEN` (igual ao da API) continuam. No **Discord Developer Portal** → sua aplicação → *General Information*: nome **Nin Codex** e *App Icon* = `NinWiki.Bot/assets/avatar.png`. Rode o **Deploy Bot** (as rotas `/bot` mudaram, o bot **precisa reiniciar**).

**C. Domínio e Cloudflare**
12. **DNS (zona `guima.net` na Cloudflare):** painel da SquareCloud → app do **site** → *Custom Domain* → adicione `nincodex.guima.net` e crie na Cloudflare o registro que a SquareCloud mostrar (normalmente um CNAME), **nuvem laranja** (proxied) e SSL *Full (strict)*. **Mantenha `ninwiki.guima.net` apontando para o mesmo app**, para o redirect 308 funcionar (se a SquareCloud aceitar só **um** domínio personalizado por app — não verificado —, faça o redirect na Cloudflare: *Rules → Redirect Rules*, de `ninwiki.guima.net/*` para `https://nincodex.guima.net/${1}`, código 308). `api.guima.net` **não muda**. **Worker de manutenção:** em *Workers & Pages* → `ninwiki-manutencao` → *Domains & Routes*, adicione a rota `nincodex.guima.net/*` (mantenha a do antigo; veja `Cloudflare/README.md`).
13. **Discord (login):** o *Redirect* do OAuth continua `https://api.guima.net/auth/discord/callback` (a API não mudou de endereço). Nada a fazer.

**D. Conferir e abrir**
14. Com a equipe logada (passe de 12 h), ainda em manutenção: `https://nincodex.guima.net` abre; `curl -I https://ninwiki.guima.net` mostra `308` e `location: https://nincodex.guima.net/...`; `https://api.guima.net/health`; uma imagem nova; `sitemap.xml` e `feed.xml` com o endereço novo.
15. **Cookies e login:** `F12` → *Application* → *Cookies*. O cookie da sessão deve ser do host da **API** (`api.guima.net`), `HttpOnly`, `Secure`, `SameSite=Lax` (ou `None` se mantiver `none`). Faça login do **Taku** (S.Adm), recarregue, abra `/admin`. Quem estava logado no endereço antigo precisa **entrar de novo**. Confira `/admin/audit-log` (histórico mesclado, ~7.773 registros, mais a sua entrada de login) e `/admin/staff` (6 ativos; usuários de teste inativos). Contagens esperadas (`RUNBOOK_BANCO.md`): users 11, posts 30, content_items 3.534, media_images 9.933.
16. **Tire a manutenção** (`/admin/maintenance`) e teste sem login (janela anônima): Home, um item, uma imagem, o blog; entre como leitor com o Discord e comente. O bot deve voltar a postar no canal de log.
17. Depois de alguns dias sem problema, apague `FRONTEND_ORIGINS` (API) e `LEGACY_SITE_HOSTS` só quando ninguém mais usar o endereço antigo.

**Rollback (voltar atrás)**
- **Antes do passo 7 (banco):** nenhum dado mudou. Reponha as variáveis antigas da API (`FRONTEND_ORIGIN=https://ninwiki.guima.net`, sem `FRONTEND_ORIGINS`), rode Deploy API/Web da versão anterior (*Run workflow* em outra branch/tag) e tire a manutenção.
- **Depois do passo 7:** pare API e bot; restaure o dump do passo 1 com o mesmo comando do passo 7 (`migrar_banco.py importar backups/ninwiki-....dump ... --confirmo`); reponha as variáveis antigas e rode Deploy API e Deploy Web da versão anterior. Imagens novas que sobraram em `uploads/` não atrapalham.
- DNS: se o endereço novo der problema, tire a rota/DNS novo e o antigo continua; o Worker desliga com `MAINTENANCE_DISABLE=1`.
- Hospedagem alternativa (plano B): `Azure/` (seção 3A), não usada agora.

---

## 3A. Alternativa pronta: Azure (plano B, NÃO usada agora)

> **Plano B — não é a hospedagem atual.** Decidimos continuar na SquareCloud (seção 3). Esta seção guarda o desenho do **Azure for Students** para o caso de
> precisar mudar um dia. É o resumo em alto nível; **o passo a passo detalhado, os arquivos de Docker e os scripts ficam na pasta [`Azure/`](Azure/) — comece por
> [`Azure/LEIA-ME.md`](Azure/LEIA-ME.md)**. (Se o `LEIA-ME.md` ainda não existir na sua cópia, o kit está sendo montado; os arquivos
> `Azure/docker-compose.yml`, `Caddyfile` e `Dockerfile.*` já mostram o desenho.)

### 3A.1 Visão geral do desenho
| Peça | Onde roda | Observação |
|---|---|---|
| **1 VM Linux** (Azure for Students) | Azure | roda tudo abaixo com **Docker Compose** |
| **Caddy** | container | recebe o tráfego e separa: `wiki.seudominio` para o site, `api.seudominio` para a API |
| **Cloudflare Tunnel** (`cloudflared`) | container | a VM só faz conexão de **saída**: **nenhuma porta é aberta** para a internet |
| **API** (`NinWiki.Api`), **Site** (`NinWiki.Web`), **Bot** (`NinWiki.Bot`) | containers | imagens montadas pelos `Azure/Dockerfile.*` |
| **PostgreSQL 17** | container, rede interna | **sem porta exposta**: só a API alcança; dados em volume |
| **Backups** | Azure **Blob Storage** (+ o backup cifrado do bot no Discord) | banco e imagens; ver 3A.6 |

A Cloudflare continua na frente (DNS, proteção, Worker de manutenção em `Cloudflare/`). Como só existe **uma** instância da API, o limite de uso por
IP em memória continua exato (não precisa de Redis).

### 3A.2 Ordem de deploy (sempre esta)
1. **API primeiro** — ao iniciar ela roda `alembic upgrade head` (se a migração falhar, a API não sobe).
2. **Site (Web) depois** — ele pode depender de campos/rotas novos da API.
3. **Reiniciar o Bot** — sempre que o código do bot ou as rotas `/bot/*` mudarem (comandos novos só aparecem depois do reinício).

É a mesma ordem da SquareCloud (Deploy API, Deploy Web, Bot).

### 3A.3 Variáveis de ambiente no Azure (o que muda)
As variáveis são as da seção 4. Mudanças e novidades:
- Os segredos ficam num arquivo `.env` **na VM** (ao lado do `docker-compose.yml`, fora do Git, permissão restrita) — nunca na imagem nem no repositório.
- `ENVIRONMENT=production`, `DEV_LOGIN_ENABLED=false`, `TRUST_PROXY_HEADERS=true` (o IP real vem da Cloudflare: `CF-Connecting-IP`) **junto com `TRUSTED_PROXY_CIDRS`** = a rede interna do Docker onde o Caddy fala com a API (sem isso, quem alcançasse a API direto poderia forjar o IP).
- `DATABASE_URL` aponta para o container `postgres` da rede interna (sem os `DATABASE_SSL_*`, que eram exigência do banco da SquareCloud).
- `FRONTEND_ORIGIN` / `API_BASE_URL` / `DISCORD_REDIRECT_URI` com os domínios finais; **atualize o *Redirect* no Discord Developer Portal**.
- **`FRONTEND_ORIGINS`** (API, opcional): origens **extras** aceitas no CORS/CSRF durante a troca de endereço (ex.: o domínio antigo). O login sempre volta
  para `FRONTEND_ORIGIN`. Apague quando a transição acabar.
- **`BOT_STATE_DIR`** (Bot): pasta dos arquivos `*_state.json` do bot (padrão: ao lado do `main.py`). No Docker use um volume (ex.: `/data`) para o container poder ter o disco só-leitura.
- Site: `NEXT_PUBLIC_*` entram no **build** da imagem (mudou? reconstrua a imagem do Web). `STANDALONE_BUILD=true` e `NEXT_PUBLIC_BUILD_SHA` são só do build.
- `BACKUP_PASSPHRASE` continua obrigatória para o backup cifrado: **guarde também fora da VM** (sem ela o backup não abre).

### 3A.4 Passo a passo para colocar o banco no ar no Azure (alto nível)
Os comandos exatos estão em `Azure/` e nos scripts citados. Faça **nesta ordem** e não pule o backup:
1. **Backup novo da produção atual (SquareCloud)** — o dado vivo (equipe, comentários, posts da Steam...) só existe lá. Baixe todas as partes do último `.nbk` do canal de backup do Discord e guarde.
2. **Ligar o modo manutenção** (`/admin/maintenance`, S.Adm) para ninguém gravar durante a troca; depois de ligar, baixe o backup mais recente.
3. **Restaurar esse backup num banco temporário local** e **mesclar** com o banco local: `py scripts/mesclar_producao.py --prod ninwiki_prod_copy --destino ninwiki_merged` (simulação primeiro; `--aplicar` depois). Regras de mescla no topo do script. O `ninwiki_merged` é a base nova.
4. **Preparar o dump para o domínio novo:** `py scripts/converter_urls_dump.py ENTRADA.dump SAIDA.dump --dominio https://api.seudominio.com` (troca `http://localhost:8000` pelo endereço público da API; roda só em banco temporário). O `enviar_para_producao.py preparar` faz a mesma troca e ainda junta as imagens novas em `envio/imagens.zip`.
5. **Subir a VM** (`docker compose up -d` com o `.env` pronto), primeiro só Postgres e API, e **restaurar o banco mesclado** no container (`pg_restore`, ver `Azure/`). A produção já estava na head das migrações.
6. **Imagens:** copie a pasta `uploads/` (todas as imagens) para o volume de uploads da API. O banco guarda só o endereço; sem os arquivos as imagens quebram.
7. **Subir a API, depois o Web, depois reiniciar o Bot** (3A.2).
8. **Apontar o DNS/túnel** para o Azure, atualizar o *Redirect* do Discord, conferir o checklist (o da 3.9 vale aqui também) e **desligar a manutenção**.
9. Deixar a SquareCloud **parada, não apagada**, por alguns dias (plano B); depois desligue os apps e guarde um último backup.

Se algo der errado antes do passo 8, nada mudou para o visitante: o DNS ainda aponta para a SquareCloud.

### 3A.7 Checklist do dono depois de trocar o subdomínio do site
Endereço novo definido: `nincodex.guima.net` (o antigo é `ninwiki.guima.net`). Na SquareCloud use a seção 3.13; esta lista vale também para o Azure.
- [ ] **Cloudflare, DNS:** criar o registro de `nincodex.guima.net` (túnel); manter o nome antigo apontando para o mesmo lugar para o redirect funcionar.
- [ ] **Cloudflare, Worker de manutenção:** mudar a rota (*Workers Routes*) para o host novo (`Cloudflare/README.md`).
- [ ] **Site (`WEB_ENV`/`.env`):** `NEXT_PUBLIC_SITE_URL=https://nincodex.guima.net` e `LEGACY_SITE_HOSTS=<endereço-antigo>` (sem `https://`); **reconstruir** o Web.
- [ ] **API:** `FRONTEND_ORIGIN=https://nincodex.guima.net` e `FRONTEND_ORIGINS=https://<endereço-antigo>` durante a transição; depois apague o `FRONTEND_ORIGINS`. Se existir `COOKIE_DOMAIN` (ou o cookie for de um domínio), confira que cobre o host novo e a API.
- [ ] **Discord Developer Portal:** nome do bot **Nin Codex** e avatar `NinWiki.Bot/assets/avatar.png`; o *Redirect* do OAuth só muda se o **domínio da API** mudar (`https://api…/auth/discord/callback`).
- [ ] **Bot:** **nada a mudar** — o bot pega o endereço do site da API (`FRONTEND_ORIGIN`), então basta atualizar a **API** (e reiniciá-la); o bot passa a usar o endereço novo sozinho (na próxima checagem, em até alguns minutos, sem reiniciar). O `SITE_URL` do bot é só reserva: se ele ainda tiver o endereço antigo, **não** causa mais link velho.
- [ ] **Quem estava logado no endereço antigo precisa entrar de novo** (o cookie não passa de um host para o outro).
- [ ] Conferir `/version`, o login, uma imagem, o `sitemap.xml`/RSS (devem usar o endereço novo) e que o endereço antigo redireciona (308) para o novo.

### 3A.5 Scripts desta etapa (pasta `NinWiki.Api`, venv ativo, `$env:PYTHONPATH="."`, Docker ligado, **sempre em banco local**)
Todos fazem **simulação por padrão** e só gravam com `--aplicar` (o detalhe de cada um está na seção 2.1 e no topo do próprio script).
| Script | Para quê |
|---|---|
| `criar_itens_do_jogo.py` | cria como **rascunho** os itens novos do cliente do jogo (e registra os ícones no banco de imagens) |
| `corrigir_armas_do_jogo.py` | corrige armas pelos patches (posts da Steam + textos do cliente); só mexe com evidência |
| `corrigir_idioma_dados.py` | move português que estava no campo **inglês** (atributos, vilas, ranks, clãs...) para `_pt` e grava o inglês |
| `criar_guias_do_jogo.py` / `criar_guias_do_fandom.py` | artigos do Guia como rascunho (livro de guias do cliente / páginas do Fandom) |
| `criar_jutsus_do_jogo.py` | jutsus do cliente como rascunho (só nome EN/PT) |
| `importar_jutsus_fandom.py` / `importar_jutsus_atlas.py` | completam os jutsus (só campos vazios) com Fandom / Nin Atlas |
| `classificar_jutsus.py` | dá caminho/mastery com evidência e publica os completos (`--aplicar --publicar`) |
| `importar_missoes_fandom.py` | gera `NinWiki.Web/data/missions.json` (não mexe no banco); `--so-verificar` confere com o cliente |
| `verificar_com_cliente.py` | corrige nomes e `name_pt` pelos textos do jogo (só banco local) |
| `extrair_mapas_do_jogo.py` | gera os dados do mapa-mundi a partir do cliente do jogo |
| `atualizar_retratos_lobos.py` | retratos novos dos 4 lobos (patch 6.0.2.4); não apaga a imagem antiga |
| `gerar_logo.py` | gera favicon, logo do site, imagem de compartilhamento, avatar do bot e logo do bot do **Nin Codex** a partir da logo (`public/images/logo/nin-codex-logo.png`) |
| `criar_post_apresentacao.py` | cria o post "Welcome to Nin Codex" no blog (EN + PT, por *Nin Codex Team*) como **rascunho**; `--publicar` já publica; não sobrescreve se o post existe; simulação por padrão, `--aplicar` grava, `--permitir-remoto` para a produção (backup antes) |
| `mesclar_producao.py` | junta o banco local com os dados vivos do backup da produção (só em bancos temporários `ninwiki_*`) |
| `converter_urls_dump.py` | troca `localhost` pelo domínio público dentro de um dump |
| `restaurar_backup.py` / `migrar_banco.py` | restaurar um backup `.nbk` / exportar e importar o banco (`pg_dump`/`pg_restore`) |

**Ordem segura (conteúdo até a produção):**
1. `migrar_banco.py exportar` (cópia de segurança do banco local).
2. Importadores e correções que ainda quiser (simulação, depois `--aplicar`). Para jutsus: `classificar_jutsus --aplicar`, `importar_jutsus_atlas --aplicar`, `classificar_jutsus --aplicar --publicar`.
3. Revisar os rascunhos no painel e publicar.
4. `mesclar_producao.py` (3A.4, passo 3), depois `converter_urls_dump.py`.
5. Restaurar no Azure (3A.4).

Nunca aponte esses scripts para o banco de produção sem backup e sem o `--permitir-remoto` (quando o script o exige).

### 3A.5b Banco final pronto e roteiro (`NinWiki.Api/envio/`)
O banco mesclado já foi gerado: `envio/ninwiki-codex-final.dump` (pg_dump `-Fc`, feito no Postgres 16; restaura no 17) e a lista das imagens novas `envio/imagens_novas.txt`
(4.832 imagens de `uploads/`). **Leia `NinWiki.Api/envio/RUNBOOK_BANCO.md`** (passo a passo em português simples, conferências e rollback). Resumo: `converter_urls_dump.py`
troca `http://localhost:8000` pelo domínio da API (precisa dar `SOBRARAM_LOCALHOST=0`) → copiar dump e imagens para a VM → backup do que existir → parar API/site/bot → `pg_restore` →
conferir `alembic_version` = `c3f5a7b9d1e4` → subir API, site, bot. O `gerar_logo.py` (logo do site, favicon, ícones, imagem de compartilhamento, `NinWiki.Bot/assets/avatar.png` e o logo do bot em `NinWiki.Api/app/static/brand/`, a partir de `nin-codex-logo.png`)
é idempotente: pode rodar de novo. A pasta `envio/` e os `.nbk` não vão para o Git.

### 3A.6 Segurança e backups no Azure
- **Nenhuma porta aberta** na VM (só a conexão de saída do túnel); SSH, se usado, só por chave e restrito por IP no grupo de segurança de rede.
- Postgres na rede interna **sem acesso à internet** e sem porta publicada; containers com `no-new-privileges`, `cap_drop: ALL` e logs com rotação (veja `Azure/docker-compose.yml`).
- Segredos só no `.env` da VM; `.env`, certificados e dumps nunca vão para o Git (`.gitignore`).
- Continuam valendo todas as proteções do app (CSP com nonce, 2FA do Discord, cookies `httpOnly`, limite de uso, cabeçalhos — seção 2.3).
- **Backups:** (a) o backup cifrado do bot continua indo para o canal privado do Discord (seção *Backup automático*); (b) cópia do banco e das imagens no **Blob Storage** do Azure (agendamento em `Azure/`); (c) antes de qualquer mudança grande, um dump à mão. **Teste a restauração** de vez em quando (`restaurar_backup.py` num banco temporário): backup que nunca foi restaurado não é backup.
- Mantenha a VM e as imagens atualizadas; o Dependabot semanal já abre PRs das bibliotecas.

---

## 4. Variáveis de ambiente (referência)

Cada app tem o seu `.env` (local) — em produção o conteúdo vai **inteiro** num Secret do GitHub (`API_ENV`, `WEB_ENV`, `BOT_ENV`, ver 3.6). **Não existe nenhum Secret
novo do GitHub**: tudo que aparece abaixo é uma **linha a mais dentro desses três Secrets**. Mudou uma linha → edite o Secret e rode o workflow do app de novo
(o site precisa rodar de novo até para as `NEXT_PUBLIC_*`, que entram no build). Modelos comentados: `NinWiki.Api/.env.example`, `NinWiki.Web/.env.local.example`, `NinWiki.Bot/.env.example`.

### 4.1 API (`API_ENV`)
| Variável | Padrão | Para quê |
|---|---|---|
| `ENVIRONMENT` | `development` | `production` liga cookie `Secure`/HSTS, desliga `/docs` e recusa segredos fracos |
| `DATABASE_URL` | — (obrigatória) | `postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/BANCO` |
| `DATABASE_SSL_CA` / `_CERT` / `_KEY` | vazio | certificados do banco: texto `-----BEGIN...` (produção) ou caminho do arquivo (local) |
| `DATABASE_SSL_VERIFY_HOSTNAME` | `false` | confere também o nome do host do certificado |
| `JWT_SECRET_KEY` | — (obrigatória) | segredo longo e aleatório da sessão (em produção a API recusa um fraco) |
| `JWT_ALGORITHM` / `ACCESS_TOKEN_EXPIRE_MINUTES` / `SESSION_HOURS` | `HS256` / `15` / `12` | duração do login |
| `SUPER_ADMIN_DISCORD_IDS` | vazio | Discord IDs (vírgula) que viram **S.Adm** no 1º login |
| `DEV_LOGIN_ENABLED` | `false` | login de desenvolvimento — **nunca** `true` em produção |
| `BOT_API_TOKEN` | vazio | senha entre bot e API (o **mesmo** valor no `BOT_ENV`); vazio = rotas `/bot` desligadas (inclui `/status` e `/search` do bot) |
| `TRUST_PROXY_HEADERS` | `false` | `true` atrás de SquareCloud/Cloudflare: usa o IP real e o país (`CF-IPCountry`) do **gráfico de acessos** |
| `TRUSTED_PROXY_CIDRS` | vazio | redes (vírgula, ex.: `127.0.0.1,172.16.0.0/12`) cujos cabeçalhos de IP real (`CF-Connecting-IP`/`X-Forwarded-For`) a API obedece quando `TRUST_PROXY_HEADERS=true`; de fora da lista o cabeçalho é ignorado (anti-forja de IP). **No Azure/Docker defina** a rede interna do Docker; vazio = confia em qualquer origem (a API avisa no log) — aceitável só na SquareCloud |
| `COOKIE_SAMESITE` | `lax` | `none` só se usar `*.squareweb.app` em vez de domínio próprio |
| `DISCORD_CLIENT_ID` / `_SECRET` / `DISCORD_REDIRECT_URI` | vazio | login com Discord |
| `FRONTEND_ORIGIN` / `API_BASE_URL` | localhost | endereços públicos do site e da API (CORS, CSRF, links de arquivos) |
| `DEEPL_API_KEY` | vazio | tradução EN→PT (chaves grátis terminam em `:fx`) |
| `FRONTEND_ORIGINS` | vazio | origens **extras** (separadas por vírgula) aceitas no CORS/CSRF **só durante a troca de endereço** do site (ex.: o domínio antigo); o login sempre volta para `FRONTEND_ORIGIN`. Vazio = só a principal |
| `MAX_UPLOAD_SIZE_MB` | `5` | imagem enviada pelo editor/painel |
| `MAX_NOTICE_FILE_MB` | **`200`** | anexo do Quadro de avisos (gravado aos pedaços; a Cloudflare grátis corta acima de 100 MB) |
| `MAX_JSON_BODY_KB` | `512` | corpo máximo das requisições comuns |
| `PUBLIC_REQUESTS_PER_MINUTE` / `UPLOAD_REQUESTS_PER_MINUTE` / `WRITE_REQUESTS_PER_MINUTE` | `1200` / `1500` / `120` | limite por IP (leituras, imagens, escritas) |
| `BACKUP_PASSPHRASE` / `BACKUP_EXCLUDE_TABLES` | vazio / `traffic_visitors,error_events` | senha do backup cifrado (vazio = backups desligados; **guarde-a**: sem ela o backup não abre) / tabelas fora do backup |
| `STEAM_NEWS_APP_ID` | vazio | liga o **importador de notícias da Steam** (ex.: `1674010`, o número da página `store.steampowered.com/news/app/1674010`): a API confere a cada `STEAM_NEWS_INTERVAL_MINUTES` (30, mín. 10) e copia para o blog, com a tag **Patch Notes**, cada post marcado `patchnotes` na Steam |
| `STEAM_NEWS_AUTHOR_NAME` | vazio | nome mostrado em *por/by* nos posts importados (a desenvolvedora); vazio = o autor que a Steam informa |
| `STEAM_NEWS_STATUS` | `published` | `published` publica na hora; `draft` cria **rascunho** para você revisar (troque para `draft` se a conversão errar algo) |
| `STEAM_NEWS_REQUIRE_TAG` / `STEAM_NEWS_MAX_PER_RUN` | `patchnotes` / `5` | só importa posts com esta tag da Steam **ou com título de atualização** (vazio = todos) / teto de posts novos por conferência |
| `STEAM_NEWS_TITLE_PATTERN` | `update\|patch\|hotfix\|\bv?\d+\.\d+(\.\d+)*[a-z]?\b` | expressão regular (sem diferenciar maiúsculas) aplicada ao **título**: a Steam nem sempre marca os updates como `patchnotes` (o rótulo "Atualização regular" da página é o *tipo* do evento, não uma tag da API). Vazio = só a tag |
| `MEDIA_UPLOAD_REQUESTS_PER_MINUTE` | `600` | envios de imagem (`POST /media` e `/uploads/image`) por IP: balde próprio, maior, para enviar milhares de imagens; o painel também tenta de novo sozinho quando a API pede calma (429) |
| `LOGIN_REQUESTS_PER_MINUTE` / `LOGIN_FAIL_LIMIT` / `LOGIN_FAIL_WINDOW_MINUTES` / `BOT_FAIL_LIMIT` | `30` / `5` / `15` / `10` | freios do login e do token do bot (`BOT_LOG_SHOW_IP=false` na API: só com `true` o bot pode mostrar o IP de quem agiu no canal de log; sair da conta invalida o token da sessão) |

**Enviar milhares de imagens de uma vez (ex.: 4 mil).** Dois caminhos:
1. *Pelo painel* (Admin → Images, arrastar e soltar): funciona, mas cada imagem é um pedido (limite de 600/min por IP; o painel **espaça os envios** (~400/min, abaixo do limite), espera o tempo que a API pedir no 429, tenta de novo em falha de rede/5xx, **para tudo** se a sessão vencer e mostra o botão **Tentar de novo** com o que falhou). 4 mil imagens levam ~10–15 minutos: deixe a aba aberta (o navegador avisa se tentar fechar).
2. *Direto na pasta (mais rápido)*: coloque os arquivos (`.png`, `.jpg`, `.gif`, `.webp`; prefira nomes simples, sem espaços/acentos) na pasta `uploads/` do app da API (SquareCloud → *Files*) e, no painel, clique em **Sync** (Admin → Images). Cada arquivo novo ganha um ID. O deploy **nunca** mexe nessa pasta.
Cada imagem ocupa disco no app: confira o espaço do plano antes.
3. *Nomear em lote, de graça:* o painel usa o **nome do arquivo** como nome da imagem na biblioteca. Para identificar milhares de ícones sem pagar API, use `NinWiki.Api/scripts/imagens_em_folhas.py` (no seu computador): ele monta "folhas" numeradas que você manda ao Claude no chat, e renomeia os arquivos com as respostas (`tipo-nome-numero.png`). Passo a passo no topo do próprio script.


Sem variável nova para os acessos ao site: o país vem da Cloudflare (`TRUST_PROXY_HEADERS=true`) **ou** do arquivo `geoip/country.mmdb`, que o workflow da API baixa
sozinho (DB-IP Lite). Só rodando local (`POSTGRES_*` do `.env.example` servem só ao Docker do banco).

### 4.2 Site (`WEB_ENV` / `.env.local`)
| Variável | Padrão | Para quê |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | endereço da API (entra no build) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | endereço público do site: sitemap, RSS, links, vídeos da Twitch e destino do redirecionamento do endereço antigo (**vale no build**: mudou, reconstrua o site) |
| `LEGACY_SITE_HOSTS` | vazio (desligado) | **só no servidor**: hosts antigos do site, separados por vírgula e **sem `https://`** (ex.: `endereco-antigo.guima.net`). Pedidos a eles recebem redirect **308** para o `NEXT_PUBLIC_SITE_URL`. Use junto com `FRONTEND_ORIGINS` na API durante a troca de subdomínio |
| `NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID` | vazio | Application ID do **bot** (público, não é segredo): liga o botão "Convidar o bot" no rodapé e na Home; vazio = botão escondido (entra no build) |
| `WEB_RATE_LIMIT_PER_MINUTE` | `300` | páginas por minuto por IP (`proxy.ts`) |
| `BLOCK_SCRAPER_UAS` | `true` | bloqueia robôs de cópia conhecidos |
| `STANDALONE_BUILD` / `NEXT_PUBLIC_BUILD_SHA` | vazio | só do **build** (imagem Docker/deploy): `STANDALONE_BUILD=true` gera o servidor `standalone`; `NEXT_PUBLIC_BUILD_SHA` é o commit mostrado em `/version`. Não se usa no `.env.local` |

### 4.3 Bot (`BOT_ENV`)
| Variável | Padrão | Para quê |
|---|---|---|
| `DISCORD_BOT_TOKEN` | — (obrigatória) | token do bot |
| `NINWIKI_API_URL` | `http://localhost:8000` | endereço da API |
| `BOT_API_TOKEN` | — (obrigatória) | o **mesmo** da API |
| `ALLOWED_GUILD_IDS` | vazio | servidores onde os comandos existem e funcionam (IDs separados por vírgula). O bot **registra os comandos em cada um deles na hora** e **apaga os comandos globais antigos** (some qualquer comando velho; nada aparece em servidor fora da lista). Vazio = comandos globais (até 1 h, todos os servidores) |
| `DEV_GUILD_ID` | vazio | servidor de testes: entra na lista acima (comandos na hora). Em produção pode ficar vazio se `ALLOWED_GUILD_IDS` estiver preenchido |
| `LOG_CHANNEL_ID` | vazio | canal do log geral (só equipe!) |
| `ERROR_CHANNEL_ID` | vazio | canal de erros e do painel de status (vazio = usa o de log) |
| `SITE_URL` | vazio | **só reserva**: o bot pega o endereço do site da **API** (`FRONTEND_ORIGIN` dela, `GET /bot/config`) e acompanha sozinho uma troca de domínio; este valor só vale se a API não responder. O site é vigiado pelo bot e o endereço é usado nos botões *Open* do `/search` e nos links |
| `BACKUP_CHANNEL_ID` / `BACKUP_INTERVAL_MINUTES` / `BACKUP_KEEP` / `BACKUP_PART_MB` | vazio / `180` / `8` / `9` | backup automático no canal privado: de quantos em quantos minutos (mín. 30), quantos manter, tamanho de cada parte (ver *Backup automático*); canal vazio = sem backup |
| `MEMBER_ROLES_SYNC` | `true` | lê os cargos dos leitores do site para a API preencher vila/rank do perfil. Exige ligar a **Server Members Intent** no Discord Developer Portal; sem ela o bot liga igual, só sem esta função. `false` desliga de propósito |
| `MEMBER_LIST_SYNC` | `true` | manda também a **lista de membros** de cada servidor (nome, ID, cargos) para o painel `/admin/bot`; exige a mesma Server Members Intent. `false` desliga só a lista (os cargos dos leitores continuam) |
| `GUILDS_CHANNEL_ID` / `GUILDS_LOG_CHANNEL_ID` | vazio | canal **privado seu** com o painel de servidores do bot (uma mensagem editada: total, membros, lista) e avisos de entrada/saída de servidor (o segundo separa os avisos em outro canal). Sem comando. Veja `NinWiki.Bot/README.md` |
| `VERSION_WEBHOOK_URL` | vazio | webhook da mensagem *Latest updates* (versão da API e do Web, editada a cada deploy). É segredo |
| `SITE_HEALTH_URL` | vazio | (opcional) endereço **só** da checagem de saúde, ex.: `https://ninwiki.squareweb.app` (direto da hospedagem, sem Cloudflare/cache na frente); vazio = checa o `SITE_URL` |
| `STATUS_CHANNEL_ID` | vazio | canal **só do monitor** (painel "Nin Codex status" + avisos de API/banco/site caiu/voltou), separado dos erros do wiki; vazio = usa o `ERROR_CHANNEL_ID` |
| `STATUS_ALERTS` | `false` | `true` = além do painel, manda uma mensagem **nova** a cada "caiu" / "voltou" (padrão: só o painel, que se edita sozinho) |
| `STATUS_DOWN_AFTER` | `3` | checagens seguidas que precisam falhar para avisar "caiu" (suba para 5 se a rede oscila e o bot avisa demais) |
| `STATUS_PANEL` | `true` | mensagem **📡 Nin Codex status** editada a cada checagem; `false` = só avisa queda/volta |
| `LOG_SHOW_IP` | `true` | mostra o IP de quem agiu no canal de log (canal só da equipe); `false` = não mostra |
| `HEALTH_POLL_SECONDS` | `60` | intervalo da checagem de API/banco/site (mín. 30) |
| `LOG_POLL_SECONDS` | `20` | intervalo do feed do log (mín. 10) |
| `LOG_IGNORE_ACTIONS` | vazio | ações fora do canal (ex.: `login,logout`) |
| `BOT_STATE_DIR` | pasta do `main.py` | onde ficam os `*_state.json` do bot (log, backup, versão...). No Docker/Azure use um volume (ex.: `/data`) para o container poder ter o disco só-leitura |

## 5. Mapa do código (onde cada coisa mora)

Todo arquivo começa com um comentário-resumo do que faz e toda função tem uma linha explicando o que faz.
- `NinWiki.Api/app/main.py` liga tudo (rotas + camadas de proteção). `app/api/*` = rotas; `app/core/*` = configuração, login,
  permissões, limites de abuso (`hardening.py`, `rate_limit.py`), auditoria; `app/models/*` = tabelas; `app/schemas/*` = formatos JSON.
- `NinWiki.Api/alembic/versions/*` = histórico do banco; `scripts/*` = testes e utilitários (`migrar_banco.py`, `verificar_projeto.py`).
- `NinWiki.Web/app/*` = páginas (`(wiki)` público, `admin` painel); `components/*` = peças de tela; `lib/api-client.ts` = tudo que o
  site pede à API; `proxy.ts` = limite por IP/robôs; `next.config.js` = cabeçalhos de segurança/CSP.
- `NinWiki.Bot/main.py` + `ninwiki_bot/*` = `/status`, `/search` e `/language` (`public_commands.py`), log no Discord (`log_feed.py`), erros e painel de status (`error_feed.py`).
- `NinWiki.Web/components/admin/rich-text-editor.tsx` (+ `editor-color-picker.tsx`, `lib/editor-fonts.ts`) = editor de texto; `components/lore/rich-text.tsx` = como o texto aparece no site; `components/admin/traffic-card.tsx` = gráfico de acessos.
- **Backup / versão / manutenção:** `NinWiki.Api/app/core/backup.py` (gera o backup cifrado) + `app/api/bot.py` (`/bot/backup`, `/bot/version`) + `scripts/restaurar_backup.py`; `NinWiki.Bot/ninwiki_bot/backup_feed.py` e `version_feed.py` (decidem nomes/retenção/quando editar) + `command_sync.py` (comandos por servidor) + `main.py` (os laços); `NinWiki.Api/app/core/steam_news.py` (importador da Steam); `NinWiki.Web/app/version/route.ts` e `proxy.ts` (cabeçalho `x-ninwiki-web`); `Cloudflare/` (Worker da página de manutenção). Ferramentas locais sem relação com o wiki ficam na branch `ferramentas-locais` (**nunca** dar merge).
- `Azure/` = kit da VM do Azure (`docker-compose.yml`, `Caddyfile`, `Dockerfile.*`, scripts; guia em `Azure/LEIA-ME.md`). `.github/workflows/deploy-*.yml` = deploy da SquareCloud (hospedagem atual); `deploy-azure.yml` é do plano B.
- `NinWiki.Api/app/api/analytics.py` + `core/geoip.py` = acessos anônimos e país; `app/api/bot.py` = rotas do bot (equipe, log, erros, busca).


## Importador de notícias da Steam (blog automático)
- **O que faz:** a cada 30 min (`STEAM_NEWS_INTERVAL_MINUTES`) a API pergunta à API pública da Steam (`ISteamNews/GetNewsForApp`, sem chave) pelas notícias do jogo, fica só com as marcadas `patchnotes` que ainda não foram importadas (o `gid` da Steam vai em `posts.source_id`, único: nunca duplica) e cria o post no blog: título e data da Steam, texto convertido para o editor (negrito, links, listas, citações, imagens), **tag Patch Notes**, **por/by = a desenvolvedora** e um **crédito no topo** com o link do post original ("Originally published on Steam…"). Imagens usam o endereço da Steam; a primeira vira a capa; a DeepL traduz para PT como em qualquer post.
- **Ligar (passo a passo):** (1) no app da **API** (SquareCloud → *Variáveis de Ambiente*) crie `STEAM_NEWS_APP_ID=1674010` e `STEAM_NEWS_AUTHOR_NAME=<nome da desenvolvedora>` (`STEAM_NEWS_STATUS=published` já é o padrão); (2) rode o **Deploy API** (migration `d7a2b9c4e150`) e reinicie; (3) no painel, *Blog posts* ganha o cartão **Notícias da Steam** com o botão **Importar agora** e o resultado da última conferência (só quem tem `posts.publish`).
- **Não importou nada? Diagnóstico:** no cartão *Notícias da Steam* clique em **Importar agora**: ele mostra `N lidos · M de atualização · K importados`, os erros (se houver) e, quando nada foi importado, **a lista de títulos e tags que a Steam devolveu**. Se o cartão nem aparece: `STEAM_NEWS_APP_ID` não está nas variáveis da **API**, a API não foi reiniciada/redeployada, ou o Web ainda é a versão antiga. Se aparecem posts mas nenhum com a tag `patchnotes`: a Steam não marcou o post de hoje assim — esvazie `STEAM_NEWS_REQUIRE_TAG` (e reinicie a API) para importar todos. O log da API também registra cada conferência ("Steam news: N lidos, M com a tag...").
- **Posts "Atualização regular" sem a tag:** o importador aceita um post se ele tiver a tag `patchnotes` **ou** o título casar com `STEAM_NEWS_TITLE_PATTERN` (ex.: "Update v6.0.0.9b", "…Mastery Awakening Update & More!"). Posts de evento, manutenção ou convite do Discord não casam e ficam de fora.
- **Imagens dos posts da Steam:** a **miniatura** (lista do blog) é a arte do próprio post na Steam (a "PATCH NOTES" de cada atualização — lida da imagem de compartilhamento da página do post; se a Steam não devolver, usa a primeira imagem do texto) e o **banner do topo** do post é sempre a arte padrão do jogo (`NinWiki.Web/public/images/blog/steam-banner.webp`; troque o arquivo por uma versão melhor, ou aponte `STEAM_NEWS_BANNER_IMAGE` para outro caminho/endereço). Posts feitos à mão têm os dois campos no editor (*Imagem de capa* e *Banner do topo*; banner vazio = usa a capa). Para corrigir os posts já importados: **Atualizar posts já importados**.
- **Selo da Hitspark:** posts importados da Steam (`source_id` preenchido, exposto na API como `isSteam`) mostram a logo da desenvolvedora no canto da miniatura, da capa e do banner (só overlay, a imagem do banco não muda). Arquivo único: `NinWiki.Web/public/images/blog/hitspark-logo.webp` (montado a partir de `HitsparkMarkBody` + `HitsparkWordmark` da abertura do jogo, palavra em branco); componente `components/blog/official-badge.tsx`.
- **Importar um post específico (antigo ou sem a tag):** o importador automático só olha os **20 posts mais recentes** da Steam e só os marcados `patchnotes`; um post anterior ao sistema só entra se estiver nessa janela e com a tag. Para trazer **qualquer** post: no cartão *Notícias da Steam*, cole o **link do post** (`store.steampowered.com/news/app/1674010/view/<número>`, ou só o número) em *Importar um post específico* e clique **Importar este post**. Ele procura nos últimos 300 posts do jogo, ignora a tag, entra com a **data original** do post (ex.: 2017 aparece no lugar certo do blog) e avisa se não achar. Se o post **já foi importado**, ele é **atualizado** (conteúdo, resumo, capa e tradução; autor, tags e endereço ficam). Para refazer **todos** os já importados de uma vez (ex.: depois de uma correção no conversor, como as imagens `[img src=…]`), use o botão **Atualizar posts já importados**. Se o link não for achado, é porque a API da Steam não o devolve (só há o que o feed tem: o cartão mostra "lidos"). Para achar o link: abra o post na página de notícias da Steam e copie o endereço do navegador.
- **Se der problema:** troque `STEAM_NEWS_STATUS=draft` e reinicie: os próximos entram como rascunho. Se nada for importado, o cartão mostra "N lidos · 0 de atualização": a Steam não marcou os posts como `patchnotes` — esvazie `STEAM_NEWS_REQUIRE_TAG` para importar todos (e apague os que não servirem).
- **Direitos autorais:** o texto é da desenvolvedora; o crédito e o link do original ficam no topo de cada post. Confirme que você pode republicar.
- Na primeira ativação importa no máximo 5 posts (`STEAM_NEWS_MAX_PER_RUN`); clique em *Importar agora* de novo para trazer mais.


## Backup automático (banco + imagens) pelo bot
- **O que faz:** a cada 3 h (`BACKUP_INTERVAL_MINUTES=180`; mínimo 30) o bot pede à API um backup, recebe em partes e posta num **canal privado** do Discord, apagando os mais antigos (mantém `BACKUP_KEEP=8`). O backup leva **o banco inteiro** (menos `traffic_visitors` e `error_events`, descartáveis) **e todas as imagens da pasta `uploads/`**, num arquivo **criptografado com senha** (AES + HMAC; chave derivada por scrypt). Reiniciar o bot (deploy) **não** dispara backup extra: a hora do último fica em `backup_state.json`.
- **Ligar (passo a passo):**
  1. Gere uma senha: `python -c "import secrets; print(secrets.token_urlsafe(32))"` e **guarde num gerenciador de senhas** — sem ela o backup não abre e **não há como recuperá-la**.
  2. API (SquareCloud → *Variáveis de Ambiente*): `BACKUP_PASSPHRASE=<a senha>`. Rode o **Deploy API** (instala `cryptography`) e reinicie. Sem a senha a API recusa gerar (503).
  3. Crie um **canal privado** (só você/S.Adm) no Discord. Dê ao bot, **nesse canal**: *Ver canal, Enviar mensagens, Anexar arquivos, Ler histórico*. (O convite novo já inclui "Anexar arquivos"; o bot que já está no servidor precisa dessa permissão no canal.)
  4. Bot (SquareCloud → *Variáveis de Ambiente*): `BACKUP_CHANNEL_ID=<id do canal>`. Reinicie o bot: o primeiro backup sai em seguida.
- **Partes:** o Discord limita cada arquivo (10 MB em servidor comum), então o backup vem em partes `ninwiki-AAAAMMDD-HHMM.nbk.01-of-03`, `.02-of-03`... — a primeira mensagem diz quantas linhas, imagens e partes são.
- **Restaurar:** baixe **todas as partes** da mesma data para uma pasta; num banco novo rode `alembic upgrade head`; depois, na pasta `NinWiki.Api` com o `.env` apontando para o banco de destino: `python scripts/restaurar_backup.py C:\pasta\ninwiki-AAAAMMDD-HHMM.nbk.01-of-03 --confirmo` (pede a senha). Ele **apaga o conteúdo das tabelas** do destino, insere o do backup e copia as imagens para `uploads/`.
- **Cuidados:** o canal guarda dados pessoais (IDs do Discord, IPs do log) — mantenha-o privado; o arquivo só abre com a senha, mas quem tem acesso ao canal tem uma cópia dele. O backup **não** inclui os arquivos do quadro de avisos (`staff_files/`) nem segredos (`.env`). Testei o ciclo completo (criar, cifrar, decifrar, restaurar em outro banco, senha errada recusada) com dados de teste, não com a SquareCloud nem com o Discord de verdade.

## Mensagem "Latest updates" (webhook)
O bot mantém **uma** mensagem num canal com a versão mais recente da **API** e do **Web** (hash, título da atualização e "no ar desde"), e a **edita** a cada deploy (confere a cada 2 min; só edita quando o hash muda). Passo a passo: (1) no canal desejado, *Editar canal → Integrações → Webhooks → Novo webhook → Copiar URL*; (2) no bot, `VERSION_WEBHOOK_URL=<a URL>` (é segredo: só nas variáveis do bot); (3) rode **Deploy API**, **Deploy Web** e reinicie o bot. O deploy grava `VERSION.json` (hash, título do PR e data) e o site o expõe em `/version`; a API em `GET /bot/version`. Se apagarem a mensagem, o bot cria outra.

## Página de manutenção quando o Web é reenviado
Veja `Cloudflare/README.md`: um Worker da Cloudflare mostra uma página "Estamos atualizando a wiki" (que se recarrega sozinha) quando o app do Web está fora do ar, e some quando o deploy termina.
