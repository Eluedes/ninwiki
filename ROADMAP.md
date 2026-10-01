# Roadmap — NinWiki

Documento de controle do projeto, no mesmo espírito do roadmap do Guima:
uma lista viva do que já foi feito e do que falta, organizada em fases.
Atualizar isso a cada rodada de trabalho, marcando o que mudou.

**Última atualização:** 02/10/2026 (erros no Discord, inglês + DeepL em tudo)

**Legenda:** ✅ feito e testado · 🔄 em andamento / parcial · ⬜ não iniciado

---

## Fase 0 — Ambiente local
- ✅ Monorepo `NinWiki.Web` (Next.js) + `NinWiki.Api` (FastAPI) num repositório só
- ✅ Docker Compose com Postgres 16 + Adminer
- ✅ `.env` / `.env.example` com todas as variáveis (banco, JWT, Discord OAuth, frontend origin)
- ✅ Porta do Postgres em **5433** (não 5432) — evita conflito com um Postgres nativo já instalado nesta máquina (usado pelo Guima)
- ✅ Python 3.12 fixado (3.14 tem incompatibilidade de wheels com asyncpg/greenlet)
- ✅ Next.js atualizado de 13.5.1 → 16.3.5 (`npm audit`: 0 vulnerabilidades)

## Fase 1 — Modelagem de dados
- ✅ 19 tabelas SQLAlchemy criadas e migradas de verdade no Postgres local:
  `content_items` (+ attributes/drops), `masteries`/`mastery_paths`/`jutsus`/`attributes`,
  `villages`/`clans`/`organizations`, `professions`/`ninja_ranks`/`story_arcs`/`summons`,
  `users`/`audit_log`, `posts`
- ✅ Alembic configurado (`load_dotenv()`, driver `psycopg` v3 — não `psycopg2`, que tem bug
  de decodificação de erro em português no Windows)
- ✅ Testado ciclo completo `upgrade` → `downgrade` → `upgrade` sem erro (incluindo limpeza
  manual dos tipos ENUM do Postgres, que o autogenerate do Alembic não remove sozinho)
- ✅ **Script de seed** — `NinWiki.Web/scripts/export-seed-data.ts` exporta o conteúdo mockado
  do front pra JSON, `NinWiki.Api/app/seed.py` popula as 19 tabelas. Testado de verdade:
  15 entries, 8 masteries, 17 jutsus, 3 vilas, 6 clãs, 10 caminhos — com JOIN real confirmando
  jutsu → mastery → caminho conectado certinho

## Fase 2 — Autenticação e cargos 🔄 QUASE COMPLETA
Cargos da equipe: **S.Adm** (dono), **Adm** e **Creator**. Guia de uso local: `FASE2_LOCAL.md`.
- ✅ **Login Discord OAuth2**: só entra quem está cadastrado na equipe (ter uma conta do Discord não dá
  acesso); `state` anti-CSRF; redireciona sempre pro `FRONTEND_ORIGIN` fixo (sem open redirect)
- ✅ **Sessão**: JWT em cookie `httpOnly` + `SameSite=Lax` (+ `Secure` fora do local), **conferida no banco a
  cada requisição** — desativar alguém ou trocar o cargo derruba a sessão na hora (`token_version`).
  Decisão: sem refresh token, desnecessário quando a API consulta o banco em toda chamada
- ✅ **Donos pelo `.env`** (`SUPER_ADMIN_DISCORD_IDS`): viram S.Adm no primeiro login, não podem ser
  rebaixados nem desativados pelo painel/bot; nunca sobra zero S.Adm ativo
- ✅ **Tabela única de permissões** (`app/core/permissions.py`, 15 permissões): nenhum endpoint compara
  cargo por texto, todos pedem uma permissão. **Creator**: cria/edita **rascunhos**, upload, retraduz.
  **Adm**: + publica, apaga, importa, edita Masteries/Jutsus, vê o log de conteúdo, gerencia **só Creators**.
  **S.Adm**: tudo, gerencia todos
- ✅ **Permissões exclusivas do S.Adm, invisíveis pros outros** (`SUPER_ONLY_PERMISSIONS`: quem não é S.Adm
  recebe 404 e a permissão nem aparece em `/auth/me`). A primeira: `audit.view_all` (log completo). O
  mecanismo pra criar mais já existe
- ✅ **Toda rota que altera dado passou a exigir permissão** (antes **nenhuma** exigia). Rascunhos ficaram
  invisíveis pro público (antes vazavam por `?status=draft` e por slug). Creator não mexe em entry já
  publicada nem publica
- ✅ **Painel**: guarda em `app/admin/layout.tsx` (sem sessão → `/login`; sem permissão → "sem acesso"),
  menu filtrado por cargo (`lib/admin-routes.ts`), header com o usuário real + sair, `/login` real (com
  "login de desenvolvimento" só em ambiente local)
- ✅ **Tela Equipe** (`/admin/staff`) + API `/staff`: cadastrar, trocar cargo, desativar/reativar, com
  hierarquia (Adm só mexe em Creator, ninguém altera a si mesmo). Substitui a antiga tela mockada de Users
- ✅ **Log geral** (`audit_log` estendido): quem (nome + cargo naquele momento), o quê, origem
  (painel/bot/login) e IP (só o S.Adm vê o IP). Registra login/logout, login negado, mudanças de equipe,
  uploads e tentativas sem permissão. Tela `/admin/audit-log` com filtro por tipo (S.Adm)
- ✅ **NinWiki.Bot** (discord.py, mesma stack do Guima.Bot): `/equipe listar|adicionar|cargo|desativar|
  reativar`. Sem regra própria — repassa quem digitou e a API decide, com as mesmas regras do painel;
  respostas efêmeras, sem intents privilegiadas, `ALLOWED_GUILD_IDS` opcional. Contrato em
  `NinWiki.Bot/README.md`
- ✅ **Testes de segurança automatizados**: `scripts/testar_permissoes.py` (121 verificações: sessão
  forjada/expirada/`alg:none`, CSRF, promoção indevida, bot com token errado, login do Discord simulado, e
  **auditoria de todas as rotas da API** — rota nova sem proteção faz o teste falhar) e
  `scripts/testar_bot_integracao.py` (39: o código real do bot contra a API real). Ambos testados por
  mutação (quebrei regras de propósito e o teste acusou)
