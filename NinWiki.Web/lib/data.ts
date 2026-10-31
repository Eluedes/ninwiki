// ============================================================================
// CONSTANTES VISUAIS DO WIKI
// ============================================================================
// Aqui ficam so' a cor por raridade (rarityConfig) e a lista de categorias
// (categories) usadas pela UI. O CONTEUDO do site vem da API/banco, nunca
// deste arquivo (os antigos dados mockados `entries` foram removidos).
// ============================================================================

import type { CategoryInfo, Rarity } from './types';

// Mapa de raridade -> classes Tailwind de cor. Centralizado aqui para
// que toda a UI (cards, badges, barras) use exatamente a mesma cor
// por raridade, em vez de cada componente decidir por conta propria.
export const rarityConfig: Record<
  Rarity,
  // glow = cor (rgb "r,g,b") do brilho atras da imagem na pagina do item; chip = selo da raridade (fundo + borda + texto)
  { color: string; barColor: string; glow: string; chip: string }
> = {
  common: { color: 'text-slate-400', barColor: 'bg-slate-400', glow: '148,163,184', chip: 'border-slate-400/30 bg-slate-400/10 text-slate-300' },
  uncommon: { color: 'text-emerald-500', barColor: 'bg-emerald-500', glow: '16,185,129', chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  rare: { color: 'text-sky-500', barColor: 'bg-sky-500', glow: '14,165,233', chip: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  epic: { color: 'text-violet-500', barColor: 'bg-violet-500', glow: '139,92,246', chip: 'border-violet-500/30 bg-violet-500/10 text-violet-400' },
  legendary: { color: 'text-amber-500', barColor: 'bg-amber-500', glow: '245,158,11', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  // Event: itens de evento do jogo (rosa/magenta, para nao se confundir com Unique em vermelho nem Enchanted em ciano)
  event: { color: 'text-pink-400', barColor: 'bg-pink-400', glow: '244,114,182', chip: 'border-pink-400/30 bg-pink-400/10 text-pink-300' },
  unique: { color: 'text-red-500', barColor: 'bg-red-500', glow: '239,68,68', chip: 'border-red-500/30 bg-red-500/10 text-red-400' },
  enchanted: { color: 'text-cyan-400', barColor: 'bg-cyan-400', glow: '34,211,238', chip: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' },
  // Premium (laranja) e Organization (indigo): cores que nao se confundem com as demais raridades
  premium: { color: 'text-orange-500', barColor: 'bg-orange-500', glow: '249,115,22', chip: 'border-orange-500/30 bg-orange-500/10 text-orange-400' },
  organization: { color: 'text-indigo-400', barColor: 'bg-indigo-400', glow: '129,140,248', chip: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300' },
};

// Cards de areas exibidos na home. A chave `key` tem que bater exatamente
// com o tipo `Category` em lib/types.ts, mas o `href` e' independente:
// ele pode apontar para o catalogo ou para uma pagina especial, como
// /masteries. O menu principal possui configuracao propria em
// components/header.tsx.
export const categories: CategoryInfo[] = [
  {
    key: 'mobs',
    href: '/catalog/mobs',
    image: '/images/wiki/Jellyfish.svg',
    icon: 'Bug',
    title: { pt: 'Monstros', en: 'Bestiary' },
    description: {
      pt: 'Monstros, NPCs, montarias e bosses — tudo que habita o mundo Nin.',
      en: 'Monsters, NPCs, mounts and bosses — everything that inhabits the Nin world.',
    },
  },
  {
    key: 'items',
    href: '/catalog/items',
    image: '/images/wiki/Chakra_Pill.png',
    icon: 'Package',
    title: { pt: 'Itens', en: 'Items' },
    description: {
      pt: 'Consumíveis, materiais, equipamentos e itens especiais.',
      en: 'Consumables, materials, equipment and special items.',
    },
  },
  {
    key: 'guides',
    href: '/catalog/guides',
    image: '/images/wiki/Tales_of_a_Gutsy_Ninja.png',
    icon: 'BookOpen',
    title: { pt: 'Guias', en: 'Guides' },
    description: {
      pt: 'Tutoriais e guias para iniciantes e jogadores avançados.',
      en: 'Tutorials and guides for beginners and advanced players.',
    },
  },
  {
    key: 'masteries',
    // Masteries tem uma pagina propria; nao e' um catalogo generico.
    href: '/masteries',
    image: '/images/wiki/Blank_Scroll.png',
    icon: 'Sparkles',
    title: { pt: 'Maestrias', en: 'Masteries' },
    description: {
      pt: 'Sistema de maestria: habilidades, evolução e combinações.',
      en: 'Mastery system: skills, progression and combinations.',
    },
  },
  {
    key: 'weapons',
    href: '/catalog/weapons',
    image: '/images/wiki/Adamantine_Claymore.png',
    icon: 'Sword',
    title: { pt: 'Armas', en: 'Weapons' },
    description: {
      pt: 'Catálogo completo de armas com estatísticas e comparações.',
      en: 'Complete weapon catalog with stats and comparisons.',
    },
  },
  {
    key: 'missions',
    href: '/catalog/missions',
    image: '/images/wiki/Scroll_Signboard.png',
    icon: 'ScrollText',
    title: { pt: 'Missões', en: 'Missions' },
    description: {
      pt: 'Lista de missões, recompensas e passos para conclusão.',
      en: 'Quest list with rewards and completion steps.',
    },
  },
];
