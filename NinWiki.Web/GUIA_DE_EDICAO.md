> **⚠️ OBSOLETO (30/10/2026) — Nin Codex (antes NinWiki).** Este guia vem da época em que o conteúdo ficava em arquivos (`lib/masteries-data.ts`, `lib/data.ts`,
> `lib/village-data.ts`). **Hoje todo o conteúdo mora no banco e é editado pelo painel (`/admin`)**; nenhuma página do site lê esses arquivos
> (só o script de seed `scripts/export-seed-data.ts`, que gera um banco de teste vazio). Não edite os arquivos de `lib/*-data.ts` para mudar o
> site. O que ainda vale aqui: o mapa de pastas, as regras de imagem em `public/images/` e o que `components/lore/*` faz. Documentação atual:
> `README.md` e `ROADMAP.md` na raiz.

# Guia de edição do NinWiki.Web

Este documento explica onde cada parte do frontend está localizada e quais arquivos devem ser alterados enquanto o backend e o painel de publicação ainda não existem.

## Regras para não perder alterações

1. Use este projeto como a fonte principal do frontend.
2. Não edite as pastas `.next/` ou `node_modules/`. Elas são geradas automaticamente.
3. Não envie `.env`, senhas ou chaves dentro de ZIPs.
4. Antes de substituir um arquivo, compare a versão nova com a sua versão atual.
5. Conteúdo temporário deve ser alterado nos arquivos de `lib/`, não dentro dos componentes visuais.

## Mapa das pastas

| Caminho | O que contém |
|---|---|
| `app/` | Páginas e rotas do Next.js |
| `app/(wiki)/` | Site público do wiki |
| `app/(wiki)/(lore)/masteries/` | Lista e detalhe das masteries |
| `app/(wiki)/(lore)/jutsus/` | Página de detalhe dos jutsus |
| `app/admin/` | Interface visual provisória do painel; ainda não salva dados |
| `components/lore/` | Cards, cabeçalhos e fichas de masteries/jutsus |
| `components/wiki/` | Componentes do catálogo genérico |
| `components/ui/` | Componentes visuais reutilizáveis; normalmente não precisam ser editados |
| `lib/masteries-data.ts` | Masteries, caminhos, atributos e jutsus temporários |
| `lib/data.ts` | Mobs, itens, armas, missões, guias e cards da home |
| `lib/types.ts` | Formatos aceitos pelos dados do catálogo |
| `lib/i18n.ts` | Textos fixos da interface por idioma |
| `public/images/` | Imagens e GIFs servidos pelo site |
| `app/globals.css` | Estilos globais e classes visuais do tema |
| `tailwind.config.ts` | Cores, fontes e configurações do Tailwind |

## Onde editar cada conteúdo

### Organização das áreas

- **Mobs:** monstros, NPCs, montarias e bosses.
- **Vilas:** organizações e clãs.
- **Guias:** atributos, profissões e ranks ninja.

### Masteries, caminhos, atributos e jutsus

Arquivo: `lib/masteries-data.ts`

- `attributes`: lista dos atributos, como Força, Agilidade e Chakra.
- `masteries`: lista das masteries e seus caminhos.
- `jutsus`: lista temporária de jutsus.
- funções no final do arquivo: buscam e agrupam os dados para as páginas.

### Mobs, itens, armas, missões e guias

Arquivo: `lib/data.ts`

- `categories`: cards e links das categorias exibidas na home.
- `entries`: páginas do catálogo.
- `blogPosts`, `wikiPages` e demais listas: dados temporários usados pelo painel.

O formato de uma entrada genérica está documentado em `lib/types.ts`.

### Textos fixos da interface

Arquivo: `lib/i18n.ts`

Use esse arquivo apenas para botões, menus, títulos fixos e mensagens da interface. Nomes e descrições de conteúdos serão traduzidos pelo sistema de conteúdo no futuro.

## Campos de uma mastery

