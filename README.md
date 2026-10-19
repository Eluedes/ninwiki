# NinWiki

Wiki com painel administrativo (mais uma página extra do Guima). Projetos independentes na mesma pasta:

| Pasta | O que é | Tecnologia | Porta local |
|---|---|---|---|
| `NinWiki.Api` | API + banco (conteúdo, login, equipe, avisos, uploads) | Python, FastAPI, PostgreSQL | 8000 |
| `NinWiki.Web` | Site público + painel `/admin` | Next.js 16, React 18 | 3000 |
| `Guima.Site` | Página única "em construção" da Guima Company (Node sem dependências, segurança embutida; ver `Guima.Site/README.md`) | Node | 3100 |
| `NinWiki.Bot` | Bot de Discord (`/status`, `/search`, `/language`, log, erros e painel de status no canal) | Python, discord.py | — |

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
| `media.manage` | Renomear/apagar imagens do banco de imagens | S.Adm |
| `staff.view` | Ver a equipe | S.Adm (exclusiva) |
| `staff.create` | Cadastrar equipe | S.Adm (exclusiva) |
| `staff.edit` | Trocar cargo | S.Adm (exclusiva) |
| `staff.deactivate` | Desativar / reativar equipe | S.Adm (exclusiva) |
| `staff.delete` | Remover alguém da equipe | S.Adm (exclusiva) |
| `notices.view` | Ver avisos e baixar arquivos | Creator, Adm, S.Adm |
| `notices.manage` | Postar, editar e apagar avisos | Adm, S.Adm |
| `announcement.manage` | Editar o anúncio da Home | Adm, S.Adm |
| `roles.manage` | Editar permissões dos cargos | S.Adm (exclusiva) |
| `comments.moderate` | Moderar comentários e banir leitores | Adm, S.Adm |
| `reports.manage` | Ver e tratar os reports dos visitantes | Adm, S.Adm |
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
- **Itens:** no editor, o campo **Item type** tem Geral, **Wardrobe (Guarda-roupa)**, **Ring**, Consumível, Moeda, Cast, Authority e **Pack**; ao escolher **Wardrobe** aparece um 2º seletor com a peça — **Accessory, Shirt, Vest, Pant, Hat, Mask e Shoe** (o tipo gravado é a própria peça). O **Ring** tem categoria própria: opção direta no editor e filtro **Rings** no catálogo (o guarda-roupa tem o filtro **Wardrobe**). Todo equipamento (ring, acessório e roupas) mostra nível. **Pack** tem seu próprio filtro no catálogo de itens, Consumível, Moeda, Cast e **Authority** (itens de Autoridade do clã) — o tipo *Material* saiu da lista (só aparece em itens antigos que já o têm) e itens de **Moeda** ficam no filtro **Materials** do catálogo; raridades Common, Uncommon, Rare, Epic, Legendary, **Unique** (vermelha), **Enchanted**, **Premium** (laranja) e **Organization** (indigo; exige `alembic upgrade head`, migration `b4d6f8a0c1e3`). **Nível 0 = item/arma sem nível**: nada de "Level" aparece no site. O **Max Stack** ("Can hold max 500 per Stack") vale para Moeda, Authority, Consumível, Material e **Pack**. A página do item mostra a imagem grande sobre um brilho **na cor da raridade**, selos (tipo, raridade, nível) e uma ficha lateral com Detalhes/Atributos; os cards das listas têm brilho e selo de raridade. (Novos valores de raridade/tipo exigem `alembic upgrade head`, que o Deploy API já faz.)
- **Jutsu NPC:** no editor do jutsu, a caixa **Jutsu NPC** marca a versão do jutsu ensinada/usada por NPC (mesmo nome do jutsu de mastery ou de Utilidade — crie como um jutsu à parte). Ele **não tem nível, tier nem ficha de jogador**: ao marcar a caixa o editor esconde esses campos (e a *Short description*) e mostra só **nome, ID, Mastery, ícone, Cooldown, Cast Type, imagem/GIF e descrição completa**; a página pública mostra nome, ícone, imagem, descrição e uma seção com Cooldown e Cast Type. Esses jutsus **não aparecem em Masteries** (nem nas páginas das masteries, nem como card): só quem clica no **link direto** do jutsu (ex.: o ataque ligado em um monstro) ou abre `/masteries/npc`. Exige `alembic upgrade head`.
- **Jutsus de Utilidade (categoria Utility):** no editor do jutsu, o campo *Mastery* tem a opção **Utility (sem mastery — qualquer pessoa pode usar)**: o jutsu fica sem mastery e sem caminho. Na lista pública de masteries aparece um card **Utility** (só se houver pelo menos um jutsu assim) que leva para `/masteries/utility`, com a lista desses jutsus; no painel há o filtro *Utility*. Não existe uma mastery "Utility" no banco: é um jutsu com `mastery_id` vazio (exige `alembic upgrade head`).
- **Jutsus:** a página mostra a ficha em seções que abrem e fecham (Requisitos, Aquisição, Detalhes da técnica, Dados de batalha). No editor você preenche
  nível/atributo exigido, tipo de pergaminho + tier (**1 a 5**), nível máximo com **nome (opcional), dano e recarga por nível** (o nome por nível serve para jutsus que **mudam de nome** ao subir, ex.: no nível 4 — deixe vazio nos níveis em que o nome não muda; a **DeepL traduz o nome por nível** ao salvar — troque o nome em inglês e ele é retraduzido; sem mexer, a tradução é mantida; o botão *Retraduzir* também a refaz; a ficha mostra, dentro das listas de dano e recarga, uma linha-divisória **"A partir do nível 4: Great Fireball"** antes do nível em que o nome muda), tipo de conjuração, debuff e armas permitidas (os campos *Classe* e *Loja* saíram do formulário e da ficha; o ícone agora é um **dropdown** com prévia dos ícones disponíveis);
  linha vazia some da página.