- ⬜ **Testar de verdade com o Discord**: login real e bot num servidor real — o ambiente onde isso foi
  desenvolvido não alcança o Discord, então só foi testado com Discord simulado
- ✅ **Limite de tentativas** (`app/core/rate_limit.py`): por IP, janela deslizante em memória. 30 chamadas/min no
  login; 5 logins negados (ou `state` forjado) em 15 min bloqueiam **antes** de chamar o Discord ou gravar no log
  (impede encher o log de segurança); 10 tokens de bot errados em 10 min bloqueiam até o token certo. Por
  processo (uma instância só = exato); atrás de proxy ligar `TRUST_PROXY_HEADERS=true`
- ⬜ Mais permissões exclusivas do S.Adm, conforme forem surgindo (o mecanismo já existe)

## Fase 3 — API pública ✅ COMPLETA
- ✅ **`content_items` (mobs/itens/armas/missões/guias) — CRUD completo e testado**:
  `GET /content-items` (com filtros `?category=` e `?status=`), `GET /{id}`,
  `GET /slug/{slug}` (URL legível pro site público, ex: `/detail/larva`), `POST`, `PUT`,
  `DELETE`. CamelCase no JSON (alias_generator no Pydantic) batendo com o TypeScript do
  front, sem precisar converter nada manualmente. CORS liberado para GET/POST/PUT/DELETE a
  partir de `localhost:3000`, testado inclusive o preflight OPTIONS que o navegador manda
  antes de POST/PUT/DELETE
- ✅ **Masteries e Jutsus (site público) ligados na API real** — `/masteries`,
  `/masteries/[id]` e `/jutsus/[id]` viraram Server Components assíncronos, buscando direto
  do Postgres em vez do mock `lib/masteries-data.ts`. Junto, resolvido um problema que só
  apareceria numa hora dessas: campos ricos (Tiptap JSON) editados pelo painel apareciam como
  JSON cru pro visitante do site — criado `components/lore/rich-text.tsx` com `generateHTML`
  do `@tiptap/html` (mesmas extensões do editor) pra' renderizar de verdade, e uma função
  `extractPlainText` separada pros resumos curtos dos cards (onde HTML formatado não cabe).
  Testado de ponta a ponta: criei um jutsu real com negrito no Tiptap, confirmei que virou
  `<strong>` de verdade na página, não texto cru; conferido também "não encontrado" (404) nas
  duas páginas, e que mastery Não-elemental não mostra mais a linha "Elemento" (mesmo ajuste
  já feito antes no painel admin)
- ✅ **Catálogo público e página de detalhe ligados na API real** — `/catalog/[category]` e
  `/detail/[slug]` (antes `/detail/[uuid]` — trocado pra rota legível) viraram Server
  Component (busca) + Client Component (busca por texto, seções recolhíveis, botão de
  copiar), mesmo padrão de Masteries/Jutsus. `?status=published` garante que os milhares de
  rascunhos da importação em massa nunca aparecem pro visitante — testado criando um rascunho
  de propósito e confirmando que ele fica de fora. `description` adicionado no resumo da API
  pra busca por texto continuar funcionando; corrigido um nome de campo divergente
  (`drop.name` → `drop.itemName`) achado no meio do caminho
- ✅ **Vilas, Clãs, Organizações e extras de Guia ligados na API real** — `GET /villages`
  (com clãs/organizações aninhados), `GET /professions`, `GET /ninja-ranks`,
  `GET /story-arcs`, `GET /summons` (todos só leitura por enquanto, mesmo estágio que
  Masteries estava antes de ganhar edição). `/village` e `/village/[id]` viraram Server
  Components; `GuideExtras` (as abas dentro do catálogo de Guia) recebe os 5 conjuntos de
  dado como prop, buscados só quando a categoria é "guides" — sem gastar requisição à toa
  nas outras 4. Testado com dado real: vilas, clãs (Muteki, Sasayaki), organizações (ANBU,
  Hunter Nin), ranks (Genin→Kage), profissões e summons todos renderizando corretos
- ⬜ Rate limiting nas rotas públicas de busca — baixa prioridade, só importa de verdade
  quando o site estiver no ar fora da sua máquina (ver Fase 6/7)

## Fase 4 — Painel admin (CRUD real)
- ✅ **Seção "Conteúdo" reconstruída do zero**, substituindo a antiga "Wiki Pages" mockada:
  listagem com filtro por categoria + busca, apagar de verdade (com confirmação), e um editor
  com campos que mudam conforme a categoria (tipo de mob só aparece pra Mobs, tipo de item só
  pra Itens), atributos e drops dinâmicos (adicionar/remover linha), tudo conectado em
  criar/editar/publicar real via `lib/api-client.ts` — corrige também o bug antigo de abrir o
  editor em branco ao editar algo existente
- ✅ **Editor de conteúdo rico (Tiptap)**: negrito, itálico, sublinhado, tachado, cor de texto,
  fonte, títulos, listas, alinhamento e link — `components/admin/rich-text-editor.tsx`, plugado
  nos campos Descrição/Lore/Sinergia do editor de Conteúdo. Conteúdo salvo como JSON estruturado
  (nunca HTML cru), com **validação de verdade no backend** (`field_validator` em
  `app/schemas/content.py`) que só aceita um documento Tiptap válido ou texto simples antigo
  (retrocompatibilidade), e recusa qualquer string com `<script`
- ✅ **Log de auditoria**: `GET /audit-log` no backend, registrado automaticamente em todo
  create/update/delete de Conteúdo e de Jutsus (`app/core/audit.py`), com página própria no
  painel (`/admin/audit-log`) e um resumo das últimas ações na Visão Geral. Com a Fase 2
  virou o **log geral** (quem fez, origem e IP) — ver Fase 2
- ✅ **Masteries e Jutsus no painel**: `/admin/masteries` (as 8 masteries são fixas — não se criam
  nem apagam —, mas nome, descrições, ícone, cor, imagem e GIF são editáveis) e `/admin/jutsus` (CRUD completo: listar com filtro por mastery,
  criar, editar, apagar), incluindo validação no backend de que a mastery/caminho escolhidos
  existem de verdade antes de salvar
- ✅ Visão Geral melhorada: cards de Conteúdo/Jutsus/Blog/Usuários (cada um clicável, indo direto
  pra seção), detalhamento de conteúdo por categoria, e atividade recente puxando do log de
  auditoria real