```ts
{
  id: 'wind',                       // identificador técnico; não repetir
  name: 'Vento',                    // nome exibido
  englishName: 'Wind',              // legado temporário para subtítulos
  type: 'elemental',                // elemental ou non-elemental
  element: 'Fuuton',                // elemento exibido na ficha
  description: 'Resumo curto',      // aparece no card
  longDescription: 'Texto longo',   // aparece na página da mastery
  icon: 'wind',                     // ícone de fallback
  image: '/images/masteries/...',   // imagem dentro de public/
  color: '#467434',                 // cor dos detalhes visuais
  attributes: [],                   // atributos relacionados
  paths: [],                        // caminhos da mastery, quando existirem
}
```

## Campos de um caminho

```ts
{
  id: 'wind-fan-leque',             // valor usado pelo pathId dos jutsus
  label: 'Arma: Fan-Leque',         // título do caminho
  description: 'Descrição curta',
  attributes: [],
  requirement: 'Requisito opcional',
}
```

Não troque o `id` de um caminho sem atualizar também os `pathId` dos jutsus ligados a ele.

## Campos de um jutsu

```ts
{
  id: 'fuuton-renkuudan',                  // identificador e parte da URL
  name: 'Esfera de Vento',
  englishName: 'Wind Sphere',              // legado temporário
  masteryId: 'wind',                       // mastery à qual pertence
  pathId: 'wind-elemental-unarmed',        // obrigatório se a mastery tiver caminhos
  tier: 1,                                 // valores aceitos: 1, 2, 3 ou 4
  chakraCost: 12,
  description: 'Resumo do card',
  longDescription: 'Descrição completa',
  effect: 'Dano de corte',
  range: 'Médio (5-10m)',
  castTime: '1 selo',
  cooldown: '3 segundos',
  icon: 'wind',
  gif: '/images/jutsus/fuuton-renkuudan.gif',
}
```

Se a mastery possuir caminhos e o jutsu não tiver `pathId`, ele não aparecerá na lista de nenhum caminho. O futuro formulário do painel deverá impedir a publicação nessa situação.

## Imagens e GIFs

- Imagens de masteries: `public/images/masteries/`
- Imagens ou emblemas de vilas: `public/images/villages/`
- Imagens do catálogo: `public/images/wiki/`
- GIFs de jutsus: `public/images/jutsus/`

Nos dados, o caminho sempre começa com `/images/`:

```ts
gif: '/images/jutsus/nome-do-jutsu.gif'
```

Não use caminhos do computador, como `C:\Imagens\arquivo.gif`.

### Trocar o ícone de uma vila por imagem

1. Crie a pasta `public/images/villages/` se ela ainda não existir.
2. Coloque a imagem nela, por exemplo `public/images/villages/leaf.png`.
3. Em `lib/village-data.ts`, altere o campo `image` da vila:

```ts
image: '/images/villages/leaf.png',
```

O campo `emblem` continua sendo usado como fallback. Se `image` estiver
ausente, tiver um caminho incorreto ou falhar ao carregar, o emoji aparece
automaticamente no lugar sem quebrar o card ou a página.

## Componentes principais

| Arquivo | Responsabilidade |
|---|---|
| `components/lore/mastery-card.tsx` | Card da mastery na listagem |
| `components/lore/jutsu-card.tsx` | Card resumido do jutsu |
| `components/lore/mastery-visual.tsx` | Imagem da mastery com ícone de fallback |
| `components/lore/infobox.tsx` | Tabela lateral das fichas |
| `components/lore/page-header.tsx` | Título, subtítulo e breadcrumb |
| `app/(wiki)/(lore)/masteries/[id]/page.tsx` | Página completa de uma mastery |
| `app/(wiki)/(lore)/jutsus/[id]/page.tsx` | Página completa de um jutsu |

## Painel administrativo atual

O conteúdo de `app/admin/` é apenas a interface inicial. Ele ainda:

- não salva alterações;
- não publica conteúdo;
- não envia arquivos;
- não possui autenticação ou permissões Adm/Mod;
- lê os mesmos dados estáticos de `lib/`.

Até o backend ser desenvolvido, alterações de conteúdo continuam sendo feitas em `lib/masteries-data.ts` e `lib/data.ts`.

## Verificação antes de gerar um ZIP

Execute:

```bash
npm run typecheck
npm run build
```

Ao criar o ZIP, exclua:

- `.next/`
- `node_modules/`
- `.env`
- arquivos `*.tsbuildinfo`