- **Textos de ajuda nos formulários:** abaixo dos campos de texto de jutsu, conteúdo, vila e mastery há uma linha cinza explicando o campo (com exemplo). Os textos ficam em `NinWiki.Web/lib/field-hints.ts` (uma linha por campo, em inglês e português; campo sem entrada ali fica sem ajuda).
- **Banner do post do blog:** aparece **inteiro**, no tamanho real da arte (até 960 px) e centralizado, com a mesma arte desfocada preenchendo as laterais; a arte padrão (`public/images/blog/steam-banner.webp`) tem 960×311 px — para ficar mais nítida em telas grandes, troque por uma versão de 1920 px ou mais na mesma proporção.
- **Usando o Claude Code no VS Code:** o arquivo `CLAUDE.md` na raiz é lido automaticamente e traz as regras do projeto (idioma, comentários, testes, não mexer no banco de produção, README sempre em dia). Antes de encerrar qualquer mudança, rode `py scripts/verificar_readme.py` na pasta `NinWiki.Api`: ele confere variáveis, permissões, comandos do bot, migrações e telas citados aqui contra o código e também roda no GitHub (aba *Actions*) e dentro de `verificar_projeto.py`.
- **Telas do painel:** `/admin` (Visão Geral), `/admin/content` (conteúdo: itens, mobs, armas, missões, guias), `/admin/masteries`, `/admin/jutsus`, `/admin/import` (importar JSON e nomes novos do jogo), `/admin/translations`, `/admin/media`, `/admin/blog-posts`, `/admin/comments`, `/admin/reports`, `/admin/announcement`, `/admin/villages`, `/admin/organizations`, `/admin/staff`, `/admin/permissions`, `/admin/audit-log`, `/admin/errors` (cada uma só aparece para quem tem a permissão — veja a tabela acima).
- **Temas de cor do site (botão da paleta no topo):** **Laranja** (padrão — a cor do logo original do jogo, o `icon.png` do cliente ampliado para 256×256), Sangue, Canarinho, Ouro e Anil. Quem já escolheu um tema continua com o dele; quem nunca escolheu vê o laranja. O tema fica no navegador (`localStorage`). Cores em `app/globals.css` (`data-color-theme`), logos em `public/images/logo/nin-logo-{tema}.png` — todos são o **logo original do jogo**; nos outros temas só o **anel** muda para a cor do tema (a shuriken prateada fica igual); o favicon (`app/icon.png`) e a imagem de compartilhamento usam o logo laranja.
- **Seleção em massa por clique:** nas tabelas do painel (Conteúdo e Jutsus) e na grade do **banco de imagens**, clicar em **qualquer ponto** da linha/cartão marca ou desmarca (não precisa acertar a caixinha); **Shift+clique** marca o intervalo desde o último clique. Links, botões, campos e a própria caixinha continuam com a função deles. No banco de imagens só vale para quem tem `media.manage`. No banco de imagens a **barra de seleção** (Selecionar tudo, N marcadas, Aplicar categoria, Apagar) fica **fixa no topo ao rolar** a página e traz também os **botões Anterior/Próxima** (os de baixo continuam), então dá para trocar de página e confirmar a ação sem subir ou descer.
- **Navegação:** Menu lateral agrupado em seções recolhíveis — Wiki, Comunidade, Mundo, Sistema — e cabeçalho com breadcrumb + "Ver site", no estilo do CoreUI.
- **"Dropado por" (automático):** a ficha de um item/arma lista sozinha os mobs publicados que o dropam — vale o drop ligado ao item na página do mob e também o drop digitado com o mesmo nome do item. Nada é cadastrado à mão no item (a API calcula em `GET /content-items/{id}` e `/slug/{slug}`, campo `droppedBy`).
- **Reports dos visitantes:** toda página de conteúdo, jutsu e mastery tem o botão **Reportar** (sem login): o visitante escolhe *Informação desatualizada*, *Erro de tradução* ou *Outro* e descreve o problema. A equipe trata em **/admin/reports** (menu Comunidade; permissão `reports.manage`, padrão: Adm e S.Adm — o S.Adm pode liberar para o Creator em /admin/permissions): filtra por status/tipo, abre a página citada e marca como resolvido, descartado, reabre ou apaga (tudo vai para o log de auditoria). Defesas: só aceita a origem do site, limite de 3 por minuto e 20 por dia por IP, campo-isca anti-robô, texto simples de 10 a 1000 caracteres com no máximo 1 link, página conferida no banco (não aceita rascunho nem página inexistente), teto de 200 por hora no site todo e sem duplicados. O IP fica guardado só para barrar abuso e nunca aparece no painel. Reports resolvidos/descartados somem sozinhos depois de 60 dias (manutenção automática); os abertos nunca. **Requer a migração `d9c1e3f5a768` (Deploy API).**
- **Aviso de report no Discord:** quando chega um report novo, o bot posta um aviso azul no canal de erros (`ERROR_CHANNEL_ID`) com o tipo, a mensagem e o link da página; na primeira vez ele começa "a partir de agora" (não despeja o histórico). A API expõe isso em `GET /bot/reports` (só com o token do bot, sem IP).
- **Histórico de versões (conteúdo):** cada edição de uma página de conteúdo guarda o estado de antes (as últimas 25 por página). Na tela de edição, a seção **Versões anteriores** lista e permite **Restaurar** (mesmas regras de permissão da edição; restaurar também entra no histórico, então dá para desfazer). **Requer a migração `e1d3f5a7b982` (Deploy API).**
- **Cartão de link (Discord/WhatsApp/Google):** páginas de conteúdo, jutsu e mastery agora têm título, resumo e imagem de compartilhamento (a imagem da própria página, ou o logo do wiki se não houver). Depende de `NEXT_PUBLIC_SITE_URL` estar certo no build do site.
- **"Atualizado em" e selo de tradução automática:** a página de conteúdo mostra a data da última edição; em português, se o texto veio da tradução automática (DeepL) e ninguém revisou, aparece o selo **Tradução automática** (some quando alguém corrige/escreve o português no painel). Conteúdo antigo fica sem selo (não dá para saber de onde veio o português). **Requer a migração `f2e4a6b8c093` (Deploy API).**
- **Comparar itens/armas:** o botão **Comparar** na página de item/arma abre `/compare?a=&b=`: dois seletores com busca e uma tabela lado a lado (tipo, raridade, nível, dados da arma, stack e atributos), com as linhas diferentes destacadas. O link da comparação pode ser compartilhado.
- **Traduções oficiais do jogo:** em **/admin/translations** (menu Wiki; permissão `translation.import`, padrão: Adm e S.Adm) você escolhe o arquivo `…Brazilian_Portuguese-all-….json` exportado do Nin Online (formato `nin-online-translation`: texto em inglês → tradução). O wiki procura nos seus registros (conteúdo, jutsus, masteries, vilas, clãs e organizações) os textos em inglês que existem no arquivo — **acerto exato**, sem diferenciar maiúsculas — e preenche o português (`_pt`) com o texto oficial: nome, descrição, descrição completa, lore, sinergia, local de spawn, lema, clima e nome por nível do jutsu. Primeiro o botão **Ver o que vai mudar** mostra contagem por tipo, exemplos antes/depois e os nomes sem tradução oficial (para conferir a grafia); só depois **Aplicar**. Por padrão só preenche o que está **vazio** (ou veio da tradução automática); o português escrito à mão é mantido, a menos que você marque *Trocar também o português que já existe*. Descrições (campo rico) só são trocadas quando o texto inteiro bate (ou todos os parágrafos), no mesmo formato do campo. Dá para rodar de novo a cada atualização do jogo (é idempotente). O arquivo em **English** não precisa ser importado (os textos à esquerda e à direita são iguais): a tela recusa arquivo de outro idioma. Fica no log de auditoria.
- **Nomes novos do arquivo do jogo (em /admin/import):** escolha o arquivo em **inglês** (e, junto, o de Brazilian Portuguese para trazer o nome oficial em português) e o wiki lista os textos que **parecem nomes** (curtos, sem pontuação de frase, sem rótulos de tela como "Click to hide") e que você **ainda não tem** — compara com o nome e o slug de todo o conteúdo (rascunho ou no ar) e com jutsus, masteries, vilas, clãs e organizações. Dá para filtrar, esconder o que parece jutsu (`…Technique`, `(NPC)`), marcar e escolher a categoria; os marcados viram **rascunhos** pelo mesmo import em massa, já com o nome oficial em português. **A lista é um palpite**: o arquivo do jogo não diz o que é item, mob, NPC, lugar ou texto de tela — confira antes de criar. Duplicados são pulados.
- **Cache nas leituras públicas (API):** `GET` de conteúdo, masteries, jutsus, vilas, organizações, guias, anúncio, tags e atributos, feitos por quem chega **sem cookie/token**, recebem `ETag` + `Cache-Control: public, max-age=5` (só 5 segundos, para uma página despublicada/corrigida sumir logo) e respondem **304** (sem corpo) quando nada mudou — inclusive com ETag "fraco" (`W/`) de proxy/CDN. Quem está logado na equipe sempre recebe a resposta fresca (com rascunhos) e nunca vai para o cache (`Vary: Cookie, Authorization, X-Bot-Token`); erros, respostas que definem cookie e rotas sensíveis nunca ficam em cache; as rotas são comparadas por segmento inteiro. **Limite:** o 304 economiza só o tráfego — a API ainda executa a rota (consulta ao banco) e conta no limite de uso; o site em si busca dados no servidor, então a diferença nele é pequena.
- **Bot — `/drop` e `/patchnotes`:** `/drop item` lista os mobs que dropam o item e a chance de cada um; `/patchnotes` mostra as 3 notícias mais recentes do blog; `/search` e `/drop` sugerem nomes enquanto você digita (autocompletar). Rotas novas só-leitura da API do bot: `/bot/suggest`, `/bot/drops`, `/bot/latest-posts`.
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
- **Mapa:** está **em manutenção** — sai do menu e qualquer `/map` vai para `/maintenance`. Para liberar, esvazie `MAINTENANCE_PATHS` em `NinWiki.Web/lib/maintenance.ts`.
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
**Painel de status ao vivo** (`STATUS_PANEL=true`, padrão): uma mensagem **📡 NinWiki status** no canal do monitor (`STATUS_CHANNEL_ID`; vazio = o de erros), **editada a cada checagem** (online/offline, ms, uptime desde que o bot ligou; o banco aparece como "unknown" se a API estiver fora). Mensagens novas de "caiu/voltou" ficam **desligadas** por padrão (o painel basta); ligue com `STATUS_ALERTS=true`. O site conta como no ar se **responder** (qualquer status abaixo de 500; 403 da Cloudflare incluso); 5xx, timeout, erro de conexão e redirecionamento em loop contam como fora do ar, e o motivo vai para o log do bot.
Anti-spam: o 1º aviso sai na hora; se o mesmo problema continua, só um novo aviso a cada 10 min (com "+N desde o último").
Problema marcado como resolvido no painel não é repostado (se voltar a acontecer, reabre). Detalhes e traceback: `/admin/errors`.