- ✅ **Blog Posts com API real (28/09)**: API `/posts` (lista, ficha por id e por slug, criar, editar, apagar) com 4
  permissões próprias — `posts.create/edit/publish/delete`, mesma lógica de Conteúdo: **Creator** cria e edita
  **rascunho**, não publica nem mexe em post já publicado; **Adm/S.Adm** publicam, tiram do ar e apagam; o público só
  vê publicados (rascunho responde 404). Painel: lista com busca/status/autor e editor com o Tiptap completo, slug
  gerado a partir do título, resumo, capa (nosso `POST /uploads/image`, não Supabase — segundo storage conflitante)
  e histórico da entry. A Visão Geral passou a contar posts e equipe de verdade. Coberto por
  `scripts/testar_permissoes.py`. A página pública do blog foi feita em 01/10 (ver abaixo). Tags/categorias
  ficam pra depois: `posts` não tem noção de tag, precisa de tabela `tags` + N:N + migração antes da UI
- ✅ **Documentação no código (01/10)**: todo arquivo tem comentário-resumo e todas as funções/classes (Python) e funções/componentes
  (TypeScript) têm uma linha dizendo o que fazem; README ganhou o "mapa do código"
- ✅ **Página pública do Blog (01/10)**: `/blog` (lista dos posts **publicados**, mais recentes primeiro) e `/blog/[slug]`
  (conteúdo rico via `RichText`, capa, autor, data e "atualizado em"; rascunho/slug inexistente → 404). A Home agora mostra os
  3 últimos posts reais (link "Ver todas") no lugar das notícias de mentira (`newsItems` e `NewsCard` removidos); se a API
  cair, Home e Blog abrem mesmo assim. Item "Blog" no menu, textos PT/EN. Testado de ponta a ponta contra uma API simulada
  (lista, post com negrito, 404); `tsc`, `eslint` e `next build` limpos. Ainda sem tags/categorias nem paginação
- ✅ **Clãs com imagem (01/10)**: saíram *Nível mínimo* e *Preço (Ryo)*; cada clã ganhou **imagem** (logo + roupa), enviada no
  editor da vila (`/admin/villages`) e mostrada na página pública da vila. Migração `a91c3e5d7b20` (remove as 2 colunas e
  adiciona `image`; testada nos dois sentidos). **Organizações** têm menu próprio no painel (`/admin/organizations`)
- ✅ **Permissões por cargo editáveis pelo painel (01/10)**: tela `/admin/permissions` (só S.Adm) com a matriz permissão ×
  cargo (Adm/Creator); salva na hora, "Restaurar padrão", tudo no log (`roles`). Guarda só as diferenças do padrão em
  `role_permissions` (relê o banco a cada ~15 s, funciona com mais de uma instância). O S.Adm não é editável e permissão
  exclusiva dele não pode ser dada a ninguém
- ✅ **Equipe só para o S.Adm (01/10)**: `staff.*` e `roles.manage` viraram permissões exclusivas do S.Adm (Adm/Creator
  recebem 404 e o menu some). Consequência: o bot `/equipe` também só funciona para o S.Adm
- ✅ **Quadro de avisos na Visão Geral (01/10)**: S.Adm/Adm postam (título, mensagem, fixar), editam, apagam e anexam arquivos
  (até 10, `MAX_NOTICE_FILE_MB`); toda a equipe lê e baixa. Arquivos privados em `staff_files/` (nunca na pasta pública),
  entregues só como download (`attachment`, `nosniff`), nome em disco aleatório, executáveis/HTML/SVG recusados. Permissões
  `notices.view` (todos) e `notices.manage` (Adm), ajustáveis na tela de Permissões. `testar_permissoes.py`: 262
  verificações (eram 202) e `testar_bot_integracao.py`: 40, ambos contra Postgres real; testado também no navegador
- ✅ **Usuários → Equipe**: resolvido na Fase 2 (`/admin/staff` + API `/staff`)
- ✅ **Vilas, Clãs e Organizações: edição no painel (28/09)**: `/admin/villages` (lista + editor com os **clãs dentro**
  — a lista salva substitui a atual — e o nome em português na seção de tradução) e `/admin/organizations` (liga cada
  organização a uma ou mais vilas). API `POST/PUT/DELETE` em `/villages` e `/organizations` com permissão de Lore
  (`lore.edit`/`lore.delete`: Adm+). Validações: slug, cor `#RRGGBB`, coordenadas 0–100, clã que já pertence a outra
  vila → 409. Apagar uma vila apaga os clãs; entries (Cast) que usavam a vila ficam sem vila
- ✅ **Nomes padronizados (28/09)**: Village, Profession, NinjaRank e Summon seguem `name` (inglês) + `name_pt`, como
  Conteúdo, Mastery, Jutsu e Attribute — migração `06d091c74eb1` (renomeia sem perder dado; testada nos dois sentidos).
  Cartão/página da vila e o Guia acompanham o idioma. Descrição de vila/clã continua em um idioma só
- ✅ **Lint zerado (28/09)**: `npm run lint` foi de 26 problemas (9 erros) para **0**, sem mudar comportamento: efeitos
  que chamavam `setState` direto, `watch()` trocado por `useWatch`/`getValues`, dependências de hooks corrigidas, tema
  de cores lido com `useSyncExternalStore`. 19 testes de DOM (jsdom) validaram a refatoração, **fora do projeto por
  enquanto** (precisam de bibliotecas de teste que não estão no `package.json`). O `verificar_projeto.py` agora
  também confere o lint
- ✅ **Página de Mob melhorada** (revisão 22/09, comparando com a ficha do próprio jogo):
  Lore ("História") e Synergy ("Sinergia & Build") escondidos pra categoria Mob — não fazem
  sentido pra monstro (sem história, sem "build") — escondidos no editor e na página pública
  ao mesmo tempo, continuam disponíveis pras outras categorias. Campo novo `spawn_location`
  (texto livre, ex: "Floresta Negra, Campos Iniciais") — sem marcador de mapa clicável ainda,
  o Mapa em si continua só um placeholder até ter a imagem real do jogo. Drops agora podem
  ser ligados a uma entry de verdade do catálogo (`dropped_item_id`, busca com debounce em
  TODAS as categorias no editor) — a página pública só transforma em link quando o item
  ligado está PUBLICADO, senão mostra só o texto (nunca leva a uma página que não existe pro
  visitante). Descoberta única desta rodada: o backend inteiro dessa feature (modelo, migração
  Alembic, schemas, validação) já estava pronto no banco antes de eu começar — só o frontend
  estava zerado, então essa parte foi só o que construí de fato
