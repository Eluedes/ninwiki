# Contexto do projeto Nin Codex (pastas `NinWiki.*`) — para qualquer IA (LEIA ANTES DE MEXER)

Cole/anexe este arquivo no começo de qualquer conversa com uma IA (Gemini, ChatGPT,
Claude...) que vá alterar o projeto. Vários bugs já foram causados por uma IA que
não sabia o que já estava pronto.

## Nome e hospedagem (atualizado em 31/10/2026)
- O projeto se chama **Nin Codex** (antes Nin Online Wiki / NinWiki). O **jogo** continua **Nin Online**. Pastas, pacotes,
  workflows e identificadores técnicos `NinWiki.*` **não mudam** — não renomeie pasta nem import.
- A hospedagem **ativa é a SquareCloud** (README, seção 3; entrada do Nin Codex em produção: seção 3.13). O **Azure** (1 VM + Docker Compose + Caddy +
  Cloudflare Tunnel; pasta `Azure/`, README 3A) é só o **plano B**, pronto e **não usado agora**: não o trate como destino. Endereços: site
  `https://nincodex.guima.net` (antigo `ninwiki.guima.net`, redireciona 308), API `https://api.guima.net`. Não invente passos de deploy: leia o README.
- O banco **local** é a base da produção (`NinWiki.Api/scripts/mesclar_producao.py` junta com os dados vivos). A produção **já
  está na head** do Alembic: **não crie migração sem o dono pedir** (e nunca edite uma já aplicada).

## Estrutura
- `NinWiki.Api` — FastAPI + SQLAlchemy (async) + Alembic + PostgreSQL.
- `NinWiki.Web` — Next.js + React + TypeScript + Tailwind + react-hook-form + zod + Tiptap.
- Wiki público em inglês por padrão; painel admin também. Português é a tradução.

## Regras (não quebre estas)

1. **Antes de criar qualquer coisa, procure se já existe** (busque no código). Já estão
   prontos e funcionando: tradução automática EN→PT-BR (DeepL), redimensionamento de
   imagem no upload, filtros do catálogo de Items, ficha de Arma em seções, blocos
   Ficha/Tabela no editor rico, backfill de Masteries/Jutsus. Se algo "parece faltando",
   **pergunte/verifique** antes de refazer — refazer é como se cria bug.

2. **Nunca substitua um arquivo inteiro pelo código de outro.** Lista e detalhe são
   arquivos DIFERENTES: `masteries-page-client.tsx` (lista, plural) ≠
   `mastery-page-client.tsx` (detalhe, singular). Idem Jutsu. Altere só o trecho pedido.

3. **Campo novo no banco = TODOS estes lugares** (esquecer um = dado que some ou tela quebrada):
   model (`app/models`) → schema Read **e** Write (`app/schemas`) → migração Alembic →
   tipos em `lib/api-client.ts` (`Api*` e `*Input`) → `lib/validation.ts` → formulário
   admin → tela pública. Os endpoints de editar copiam os campos do payload
   automaticamente (`app/core/payloads.py::apply_scalar_fields`) e **falham com erro
   claro** se schema e model divergirem.

4. **Migrações (Alembic):**
   - Gere com `py -m alembic revision --autogenerate -m "descrição"` e **revise** o arquivo.
   - Renomear coluna vira "apagar + criar" no autogenerate e **PERDE OS DADOS**. Use
     `op.alter_column(tabela, 'antigo', new_column_name='novo')`.
   - Nunca rode SQL direto, nem `alembic upgrade`, nem crie migração "por fora" sem
     avisar quem mantém o projeto. Nunca edite/apague migração já aplicada.
   - Tem que existir **UMA só head** (`py -m alembic heads`).

5. **Padrão de idioma dos dados:** o campo sem sufixo é o inglês (principal) e `_pt` é a
   tradução: `name`/`name_pt`, `description`/`description_pt`. Vale para Content,
   Mastery, Jutsu, Attribute, Village, Profession, NinjaRank e Summon. (Clan, Organization e
   StoryArc têm só `name`, sem tradução.) Nunca volte a usar `english_name`. Dados em português dentro do campo inglês são erro:
   `scripts/corrigir_idioma_dados.py` mostra/corrige.