Como ligar:
1. Crie o(s) canal(is) só para a equipe e copie o ID (Modo Desenvolvedor → botão direito no canal → *Copiar ID*).
2. Dê ao bot, **nesses canais**, *Ver canal*, *Enviar mensagens* e *Inserir links*.
3. No `.env` do bot: `LOG_CHANNEL_ID`, `ERROR_CHANNEL_ID`, `SITE_URL=https://wiki.seudominio.com` (opcional: `LOG_POLL_SECONDS`,
   `HEALTH_POLL_SECONDS`, `LOG_IGNORE_ACTIONS=login,logout`).
4. Reinicie o bot. Ele guarda onde parou em `log_state.json` e `error_state.json` (não repete nem perde avisos ao reiniciar).
Se o **próprio bot** ou a SquareCloud inteira caírem, ninguém avisa — vale ter também um monitor externo (ex: UptimeRobot) no `/health/ready` da API.

### 2.2c Acessos ao site (Visão Geral do painel)
A Visão Geral mostra um **gráfico de acessos** (7/30/90 dias: visualizações e visitantes), os **países que mais acessam** (bandeira, barra e %) e as páginas mais vistas — só para quem tem a permissão `analytics.view` (grupo Log; ajuste em *Permissões*).
- **Privacidade:** só contagens por dia/país/página. Sem cookies e sem guardar IP; o "visitante único" é um hash com sal diário que é **apagado em 2 dias**. Robôs e o painel (`/admin`) não contam.
- **País:** vem do cabeçalho `CF-IPCountry` da **Cloudflare** (precisa de `TRUST_PROXY_HEADERS=true`) ou do banco offline **DB-IP Lite** (CC BY 4.0), que o deploy da API baixa sozinho para `NinWiki.Api/geoip/country.mmdb`. Sem nenhum dos dois, os acessos aparecem como "Desconhecido".
- Nova migration (`alembic upgrade head`) — o deploy da API já roda.
- A página **Mapa** está em manutenção: sai do menu e qualquer `/map` vai para `/maintenance` (edite `lib/maintenance.ts` para liberar).