- ✅ **Auditoria completa do projeto** (23/09, pedida pelo Rafael cansado, "procura erro e
  manda tudo de volta zipado"): achados e corrigidos 4 problemas reais. (1) `itemType` tinha
  sumido do `lib/validation.ts` — sem essa linha o projeto **não compilava**. (2) A feature de
  spawn location/drop-clicável do item anterior nunca tinha chegado no backend real do Rafael
  — eu tinha testado tudo contra minha própria cópia de trabalho (que já tinha o backend de
  uma sessão anterior) e só entreguei o frontend, achando que ele já tinha o resto. Reconstruí
  modelo, schema, endpoint e uma migração Alembic nova do zero, testando `upgrade()` **e**
  `downgrade()`, seed do zero, e o fluxo completo. (3) 3 arquivos de uma entrega anterior
  (`drop-row.tsx`, `detail-sidebar.tsx`, `detail-page-client.tsx`) nunca tinham sido aplicados
  — prováveis vítimas de cansaço no meio de uma sequência longa de patches manuais. (4) O
  editor de Conteúdo (`app/admin/content/edit/[[...id]]/page.tsx`) também ficou pela metade
  na mesma leva — Lore/Sinergia continuavam aparecendo pra Mob, sem campo de spawn location,
  sem seletor de item nos Drops. Um bug novo também apareceu NO MEIO da própria correção (uma
  função `_validate_dropped_item_ids` referenciada mas nunca definida, causando 500 ao
  salvar) — achado e corrigido testando. `ROADMAP.md` (este arquivo) também tinha sumido do
  projeto do Rafael inteiramente — reincluído aqui. Lição prática: depois de qualquer entrega
  de patches em várias mensagens, vale a pena um `git diff` (ou pedir uma auditoria como essa)
  pra confirmar que TUDO foi aplicado antes de seguir construindo em cima
- ✅ **Ficha específica por categoria (24/09)** — continuação da revisão de página de Mob:
  Rafael pediu campos fixos por categoria em vez do sistema genérico de Atributos, comparando
  com a ficha real do jogo. Mob: Health/Damage/Experience/Range/Respawn Time (campos fixos) +
  Jutsu/Attacks (lista de texto livre, sem ligar a um Jutsu de verdade — decisão explícita,
  são conceitos diferentes: Jutsu é técnica de jogador). Arma (categoria própria, não um
  `itemType`): Speed + Requisito ("23 Strength") — o "Lv. 10" da ficha do jogo já é o campo
  `level` que toda entry tem, não precisou de campo novo. Item ganhou 2 tipos novos no enum
  (`CURRENCY`, `CAST`): Moeda mostra Max Stack; Cast mostra a Vila que pode usar, **ligada de
  verdade** a uma vila real do catálogo (não texto solto) — mesmo padrão do link de drops.
  Nova tabela `content_item_attacks` (mesmo padrão de drops/atributos: linhas com FK+cascade,
  não array numa coluna só). Migração Alembic nova, testada `upgrade()`/`downgrade()` e do
  zero absoluto. Bug real achado testando: o autogenerate do Alembic criou os 2 valores novos
  do enum em minúsculo (`currency`/`cast`), mas todo o resto do projeto usa MAIÚSCULO nos
  rótulos do Postgres (é como o SQLAlchemy se comporta com `Enum(PyEnum, name=...)` sem
  `values_callable`, mesmo a classe também herdando de `str`) — deu erro salvando de verdade,
  corrigido pra `CURRENCY`/`CAST` maiúsculo. `seed_data.json` também tinha sumido do ambiente
  de teste — regenerado com `npx tsx scripts/export-seed-data.ts`. Testado de ponta a ponta:
  criei um mob completo, uma arma, um item Moeda e um item Cast (ligado à Vila da Névoa de
  verdade) — os 4 renderizando certo na página pública, com os campos certos por categoria
- ✅ **Painel admin em inglês por padrão + tradução automática de conteúdo (24-25/09)**:
  seletor de idioma adicionado no admin (reaproveitando o mesmo do site); painel e site
  confirmados em inglês por padrão. Tradução de UI fixa (dicionário) aplicada em: header,
  sidebar, RichTextEditor, DropItemPicker, EntryHistory, ImageUploadField, TanstackDataTable,
  audit-log, listagem de Masteries. Sistema de tradução automática de
  CONTEÚDO via API da DeepL construído do zero: `name`/`description`/`lore`/`synergy`/
  `spawn_location` preservam a formatação do Tiptap na tradução (testado com negrito
  sobrevivendo); nunca sobrescreve correção manual (testado); botão "Retraduzir" força
  atualização. **Direção corrigida no meio do caminho** (decisão final do Rafael, 25/09): o
  conteúdo nasce em INGLÊS (padrão do site), a DeepL traduz **EN → PT-BR**, não o contrário —
  os campos ganharam sufixo `_pt` (não `_en`), migração de RENAME de verdade (preserva dado)
  em vez de apagar+recriar. Também: Drops ganharam "Over/Below X%" (controle manual, não
  automático — a pessoa escolhe o rótulo por drop, igual a ficha do próprio jogo mostra "Over
  10%"/"Below 1%"); `start.bat` (REMOVIDO do repositório em 01/10: arquivos .bat/.cmd não vão mais para o Git, ver Fase 6). Bugs reais achados testando: migração de enum novo sem `CREATE TYPE` antes do
  `ADD COLUMN` (Postgres não cria sozinho), e `psycopg==3.2.4` sem build pra Python 3.14 do
  Rafael (subiu pra `3.2.13`, mesma linha 3.2.x)
- ✅ **Tradução do admin concluída + upload de imagem corrigido (25-26/09)**: as páginas que
  faltavam do dicionário do admin foram todas traduzidas — editor de Masteries, Jutsus (lista
  + editor), Conteúdo (lista + editor inteiro, incluindo os 4 arrays de opções de categoria/
  tipo), Import, Overview. Users e Blog Posts já estavam 100% traduzidas de um trabalho
  anterior. Achado e corrigido um bug real no meio do caminho: a seção `overview` do
  dicionário acabou duplicada (tipo e os dois blocos de valor pt/en) ao adicionar as strings
  novas do Overview, sombreando silenciosamente os campos originais (title/totalPosts/
  totalUsers) — mesclado de volta num só bloco. "Mobs" virou "Bestiary" no card do Home e no
  título da página de catálogo (só a versão em inglês). Upload de imagem nunca redimensionava
  nada — corrigido com Pillow no upload (máx 512px no lado maior, preserva proporção, nunca
  aumenta imagem pequena, não mexe em GIF pra não quebrar animação, arquivo corrompido dá 400
  limpo em vez de 500) — testado com 5 cenários reais. Como a correção só vale pra uploads
  novos, script novo `NinWiki.Api/scripts/reprocess_uploads.py` redimensiona as imagens que já
  estavam na pasta, sem mexer no banco (nome do arquivo não muda)
- ✅ **Fase 4 (blocos nativos) + redesenho de Arma + filtro de Items + tradução de
  Masteries/Jutsus (26/09)**: bloco de Ficha customizado no Tiptap (título + linhas
  editáveis, arrastável) — dado fica em `attrs`, não em texto, então a tradução automática
  ainda não enxerga o conteúdo de dentro de uma Ficha (limitação conhecida do v1). Tabela usa
  a extensão oficial da própria Tiptap. Achado e corrigido bug real: um `key` do React
  vazando pro HTML gerado. Imagem pixel art borrada: causa real era suavização do navegador
  ao aumentar sprite pequeno (128x128, 192x192 confirmados) — corrigido com
  `image-rendering: pixelated`, diferente do fix de redimensionamento anterior (esse resolvia
  imagem GRANDE demais, não pixel art pequena). Ficha de Arma redesenhada num Accordion
  (Requirements/Acquisition/Weapon Details/Battle Data) batendo com print de referência —
  Lore/Sinergia escondidos pra Armas também (antes só Mob); 5 campos novos (NPC/Tipo/Dano
  Base/Habilidade Especial/Distância de Knockback); "Class"=rarity e "Stat Bonus"=Atributos
  genéricos, reaproveitados sem campo novo. Catálogo de Items ganhou filtro
  (Todos/Consumíveis/Materiais/Equipamentos/Itens Especiais: Ring=Equipamento,
  Material/Consumível iguais, Geral+Moeda+Cast=Especiais) e nível escondido pra quem não for
  Ring/Cast/Arma (`shouldShowLevel()` compartilhado). Tradução automática (DeepL) estendida
  pra Masteries e Jutsus, reaproveitando um `fill_missing_translations()` genérico extraído
  do código que já existia só pra Conteúdo. Uma migração só pra tudo, testada nos dois
  sentidos; testado de ponta a ponta com o servidor real

- ✅ **GIF na Mastery Sheet + blindagem contra bugs de edição por fora (27-28/09)**:
  a Mastery ganhou um campo `gif` (migração `f2be3e177c6f`), exibido no TOPO da
  "Mastery Sheet" (Infobox), com esconder-sozinho se o arquivo falhar — o upload preserva
  a animação (GIF passa intacto pelo redimensionamento). Um teste anterior com outra IA
  havia deixado o projeto quebrado: colou o código da página de DETALHE dentro do arquivo
  da LISTAGEM (`/masteries` parou de compilar), esqueceu o `gif` no `api-client.ts` e no
  `Infobox`, e — o pior — o endpoint de salvar **não gravava o gif** (sumia em silêncio).
  Correções: arquivos restaurados, e o endpoint agora copia os campos do payload
  automaticamente (`app/core/payloads.py::apply_scalar_fields`), falhando alto se
  schema e model divergirem (aplicado em Mastery e Jutsu). Novo `scripts/verificar_projeto.py`
  (sintaxe, uma head de migração, banco na versão certa, models = migrações via
  `alembic check`, TypeScript) — testado simulando os 3 incidentes reais; e
  `CONTEXTO_PARA_IA.md` com as regras do projeto pra anexar em qualquer IA. (O lint,
  que na época tinha 22 pendências antigas, foi zerado em 28/09 — ver Fase 4.)

- ✅ **Fase 2 — Login e cargos: base (28/09)**: 3 cargos (**S.Adm / Adm / Creator**) com login
  Discord OAuth2 (sessão em cookie httpOnly), painel protegido, tela **Equipe**, API do **bot** e **log
  geral** (quem, o quê, de onde, IP). Tabela única de permissões (`app/core/permissions.py`) — o S.Adm
  já tem uma permissão exclusiva (log completo) e o mecanismo pra criar mais. Creator só mexe em
  rascunho; rascunhos sumiram do site público (antes vazavam por `?status=draft`). Toda rota que altera
  dado passou a exigir permissão (antes **nenhuma** exigia). `scripts/testar_permissoes.py` (121
  verificações, inclui auditoria automática de todas as rotas) testado por mutação. Guia: `FASE2_LOCAL.md`.
- ✅ **NinWiki.Bot (28/09)**: bot discord.py (mesma stack do Guima.Bot) com `/equipe listar|adicionar|cargo|
  desativar|reativar`. Sem regra própria: repassa quem digitou e a API decide (mesmas regras do painel);
  respostas efêmeras, sem intents privilegiadas, `ALLOWED_GUILD_IDS` opcional. `scripts/testar_bot_integracao.py`
  (39 verificações: o código real do bot contra a API real + cada comando com Discord simulado), testado por
  mutação. `verificar_projeto.py` agora também confere se as bibliotecas do `requirements.txt` estão instaladas.
  **Falta (Fase 2):** testar o login com Discord de verdade e o bot num servidor real (meu ambiente não alcança
  o Discord), e limitar tentativas de login.

### Próximos passos combinados (nesta ordem)
1. ✅ **Migrar a tabela de Conteúdo/Jutsus para TanStack Table** — `components/admin/tanstack-data-table.tsx`,
   componente reutilizável usado pelas duas páginas. Pinado em **v8.21.3**, não a "latest" (v9):
   a v9 tem uma API totalmente diferente (`createCoreRowModel` em vez de `getCoreRowModel`, etc.) —
   achado só depois de testar com `tsc`, corrigido antes de virar problema em produção
2. ✅ **Paginação + ordenação de colunas** — embutidas no componente acima: cabeçalhos de Nome/
   Categoria/Nível/Raridade (Conteúdo) e Nome/Mastery/Tier/Chakra (Jutsus) são clicáveis pra
   ordenar, com seletor de 20/50/100 itens por página e navegação de página completa
3. ✅ **Bulk actions** — checkbox por linha + "selecionar todos" da página, com barra de ação
   que aparece só quando há seleção. Endpoints novos no backend: `PATCH /content-items/bulk-status`
   (publicar/marcar rascunho em massa) e `POST /content-items/bulk-delete` /
   `POST /jutsus/bulk-delete` (apagar em massa) — testados de verdade contra o Postgres,
   inclusive a ordem das rotas no FastAPI (rotas fixas como `/bulk-status` sempre declaradas
   antes de rotas com parâmetro como `/{item_id}`, pra não serem confundidas com um id)
4. ✅ **Upload de imagem real** — `POST /uploads/image` no backend, validando o tipo de
   arquivo pelos bytes reais (assinatura binária: PNG/JPG/GIF/WEBP), não pela extensão do nome,
   e tamanho máximo de 5MB. Arquivo salvo com nome gerado aleatoriamente (nunca o nome original,
   evita path traversal), servido pela própria API via `StaticFiles` em `/uploads`. Testado de
   verdade: imagem real aceita, arquivo de texto disfarçado de `.png` rejeitado (415), arquivo
   vazio rejeitado (400), arquivo de 6MB rejeitado (413). `ImageUploadField` novo no front,
   usado no campo Imagem de Conteúdo e no campo GIF de Jutsu (que nunca tinha tido um campo de
   verdade no formulário até agora). CORS também corrigido para incluir `PATCH`, que faltava
   desde a rodada do bulk-status
5. ✅ **React Hook Form + Zod nos formulários** — `lib/validation.ts` com schemas que espelham
   as mesmas regras do backend (slug em kebab-case, nível/tier/chakra não-negativos, campos
   obrigatórios), aplicados nos editores de Conteúdo e Jutsu. Achado e corrigido no meio do
   caminho: `package.json` tinha **entradas duplicadas** de `zod`/`react-hook-form`/
   `@hookform/resolvers` (uma tentativa anterior com `zod` v4 não tinha sido limpa direito) —
   `zod` v4 quebra a inferência de tipo do `z.coerce.number()` junto com o resolver, então fixei
   na v3 estável, testado com `tsc` limpo e validação Zod isolada (nível negativo, slug
   inválido e dado correto, todos se comportando certo)
6. ✅ **Importação de JSON em massa** — `POST /content-items/bulk-import` no backend (cria
   várias entries em rascunho a partir de nome+categoria, sem inventar nível/descrição/stats;
   duplicata de slug é pulada, não quebra o lote inteiro) + página `/admin/import` no painel pra
   fazer o upload. Testado com dado real: extraí do `English.json` (arquivo de localização do
   jogo que você mandou) as 3 categorias que batem com nosso schema hoje — Itens, NPCs (como
   Mobs) e Missões — e importei de verdade: 3277 criadas, 9 puladas por duplicata, em menos de
   1 segundo. Jutsus, Mapas, Conquistas e Lojas ficaram de fora dessa importação porque não têm
   onde ir no schema atual (Jutsu exige uma mastery que não dá pra inferir do nome; Mapas foram
   excluídos de propósito da wiki desde o início; Conquistas/Lojas nunca tiveram categoria própria)
7. ✅ **Histórico de versão por entrada** — `GET /audit-log?entityType=...&entityId=...` (mesmo
   endpoint do feed geral, agora com filtro) + seção "Histórico" dentro dos editores de Conteúdo
   e Jutsu (`components/admin/entry-history.tsx`), só aparece em entries que já existem. Achado
   e corrigido um bug real no meio do caminho: os query params `entityType`/`entityId` (camelCase,
   igual o resto da API) não eram reconhecidos pelo FastAPI sem `alias=` explícito — `Query()` não
   aplica o `alias_generator` do Pydantic automaticamente como os corpos JSON aplicam, então o
   filtro simplesmente não filtrava nada. Testado de ponta a ponta: criei uma entry, editei duas
   vezes (nome, nível, status), e confirmei que o histórico dela mostra exatamente essas 3 linhas
   — nem mais, nem menos. Limitação anotada no próprio código: ações em massa não aparecem no
   histórico de uma entry individual, só no feed geral
8. ✅ **Métricas no Overview**: publicado vs rascunho (com barra) e "páginas desatualizadas" (publicadas há
   30+ dias sem edição, com link direto pro editor). "Termos mais buscados" ficou de fora — exige um sistema
   de analytics de busca que não existe

### Próximos passos — sugestão (a combinar)
1. **Testar a Fase 2 com o Discord de verdade** (login + bot num servidor de teste seu — passo a passo em
   `FASE2_LOCAL.md`): único ponto da Fase 2 ainda não visto funcionando de ponta a ponta
2. ✅ ~~Página pública do Blog~~ — feita em 01/10
3. **Descrição de vilas/clãs bilíngue** (inglês principal + tradução automática, como Masteries) — hoje é um idioma só
4. **Mapa** ainda usa dados de mentira de vila (`lib/village-data.ts`): ligar na API
5. **Testes de tela dentro do projeto** (vitest + jsdom — 19 já escritos, faltam entrar no `package.json` e num
   `npm test`)
6. Rate limit nas rotas públicas de busca (Fase 6) e **finalizar o deploy** (Fase 7 — preparação já feita, falta
   subir na SquareCloud)

## Fase 5 — Frontend público (visual)
- ✅ Sistema de Masteries/Jutsus com caminhos (`MasteryPath`), visual "dossiê shinobi" portado
  (paleta ink/chakra/blood/gold, fontes Cinzel)
- ✅ Vilas (listagem + detalhe) com Clãs e Organizações
- ✅ Mapa (placeholder em SVG — trocar pela imagem de referência real quando disponível)
- ✅ Reorganização de categorias: Mobs (+ NPCs/montarias/bosses), Itens (+ Rings),
  Guia (+ Atributos/Profissões/Ranks Ninja/Story Arcs/Summons)
- ✅ Locations descartado de propósito (itens já mostram os mobs que os dropam; mobs vão
  mostrar localização via o Mapa, quando ele evoluir)
- ✅ NavMenu enxuto: Home, Vilas, Mapa + botões de Steam/Discord (ícones de marca reais)
- ✅ Menu mobile (antes sumia inteiro em telas pequenas, sem alternativa)
- ✅ Tema de cor selecionável: **Blood** (vermelho), **Canarinho** (verde), **Ouro** (amarelo) e
  **Anil** (azul) — as 4 cores da bandeira do Brasil
- ✅ Logo do site trocado para a arte enviada pelo mantenedor (shuriken com anel), recolorida
  por processamento de imagem (4 variantes, uma por tema) e aplicada em header/footer/admin/login
- ✅ Site renomeado para "Nin Online Brasil Wiki"
- ⬜ Trocar o SVG do Mapa pela imagem de referência real, se for oficial
- ✅ **Conteúdo bilíngue de verdade**: inglês é o principal e a DeepL traduz EN → PT-BR (campos `_pt`,
  nunca sobrescreve correção manual, botão "Retraduzir") em Conteúdo, Masteries e Jutsus. Village,
  Profession, NinjaRank, Summon e Attribute seguem o mesmo padrão (`name` em inglês + `name_pt`)

## Fase 6 — Hardening de segurança ✅ COMPLETA (01/10)
- ✅ Sessão em cookie `httpOnly` / `SameSite=Lax` / `Secure` (fora do local); JWT com algoritmo fixo e
  `exp`/`sub`/`ver` obrigatórios (recusa token sem assinatura ou com outra chave)
- ✅ CSRF nos endpoints de mutação: checagem de `Origin` + `SameSite=Lax` (testado com origem falsa)
- ✅ A API **recusa iniciar** com `DEV_LOGIN_ENABLED=true` fora de development, ou com `JWT_SECRET_KEY` fraca
- ✅ Documentação interativa da API (`/docs`) desligada fora de development
- ✅ CORS restrito ao `FRONTEND_ORIGIN` (nunca `*`); a URL é normalizada (sem `/` no fim, que quebrava CORS/CSRF)
- ✅ Rate limit no login e na API do bot (ver Fase 2)
- ✅ **Rate limit geral por IP (01/10)**: API (`app/core/hardening.py`: leitura 1200/min, escrita 120/min, imagens 1500/min, `Retry-After`)
  e site (`proxy.ts`: 300 páginas/min, prefetch em balde separado). Robôs de cópia conhecidos e requisições sem User-Agent
  recebem 403 nas páginas; `robots.txt` bloqueia robôs de IA/cópia. Limites ajustáveis por `.env`. **Limite honesto**: conteúdo
  público não dá para proteger 100% de um robô decidido — o objetivo é tornar a cópia lenta/cara e proteger o servidor
- ✅ **Cabeçalhos de segurança (01/10)**: API (nosniff, anti-iframe, HSTS, CSP restritiva, `no-store` em rotas sensíveis, sem
  `Server:` do uvicorn) e site (**CSP**, HSTS, COOP, sem `X-Powered-By`, `noindex`/`no-store` no painel). Testado no navegador
  em 12 páginas: zero violações de CSP
- ✅ **Corpo de requisição limitado (01/10)**: 413 antes de ler (512 KB; uploads e importação têm limite próprio); limite de pixels
  nas imagens (anti "bomba de descompressão")
- ✅ **Texto rico validado no servidor (01/10)**: só blocos/formatações do editor, links `javascript:`/`data:` recusados,
  profundidade e tamanho máximos; **filtro no "colar"** do editor Tiptap (tags/atributos/links perigosos removidos)
- ✅ **IP real sem brecha (01/10)**: `--proxy-headers "*"` removido; com `TRUST_PROXY_HEADERS=true` usa `CF-Connecting-IP` ou o
  ÚLTIMO `X-Forwarded-For` (o do proxy), nunca o valor forjável do cliente
- ✅ **`npm audit` / `pip audit` zerados (01/10)**: Next 16.3.5 → 16.3.8 (RCE crítico em `next/og`) e Pillow 11.3.0 → 12.3.0
  (35 CVEs no processamento de imagens enviadas)
- ✅ Busca com `%`/`_` digitados pela pessoa não casa mais com tudo (escape no `ILIKE`)
- ✅ **Arquivos `.bat`/`.cmd` fora do repositório (01/10)**: `.gitignore` + workflow `no-bat.yml` que falha se algum entrar
- ✅ **Log geral no Discord (01/10)**: o bot posta as ações do painel num canal (sem IP nem conteúdo), sobrevive a reinício
  (`log_state.json`), `GET /bot/audit-log`; coberto por `testar_bot_integracao.py` (61 verificações)
- ✅ **Bugs achados e corrigidos na auditoria (01/10)**: horário do log (`audit_log.created_at`) sem fuso — aparecia deslocado e
  quebrava comparações (migração `b7d4e2f9a1c3`); editor de texto minúsculo (`min-h-64` não existe no Tailwind 3.3);
  extensões `link`/`underline` duplicadas no Tiptap v3; comentário "sem autenticação" desatualizado; teste 14a do clã
- ✅ **Erros e problemas do wiki no Discord (02/10)**: tabela `error_events` (migração `d5a7c1e9b3f2`), painel **`/admin/errors`** (só S.Adm:
  lista agrupada com contador, local no código, traceback **mascarado**, resolver/reabrir/apagar; reabre sozinho se voltar) e o bot posta no
  canal de erros (`ERROR_CHANNEL_ID`): exceções/5xx da API (`ErrorCaptureMiddleware` devolve 500 genérico, sem vazar nada), erros de tela
  do site (`app/error.tsx`, `global-error.tsx` e `ErrorReporter` → `POST /client-errors` público com origem+limite+teto/hora), falhas da
  **DeepL** (cota/chave/fora do ar, antes silenciosas), alertas de **flood** e **API/banco/site fora do ar/voltou** (`/health/ready`).
  Anti-spam (1º aviso na hora, depois 1 a cada 10 min com "+N") e segredos nunca aparecem (máscara de URL de banco, tokens, JWT,
  valores do `.env`, parâmetros de SQL). Coberto por testes (`testar_permissoes.py` 345, `testar_bot_integracao.py` 91)
- ✅ **Inglês padrão + DeepL em tudo (02/10)**: vilas (lema, descrição, descrição completa, clima), clãs e organizações (nome/descrição),
  guia (profissões, ranks, arcos, summons, atributos) e posts do blog ganharam campos `_pt` (migração `c3e8a5b1d9f4`); conteúdo nasce em
  inglês, a DeepL traduz EN→PT ao salvar (sem sobrescrever correção manual) e há botão **Retranslate** em vilas, organizações e posts.
  Site público em PT/EN de verdade (antes havia textos fixos em português: vilas, mapa, guia, "não encontrado"...); dados iniciais
  (`lib/village-data.ts`, `guide-data.ts`, mapa) reescritos em inglês + português; mensagens de erro da API, validações do painel e o bot
  (`/team ...`, log, alertas) em inglês. **Idioma escolhido fica salvo** (antes cada página voltava para inglês). Script
  `scripts/traduzir_para_ingles.py` converte conteúdo antigo em português (DeepL PT→EN, simulação por padrão)
- ⬜ Rate limit com **Redis** se um dia houver mais de uma instância (hoje é por processo — exato com uma instância só)
- ⬜ Cloudflare (WAF/proxy) na frente — recomendado, ver README 3.7

## Fase 7 — Deploy
- ✅ **Preparação para a SquareCloud (01/10)**: `README.md` na raiz (rodar local, usar o painel, passo a passo do
  deploy e tabela de problemas); `squarecloud.app` + `.squarecloudignore` em `NinWiki.Api`, `NinWiki.Web` e
  `NinWiki.Bot`; `NinWiki.Api/start.py` (roda `alembic upgrade head` e liga o Uvicorn na porta 80; se a migration
  falhar, a API não sobe). **Ainda não testado numa conta real da SquareCloud** — conferir o primeiro deploy nos logs
- ✅ **Auditoria pré-deploy (01/10)**: (1) as páginas públicas que buscam da API (catálogo, detalhe, jutsus, masteries,
  vilas) eram pré-renderizadas no build — o build quebrava com a API fora do ar e o conteúdo ficava congelado; agora
  são `force-dynamic`. (2) Alembic não entendia `?ssl=require` (asyncpg vs psycopg); `alembic/env.py` converte para
  `sslmode=`. `tsc`, `eslint` e `next build` passam
- ⬜ Criar os apps na SquareCloud (API, Web, Bot opcional) + banco PostgreSQL e testar o login Discord em produção
- ⬜ **Domínio próprio com subdomínios** (`wiki.` e `api.`): o cookie `SameSite=Lax` exige os dois no mesmo site
- ⬜ **Uploads em disco local**: um redeploy pode apagar `NinWiki.Api/uploads` — fazer backup ou migrar para storage
  externo (S3/R2)
- ⬜ Cloudflare (WAF, proxy, DNS) — ao ligar, usar `TRUST_PROXY_HEADERS=true`
- ✅ **Levar o banco do Docker para a SquareCloud (01/10)**: `NinWiki.Api/scripts/migrar_banco.py exportar|importar` (round-trip testado:
  15 entries e a versão do Alembic preservadas); passo a passo no README 3.2
- ⬜ Schema de banco separado por ambiente (`public` / `beta_ninwiki`, mesmo padrão do Guima)

---

## Decisões já tomadas (não reabrir sem motivo novo)
- Backend: **FastAPI + SQLAlchemy async** (não Express/Drizzle) — reaproveita os padrões já
  validados no Guima
- Blog e Wiki em tabelas **separadas** (`posts` vs `content_items`) — comportamento editorial diferente
- Drops de mob guardam o **nome do item como texto**, sempre — agora também podem, opcionalmente,
  se ligar a uma entry de verdade do catálogo (`dropped_item_id`), mas o texto nunca deixa de
  existir (drop sem entry cadastrada continua funcionando normal, só sem virar link)
- Replit não é mais usado neste projeto (motivo documentado no histórico: deixou o menu
  quebrado e commitou um `package-lock.json` que só funcionava dentro do ambiente dela)
- **TanStack Table** escolhida para tabelas com ordenação/paginação/seleção (não uma tabela
  feita na mão) — **React Hook Form + Zod** escolhidos para validação de formulário no
  front-end
- **Editor Markdown com preview ao vivo foi avaliado e rejeitado** para Guias/Blog: entra em
  conflito direto com a escolha do Tiptap (WYSIWYG) — a equipe de edição não é técnica, e
  Markdown ainda exige aprender sintaxe (`**`, `#`), o mesmo problema do wikitext do MediaWiki
  que motivou a escolha do Tiptap desde o início. Ter os dois editores ao mesmo tempo também
  confundiria qual usar pra cada tipo de conteúdo
- **Cargos e permissões (28/09)**: S.Adm / Adm / Creator, definidos numa tabela só (`app/core/permissions.py`);
  todo endpoint pede uma **permissão**, nunca compara cargo por texto. Creator só mexe em rascunho; Adm
  gerencia só Creators; só o S.Adm vê o log completo e IPs; donos ficam no `.env`
- **Sessão** = JWT em cookie httpOnly **conferido no banco a cada requisição** (mudança de cargo e desativação
  valem na hora), sem refresh token. **Discord ID sempre como texto (string)** — número perde precisão no JS
- **Bot sem regra própria**: o NinWiki.Bot só repassa quem digitou; a API decide (mesmas regras do painel)
- **Idioma dos dados**: o campo sem sufixo é o inglês (principal) e `_pt` é a tradução. Lore e Synergy foram
  removidos de todas as categorias (colunas mantidas no banco, sem uso)
- **Rota nova sem proteção não passa**: `scripts/testar_permissoes.py` falha se uma rota não exigir login e
  não estiver na lista de públicas de propósito
- **Lint sempre limpo (28/09)**: `npm run lint` roda com `--max-warnings=0` e está em **0**; o
  `verificar_projeto.py` confere. Efeito não chama `setState` direto no corpo; tela que recarrega ao trocar de
  filtro liga o "carregando" no clique, não dentro do efeito
- **Blog** usa permissões próprias (`posts.*`) com a mesma regra de Conteúdo (Creator só rascunho); Vilas, Clãs e
  Organizações usam as permissões de Lore
- **Rate limit** é por IP e em memória (sem Redis): serve enquanto houver uma instância só da API; atrás de proxy,
  `TRUST_PROXY_HEADERS=true`