6. **Textos das telas** vêm do dicionário `lib/i18n.ts` (pt e en). Nunca escreva texto
   fixo em português ou inglês direto no componente.

7. **Regras de negócio já decididas:** Lore e Synergy foram removidos de vez (não recriar).
   Nível: Mob/Arma/Missão/Guia têm; entre Items, só Ring e Cast (`shouldShowLevel`).
   Catálogo de Items tem 4 filtros (Consumables, Materials, Equipment, Special Items)
   e **não** tem botão "All".

8. **Nunca** coloque, cole ou imprima o conteúdo de `.env` / `.env.local` (têm senhas e
   chaves de API).

9. **Login e cargos (Fase 2) — regras de segurança:**
   - Quem-pode-o-quê mora **só** em `app/core/permissions.py`. Endpoint novo que muda dado
     **sempre** leva `Depends(require_permission(Permission.X))` — nunca comparar cargo por texto
     (`if role == "admin"`).
   - Regras de equipe (hierarquia, dono, último S.Adm) ficam em `app/core/staff_service.py`, usado
     **tanto pelo painel quanto pelo bot** — não duplique essas regras em outro lugar.
   - Permissão exclusiva do S.Adm vai em `SUPER_ONLY_PERMISSIONS` (os outros recebem 404).
   - Nunca guardar sessão em localStorage, nunca desligar `httpOnly`/CSRF, nunca ligar
     `DEV_LOGIN_ENABLED` fora do computador local. Discord ID é sempre **texto** (não número).
   - Toda escrita no banco que altera dado de conteúdo chama `log_action(..., actor=staff)`.
   - O `NinWiki.Bot` (discord.py) **não tem regra de cargo própria**: só repassa `invokerDiscordId` +
     pedido para `/bot/*`, e a API decide. Não copie regra de permissão para dentro do bot.
   - Rota nova da API sem `require_permission` (e fora da lista `ROTAS_PUBLICAS` de
     `scripts/testar_permissoes.py`) faz o teste falhar de propósito.
   - No frontend, esconder botão é só conforto: a API é quem nega. Mapa de páginas em
     `lib/admin-routes.ts`.

10. **Frontend — lint limpo:** `npm run lint` (`--max-warnings=0`) está em **0** e tem que continuar. Não chame
    `setState` direto no corpo de um `useEffect` (chame dentro de `.then`, de um evento ou derive o valor); não use
    `watch()` do react-hook-form (use `useWatch` ou `getValues`); complete as dependências dos hooks.
11. **Vilas, Clãs, Organizações, Blog:** vila e organização usam as permissões de Lore (`lore.edit`/`lore.delete`);
    posts têm `posts.*` (Creator só rascunho). Rota nova precisa de `require_permission` e de teste em
    `scripts/testar_permissoes.py`.

12. **Scripts de importação/correção em `NinWiki.Api/scripts/`** (Atlas, Fandom, cliente do jogo): todos fazem **simulação por
    padrão** e só gravam com `--aplicar`; só rodam em banco **local** (`--permitir-remoto` existe só em alguns, com backup). Só
    preenchem campo **vazio** e criam **rascunho**. Use o que já existe (lista e ordem segura no README, seção 3A.5) em vez de
    criar um importador novo.
13. **Código antigo removido:** o fluxo de seed (`export-seed-data.ts`, `app/seed.py`, `lib/*-data.ts`) e os guias `GUIA_DE_EDICAO.md`/`MAESTRIAS.md` foram apagados; o conteúdo mora no banco.
    Os comandos `/team` do bot foram removidos (equipe só pelo painel).
14. **Documentos de controle:** `ROADMAP.md` (estado real + próximas fases), `README.md` (como rodar/hospedar; mantido em dia por
    `scripts/verificar_readme.py`), `FASE2_LOCAL.md` (login/cargos local). Atualize-os na mesma entrega.

## Depois de QUALQUER alteração, rode e confira que está tudo verde
```
cd NinWiki.Api
py scripts/verificar_projeto.py
py scripts/testar_permissoes.py     # sempre que mexer em rotas, cargos ou login
py scripts/testar_bot_integracao.py  # sempre que mexer no bot ou nas rotas /bot
```
Ele confere sintaxe, migrações (uma head, banco na versão certa, models = migrações) e o
TypeScript do frontend, e diz em português o que está errado e como resolver.