### 2.2d Convidar o bot e anúncio da Home
- **Banco de imagens** (`/admin/media`, menu *Images*): toda imagem enviada (aqui, pelo campo de imagem ou pelo editor) ganha um **ID** (#1, #2...). Nos campos de imagem de
  **conteúdo, blog (capa), jutsu, mastery, vila e clã** dá para digitar o ID — `img:12`, `#12` ou só `12` — e a API troca pelo endereço do arquivo ao salvar (ID que não existe = erro claro).
  **Arrastar e soltar:** solte uma ou várias imagens da sua pasta em qualquer lugar da tela *Images* (ou dentro da janela *Image library*) e elas sobem juntas, 3 por vez, com andamento ("Enviando 2/5"); o que não for imagem é ignorado e uma imagem com erro não cancela as outras. Nos campos de imagem, soltar um arquivo usa a primeira imagem.
  Cada campo de imagem também tem o botão **Image library** (escolher numa grade com **filtro de categoria** — sem contagem; "Todas" por padrão, só as categorias que o seu cargo pode ver — e busca por nome/ID, ou enviar na hora) e o editor do blog tem um botão para inserir imagem do banco.
  A tela mostra miniatura, tamanho, ID com **Copiar ID / Copiar endereço**; para apagar várias de uma vez marque as caixinhas (ou *Select all on this page*) e use **Delete selected** (as que estão em uso pedem uma segunda confirmação); quem tem `media.manage` (S.Adm por padrão) renomeia, apaga (avisa onde a imagem está em uso; precisa confirmar para apagar mesmo assim)
  e usa **Import from the uploads folder** para dar ID às imagens que já estavam em `uploads/` (a primeira abertura da tela já importa sozinha se o banco estiver vazio). Ver = `uploads.create`. Migration nova: `7b16dcfc1960`.
  **Categorias e páginas:** a tela mostra **100 imagens por página** (Anterior/Próxima) e tem botões de filtro por categoria com a contagem (`weapon`, `gear`, `consumable`, `currency`, `material`, `ring`, `scroll`, `npc`, `monster`, `furniture`, `hair_beard` (Cabelo/Barba), `skin` (Skins), `tools` (Ferramentas), `closed`, `other` e *Sem categoria*; **não existe mais "Todas"**: a tela abre em *Sem categoria*, e a busca por texto procura em todas as categorias visíveis). Escolha a categoria dos novos envios no seletor ao lado do botão de enviar; arquivos nomeados `categoria__nome.png` (o script `imagens_em_folhas.py` gera assim) já entram com a categoria e o nome certos (ex.: `weapon__sword_2.png` → categoria Weapons, nome `sword_2`). Só quem tem `media.manage` — **por padrão apenas o S.Adm** (ele pode liberar em *Admin → Permissions*) — renomeia, apaga, escolhe/muda a categoria (a categoria enviada por quem não tem essa permissão é ignorada) e importa da pasta; muda a categoria de uma imagem pelo seletor do cartão, ou de várias (marque e use *Mudar categoria...* + *Aplicar*). Migration: `c4e8a1d92f37` (rode o **Deploy API** antes do Web). A categoria **`clothing` virou `gear`** (Equipamentos/Gear, igual ao Nin Atlas) — migration `a3f5b7c9d0e2` renomeia as imagens, a permissão `media.cat.gear` e os cargos personalizados.
  **Quem pode enviar pelo banco de imagens:** a permissão nova **`media.upload`** (*Enviar imagens pelo banco de imagens*). **Por padrão só o S.Adm**; em *Admin → Permissions* o S.Adm libera para Adm ou Creator quando quiser (também para cargos personalizados). **Categoria `closed`** (permissão exclusiva `media.closed`, só S.Adm): as imagens dela são privadas — só o S.Adm vê o botão, a lista, a contagem e o seletor; para qualquer outro cargo elas não existem (somem da lista/contagem/busca e dão 404). **Trancar categorias por cargo:** cada categoria (inclusive *Sem categoria*) tem uma permissão própria — `media.cat.weapon`, `media.cat.gear`, ..., `media.cat.hair_beard`, `media.cat.skin`, `media.cat.tools`, `media.cat.none` — num grupo *Categorias do banco de imagens* em *Admin → Permissions*. Por padrão Adm e Creator (e cargos personalizados) **veem todas**; o S.Adm **tranca** uma categoria para um cargo desmarcando a caixinha. Para quem está trancado a categoria se comporta como a `closed`: some da lista, da contagem, dos botões e da busca, e tentar abrir uma imagem dela dá o aviso de acesso negado. `closed` continua exclusiva do S.Adm (não dá para liberar). Observação: quem não tem `media.manage` envia imagens sem categoria; se *Sem categoria* estiver trancada para esse cargo, ele não verá o que enviou.
  **Aviso de acesso negado:** quem não é S.Adm e tentar ver essa imagem — chutando o ID (`GET /media/12`), filtrando por `closed`, usando `img:12` num campo de imagem, ou renomeando/apagando/mudando categoria — recebe **403 com a mensagem "Access denied: this image is in a closed (restricted) category..."**; a *busca por nome ou ID* que bater com uma imagem closed não mostra nada dela, mas exibe um aviso amarelo ("você não tem acesso para ver essa informação"). Isso confirma que algo existe com aquele ID/nome (é o comportamento pedido). Limite: o arquivo em `/uploads/...` é público para quem souber o endereço exato (nome aleatório de 32 caracteres) — `closed` protege o *painel e a API*, não é cofre.
  **Resetar IDs** (botão só do S.Adm, permissão exclusiva `media.reset_ids`): renumera todas as imagens a partir do #1 mantendo a ordem (a mais antiga vira #1) e ajusta a contagem; com a biblioteca vazia a contagem volta para #1. Os arquivos e o conteúdo já salvo não mudam (o conteúdo guarda o endereço, não o ID); só quem digitou um ID e ainda não salvou perde a referência. Para recomeçar do zero: apague as imagens (S.Adm) e clique em *Resetar IDs*.
  O envio pelos **campos de imagem** dos formulários (`uploads.create`) não mudou: Creator/Adm continuam enviando a imagem do próprio conteúdo.
- **Categorizar o banco de imagens pelo Nin Atlas:** `python scripts/sincronizar_imagens_atlas.py` (na pasta `NinWiki.Api`, com `$env:PYTHONPATH="."`) olha as imagens `N_item`/`N_fundo` (o N é o número do **ícone** no cliente do jogo — **não** é o ID do item no [Nin Atlas](https://nin-atlas.vercel.app): a ligação é feita **comparando as imagens pixel a pixel**, `scripts/atlas_icones.py`) que **ainda estão sem categoria** e põe a categoria pelo tipo do item (arma → `weapon`; roupas e acessórios → `gear`; anel → `ring`; consumível → `consumable`; moeda → `currency`; manual/pergaminho → `scroll`; mobília → `furniture`; o resto → `other`). Imagem cujo ícone **nenhum item do Atlas usa** vai para `closed` (só S.Adm). **Não mexe em imagem que já tem categoria**, a menos que você use `--corrigir-divergentes`, que corrige só as que contradizem o tipo do Atlas (ex.: anel em `furniture`; `closed` nunca é mexida). No Atlas "Currency" é quase tudo loot de mob, então vira `material` (só Ryo/Token/Coin/Coupon são `currency`) e `Cast` (shuriken, kunai, pílulas) vira `consumable`. Também cria `N_item`/`N_fundo` para os itens do Atlas que faltam no banco, lendo o `{id}.znin` da pasta do cliente do jogo (`--cliente`); itens que não têm ícone na pasta do cliente são pulados. Sem `--aplicar` é só **simulação**; recusa banco que não seja local, a menos que use `--permitir-remoto` (faça um backup antes).
- **Importar os monstros do Nin Atlas:** `python scripts/importar_mobs_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`) traz os **monstros que lutam** do [Nin Atlas](https://nin-atlas.vercel.app) (nível, dano, XP, respawn, alcance, tipo Monster/Boss, drops e retrato). Mob que o wiki **já tem** (mesmo nome) só recebe o que está **vazio** — a vida que você digitou fica; mob que não existe vira **rascunho**; **nada é publicado** (a menos que use `--publicar`, que publica só os monstros que o Atlas cobre). Os drops são ligados aos itens do wiki pelo nome ("Over 10%" / "Below 1%", como o jogo mostra) e só entram em mob que ainda não tem drops. A **vida** não existe no Atlas: fica vazia. O retrato é o 1º quadro da folha de sprites (`Characters/{sprite}.png`, 16×4 quadros), recortado e ampliado 4×, e vai para o banco de imagens na categoria `monster` (`--personagens` muda a pasta). Sem `--aplicar` é só simulação; recusa banco que não seja local, a menos que use `--permitir-remoto` (faça um backup antes).
- **Importar os itens do Nin Atlas:** `python scripts/importar_itens_atlas.py` (pasta `NinWiki.Api`, `$env:PYTHONPATH="."`) — rode **depois** do `sincronizar_imagens_atlas.py`. Item/arma que o wiki **já tem** (mesmo nome) só recebe o que está **vazio** (tipo, nível, descrição, a imagem do **ícone certo** do banco de imagens (`N_item`, achada por `atlas_icones.py` — o ID do item no Atlas não é o do ícone; `--corrigir-imagens` troca as imagens ligadas errado pelas primeiras versões deste script), stack e, nas armas, dano base e requisito de Strength); a raridade só muda em **rascunho** que ainda está em Common. O que não existe vira **rascunho**; **nada é publicado** (a menos que use `--publicar`, que publica só as páginas que o Atlas cobre — nunca os outros rascunhos). Arma do Atlas em rascunho passa de Items para Weapons; tipos sem categoria própria (Manual, Recipe, Furniture...) ficam `general`; nomes repetidos (variantes) viram uma página só. No fim liga os drops dos mobs que estavam soltos ao item de mesmo nome. **Não importa** bônus de atributo, vida/chakra/crítico, requisitos que não são Strength, receitas nem lojas. Sem `--aplicar` é só simulação; recusa banco que não seja local, a menos que use `--permitir-remoto` (faça um backup antes).
- **Mandar banco + imagens para a produção de uma vez:** `python scripts/enviar_para_producao.py preparar` (pasta `NinWiki.Api`, Docker ligado, `$env:PYTHONPATH="."`). Ele **não mexe** no seu banco local nem na produção: copia o banco local para um banco temporário, troca `http://localhost:8000` por `https://api.guima.net` em todas as colunas de texto/JSON (sem isso as imagens ficam quebradas na produção), gera `envio/ninwiki-producao.dump` e junta as imagens **novas** (ID maior que `--desde-id`, padrão 4799 = o que a produção já tinha) em `envio/imagens.zip`. Depois: (1) backup da produção e **Deploy API** (migrations) antes; (2) o comando `migrar_banco.py importar envio/ninwiki-producao.dump ...` que o `preparar` imprime — ele **substitui as tabelas** da produção, então vale só se ninguém editou lá desde o backup (confira em `/admin/audit-log`); (3) `python scripts/enviar_para_producao.py enviar-imagens --teste` e depois `--confirmo` (precisa de `SQUARE_API_KEY` e `SQUARE_APP_ID_API`; envia o zip para dentro do app da API com o mesmo envio do deploy, sem reiniciar). Sem chave, suba o `envio/imagens.zip` pelo painel do app. A pasta `envio/` não vai para o Git nem para a produção.
- **Converter as imagens do cliente do jogo (`.znin`) em PNG:** `python scripts/decodificar_znin.py` (pasta `NinWiki.Api`, venv ativado). O `.znin` **não é criptografia**: é um PNG comprimido com **LZ4** (4 bytes de assinatura + 4 bytes com o tamanho original + o bloco LZ4), então o PNG sai **idêntico ao original**. O script **só lê** a pasta do cliente (`--origem`, padrão `E:\Nin Online - Wiki\data files\graphics`) e grava na pasta de destino (`--destino`, padrão `Wiki-Image\graphics_png`), com as mesmas subpastas; confere o tamanho, a assinatura PNG e se a imagem abre, e lista o que falhar. Rode de novo a cada atualização do jogo (`--forcar` regrava o que já existe).
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

> ⚠️ **Domínio próprio é o recomendado.** O login usa cookie `SameSite=Lax`: o site e a API precisam estar no **mesmo site**
> (`wiki.seudominio.com` + `api.seudominio.com`). Com os endereços `*.squareweb.app` (ex.: `ninwiki.squareweb.app` + `ninwiki-api.squareweb.app`)
> o navegador pode tratá-los como sites diferentes e **o login não persiste**. Para **testar sem domínio**, ponha `COOKIE_SAMESITE=none` no `API_ENV`
> (funciona em Chrome/Edge/Firefox; o Safari e navegadores que bloqueiam cookies de terceiros continuam sem funcionar). Com domínio próprio, deixe o padrão (`lax`).
> O domínio personalizado pode depender do plano da SquareCloud — confira no painel.

### 3.1 Antes de começar: contas e segredos
Você vai precisar de:
- conta na **SquareCloud** com plano que comporte 2–3 apps + 1 banco (API 512 MB, site 512 MB, bot 256 MB);
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

**Modelo do `API_ENV`** (troque tudo que está em MAIÚSCULAS/`seudominio`):
```env
ENVIRONMENT=production
# ATENÇÃO: começa com postgresql+asyncpg:// (com o +asyncpg) e TERMINA com /NOME_DO_BANCO (o nome do banco do painel; costuma ser igual ao usuário)
DATABASE_URL=postgresql+asyncpg://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO
DATABASE_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----   # texto do .crt (veja o passo a passo acima)
DATABASE_SSL_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----  # texto do .pem
DATABASE_SSL_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----       # texto do .key
JWT_SECRET_KEY=COLE_O_PRIMEIRO_SEGREDO_GERADO
FRONTEND_ORIGIN=https://wiki.seudominio.com
API_BASE_URL=https://api.seudominio.com
DISCORD_CLIENT_ID=SEU_CLIENT_ID
DISCORD_CLIENT_SECRET=SEU_CLIENT_SECRET
DISCORD_REDIRECT_URI=https://api.seudominio.com/auth/discord/callback
SUPER_ADMIN_DISCORD_IDS=SEU_DISCORD_ID
DEV_LOGIN_ENABLED=false
TRUST_PROXY_HEADERS=true
# COOKIE_SAMESITE=none   # só se usar os endereços *.squareweb.app em vez de domínio próprio (ver aviso da 3.0)
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
NEXT_PUBLIC_API_URL=https://api.seudominio.com
NEXT_PUBLIC_SITE_URL=https://wiki.seudominio.com
NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID=ID_DA_APLICACAO_DO_BOT   # liga o botão "Convidar o bot" (ver 2.2d)
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
   `aplicando migrations...` e depois `iniciando API na porta 80...`. Teste `https://api.seudominio.com/health` (depois do 3.8; antes
   disso use o endereço `*.squareweb.app` do app só para testar).
2. **Deploy Web na SquareCloud (manual)** → o site é **compilado no próprio GitHub** (leva 2–4 min no workflow) e só o resultado vai para a SquareCloud, que apenas executa `node server.js` (uns 200 MB de RAM). Nos Logs do app deve aparecer `Ready`. (Compilar dentro da SquareCloud estoura a memória e o processo morre com `Killed` — por isso não fazemos assim.)
3. **Deploy Bot na SquareCloud (manual)** (opcional) → Logs: o bot conecta e, os comandos aparecem na hora nos servidores de `ALLOWED_GUILD_IDS`/`DEV_GUILD_ID` (sem nenhum deles, em até 1 h em todos).

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
| `COOKIE_SAMESITE` | `lax` | `none` só se usar `*.squareweb.app` em vez de domínio próprio |
| `DISCORD_CLIENT_ID` / `_SECRET` / `DISCORD_REDIRECT_URI` | vazio | login com Discord |
| `FRONTEND_ORIGIN` / `API_BASE_URL` | localhost | endereços públicos do site e da API (CORS, CSRF, links de arquivos) |
| `DEEPL_API_KEY` | vazio | tradução EN→PT (chaves grátis terminam em `:fx`) |
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
| `LOGIN_REQUESTS_PER_MINUTE` / `LOGIN_FAIL_LIMIT` / `LOGIN_FAIL_WINDOW_MINUTES` / `BOT_FAIL_LIMIT` | `30` / `5` / `15` / `10` | freios do login e do token do bot |

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
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | endereço público do site: sitemap, RSS, links, vídeos da Twitch (entra no build) |
| `NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID` | vazio | Application ID do **bot** (público, não é segredo): liga o botão "Convidar o bot" no rodapé e na Home; vazio = botão escondido (entra no build) |
| `WEB_RATE_LIMIT_PER_MINUTE` | `300` | páginas por minuto por IP (`proxy.ts`) |
| `BLOCK_SCRAPER_UAS` | `true` | bloqueia robôs de cópia conhecidos |

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
| `SITE_URL` | vazio | site público: vigiado pelo bot **e** usado nos botões *Open* do `/search` |
| `BACKUP_CHANNEL_ID` / `BACKUP_INTERVAL_MINUTES` / `BACKUP_KEEP` / `BACKUP_PART_MB` | vazio / `180` / `8` / `9` | backup automático no canal privado: de quantos em quantos minutos (mín. 30), quantos manter, tamanho de cada parte (ver *Backup automático*); canal vazio = sem backup |
| `VERSION_WEBHOOK_URL` | vazio | webhook da mensagem *Latest updates* (versão da API e do Web, editada a cada deploy). É segredo |
| `SITE_HEALTH_URL` | vazio | (opcional) endereço **só** da checagem de saúde, ex.: `https://ninwiki.squareweb.app` (direto da hospedagem, sem Cloudflare/cache na frente); vazio = checa o `SITE_URL` |
| `STATUS_CHANNEL_ID` | vazio | canal **só do monitor** (painel "NinWiki status" + avisos de API/banco/site caiu/voltou), separado dos erros do wiki; vazio = usa o `ERROR_CHANNEL_ID` |
| `STATUS_ALERTS` | `false` | `true` = além do painel, manda uma mensagem **nova** a cada "caiu" / "voltou" (padrão: só o painel, que se edita sozinho) |
| `STATUS_DOWN_AFTER` | `3` | checagens seguidas que precisam falhar para avisar "caiu" (suba para 5 se a rede oscila e o bot avisa demais) |
| `STATUS_PANEL` | `true` | mensagem **📡 NinWiki status** editada a cada checagem; `false` = só avisa queda/volta |
| `LOG_SHOW_IP` | `true` | mostra o IP de quem agiu no canal de log (canal só da equipe); `false` = não mostra |
| `HEALTH_POLL_SECONDS` | `60` | intervalo da checagem de API/banco/site (mín. 30) |
| `LOG_POLL_SECONDS` | `20` | intervalo do feed do log (mín. 10) |
| `LOG_IGNORE_ACTIONS` | vazio | ações fora do canal (ex.: `login,logout`) |

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
- `NinWiki.Api/app/api/analytics.py` + `core/geoip.py` = acessos anônimos e país; `app/api/bot.py` = rotas do bot (equipe, log, erros, busca).


## Importador de notícias da Steam (blog automático)
- **O que faz:** a cada 30 min (`STEAM_NEWS_INTERVAL_MINUTES`) a API pergunta à API pública da Steam (`ISteamNews/GetNewsForApp`, sem chave) pelas notícias do jogo, fica só com as marcadas `patchnotes` que ainda não foram importadas (o `gid` da Steam vai em `posts.source_id`, único: nunca duplica) e cria o post no blog: título e data da Steam, texto convertido para o editor (negrito, links, listas, citações, imagens), **tag Patch Notes**, **por/by = a desenvolvedora** e um **crédito no topo** com o link do post original ("Originally published on Steam…"). Imagens usam o endereço da Steam; a primeira vira a capa; a DeepL traduz para PT como em qualquer post.
- **Ligar (passo a passo):** (1) no app da **API** (SquareCloud → *Variáveis de Ambiente*) crie `STEAM_NEWS_APP_ID=1674010` e `STEAM_NEWS_AUTHOR_NAME=<nome da desenvolvedora>` (`STEAM_NEWS_STATUS=published` já é o padrão); (2) rode o **Deploy API** (migration `d7a2b9c4e150`) e reinicie; (3) no painel, *Blog posts* ganha o cartão **Notícias da Steam** com o botão **Importar agora** e o resultado da última conferência (só quem tem `posts.publish`).
- **Não importou nada? Diagnóstico:** no cartão *Notícias da Steam* clique em **Importar agora**: ele mostra `N lidos · M de atualização · K importados`, os erros (se houver) e, quando nada foi importado, **a lista de títulos e tags que a Steam devolveu**. Se o cartão nem aparece: `STEAM_NEWS_APP_ID` não está nas variáveis da **API**, a API não foi reiniciada/redeployada, ou o Web ainda é a versão antiga. Se aparecem posts mas nenhum com a tag `patchnotes`: a Steam não marcou o post de hoje assim — esvazie `STEAM_NEWS_REQUIRE_TAG` (e reinicie a API) para importar todos. O log da API também registra cada conferência ("Steam news: N lidos, M com a tag...").
- **Posts "Atualização regular" sem a tag:** o importador aceita um post se ele tiver a tag `patchnotes` **ou** o título casar com `STEAM_NEWS_TITLE_PATTERN` (ex.: "Update v6.0.0.9b", "…Mastery Awakening Update & More!"). Posts de evento, manutenção ou convite do Discord não casam e ficam de fora.
- **Imagens dos posts da Steam:** a **miniatura** (lista do blog) é a arte do próprio post na Steam (a "PATCH NOTES" de cada atualização — lida da imagem de compartilhamento da página do post; se a Steam não devolver, usa a primeira imagem do texto) e o **banner do topo** do post é sempre a arte padrão do jogo (`NinWiki.Web/public/images/blog/steam-banner.webp`; troque o arquivo por uma versão melhor, ou aponte `STEAM_NEWS_BANNER_IMAGE` para outro caminho/endereço). Posts feitos à mão têm os dois campos no editor (*Imagem de capa* e *Banner do topo*; banner vazio = usa a capa). Para corrigir os posts já importados: **Atualizar posts já importados**.
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
