// ============================================================================
// DADOS MOCKADOS DO WIKI (placeholder ate' a API existir)
// ============================================================================
// Este arquivo e' hoje a UNICA fonte de dados do site: tudo que aparece
// no catalogo, na home e no painel admin vem literalmente destas
// constantes, embutidas no bundle JavaScript. Nao ha banco de dados,
// nao ha fetch de rede - e' 100% estatico.
//
// Quando o NinWiki.Api (FastAPI + Postgres) estiver pronto (Fase 1-3
// do roadmap), este arquivo sera' substituido por chamadas fetch()
// para a API. As funcoes helper no fim do arquivo (getEntryById,
// getEntriesByCategory, etc.) tem assinatura pensada para ficar
// parecida com o que sera' uma chamada de API - facilita a migracao.
// ============================================================================

import type { CategoryInfo, WikiEntry, Rarity } from './types';

// Mapa de raridade -> classes Tailwind de cor. Centralizado aqui para
// que toda a UI (cards, badges, barras) use exatamente a mesma cor
// por raridade, em vez de cada componente decidir por conta propria.
export const rarityConfig: Record<
  Rarity,
  // glow = cor (rgb "r,g,b") do brilho atras da imagem na pagina do item; chip = selo da raridade (fundo + borda + texto)
  { label: string; color: string; barColor: string; glow: string; chip: string }
> = {
  common: { label: 'Common', color: 'text-slate-400', barColor: 'bg-slate-400', glow: '148,163,184', chip: 'border-slate-400/30 bg-slate-400/10 text-slate-300' },
  uncommon: { label: 'Uncommon', color: 'text-emerald-500', barColor: 'bg-emerald-500', glow: '16,185,129', chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  rare: { label: 'Rare', color: 'text-sky-500', barColor: 'bg-sky-500', glow: '14,165,233', chip: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  epic: { label: 'Epic', color: 'text-violet-500', barColor: 'bg-violet-500', glow: '139,92,246', chip: 'border-violet-500/30 bg-violet-500/10 text-violet-400' },
  legendary: { label: 'Legendary', color: 'text-amber-500', barColor: 'bg-amber-500', glow: '245,158,11', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  // Event: itens de evento do jogo (rosa/magenta, para nao se confundir com Unique em vermelho nem Enchanted em ciano)
  event: { label: 'Event', color: 'text-pink-400', barColor: 'bg-pink-400', glow: '244,114,182', chip: 'border-pink-400/30 bg-pink-400/10 text-pink-300' },
  unique: { label: 'Unique', color: 'text-red-500', barColor: 'bg-red-500', glow: '239,68,68', chip: 'border-red-500/30 bg-red-500/10 text-red-400' },
  enchanted: { label: 'Enchanted', color: 'text-cyan-400', barColor: 'bg-cyan-400', glow: '34,211,238', chip: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' },
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

// Lista de todas as paginas do wiki (mobs, itens, armas, etc.), cada
// uma seguindo o formato WikiEntry definido em lib/types.ts. Cada
// objeto abaixo e' equivalente a uma LINHA que vai virar uma tabela
// no banco na Fase 1 (content_items + tabela especifica da categoria).
export const entries: WikiEntry[] = [
  {
    id: 'larva',
    name: 'Larva',
    category: 'mobs',
    level: 2,
    icon: '🦠',
    image: '/images/wiki/Larva.png',
    rarity: 'common',
    description:
      'A small, weak creature found in the Beginner Fields. Larvae are the first enemies most nin encounter on their journey. They move slowly and pose little threat.',
    lore:
      'Larvae are believed to be the immature form of the Silkmoth. They feed on decaying leaves and roots in the forest floor. While individually harmless, they can overwhelm unprepared travelers in groups.',
    synergy: 'Weak to fire. Best defeated with basic strikes — no jutsu needed.',
    attributes: [
      { label: 'Health', value: 45 },
      { label: 'Damage', value: '3-5' },
      { label: 'Experience', value: 12 },
      { label: 'Type', value: 'Insect' },
      { label: 'Weakness', value: 'Fire' },
    ],
    drops: [
      { name: 'Silk Thread', rarity: 'uncommon', chance: 25, minQty: 1, maxQty: 3 },
      { name: 'Larva Shell', rarity: 'common', chance: 60, minQty: 1, maxQty: 1 },
      { name: 'Minor Healing Potion', rarity: 'rare', chance: 8, minQty: 1, maxQty: 1 },
    ],
  },
  // ---- Exemplos dos novos subtipos de "mobs" (mobType) ----
  {
    id: 'mob-boss',
    name: 'The Mob Boss',
    category: 'mobs',
    mobType: 'boss',
    level: 15,
    icon: '👹',
    image: null,
    rarity: 'epic',
    description:
      'Boss de missão repetível, bem mais forte que um monstro comum do mesmo nível — costuma exigir grupo e recompensa com itens exclusivos.',
    lore: 'Comanda uma pequena gangue nos arredores da vila. Poucos voltam sozinhos de um encontro direto com ele.',
    synergy: 'Recomendado enfrentar em grupo. Cuidado com o dano em área.',
    attributes: [
      { label: 'Health', value: 4800 },
      { label: 'Damage', value: '80-120' },
      { label: 'Experience', value: 47800 },
      { label: 'Type', value: 'Boss' },
    ],
    drops: [
      { name: 'Item Exclusivo do Boss', rarity: 'legendary', chance: 5, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'npc-fishing-merchant',
    name: 'Takumi',
    category: 'mobs',
    mobType: 'npc',
    level: 0,
    icon: '🎣',
    image: null,
    rarity: 'common',
    description:
      'NPC vendedor de equipamento de pesca na Vila da Folha. Não é hostil — vende varas e iscas para quem quer treinar a profissão de Pesca.',
    attributes: [
      { label: 'Tipo', value: 'Vendedor' },
      { label: 'Localização', value: 'Vila da Folha' },
      { label: 'Hostil', value: 'Não' },
    ],
  },
  {
    id: 'mount-example',
    name: 'Montaria de Exemplo',
    category: 'mobs',
    mobType: 'mount',
    level: 0,
    icon: '🐎',
    image: null,
    rarity: 'rare',
    description:
      'Placeholder para as montarias domesticáveis do jogo (aumentam velocidade de movimento). Substituir por uma montaria real quando a equipe confirmar nome, imagem e forma de obtenção.',
    attributes: [
      { label: 'Tipo', value: 'Montaria' },
      { label: 'Efeito', value: 'Aumenta velocidade de movimento' },
    ],
  },
  {
    id: 'forest-wolf',
    name: 'Forest Wolf',
    category: 'mobs',
    level: 5,
    icon: '🐺',
    image: '/images/wiki/Wolf.png',
    rarity: 'uncommon',
    description:
      'A predatory beast that roams the Whispering Woods in packs. Forest Wolves are aggressive and fast.',
    lore:
      'The wolves of Whispering Woods have been corrupted by a dark chakra leak from the old shrine. Their eyes glow faintly red at night.',
    synergy: 'Weak to lightning. Avoid packs of 3 or more at low levels.',
    attributes: [
      { label: 'Health', value: 120 },
      { label: 'Damage', value: '8-12' },
      { label: 'Experience', value: 35 },
      { label: 'Type', value: 'Beast' },
      { label: 'Weakness', value: 'Lightning' },
    ],
    drops: [
      { name: 'Wolf Pelt', rarity: 'uncommon', chance: 40, minQty: 1, maxQty: 2 },
      { name: 'Wolf Fang', rarity: 'rare', chance: 15, minQty: 1, maxQty: 1 },
      { name: 'Spirit Fragment', rarity: 'epic', chance: 2, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'stone-golem',
    name: 'Stone Golem',
    category: 'mobs',
    level: 18,
    icon: '🗿',
    image: '',
    rarity: 'rare',
    description:
      'A massive construct of animated stone, found guarding ancient ruins. Extremely durable but slow.',
    lore:
      'Stone Golems were created by the Earth Clan centuries ago to guard their sacred sites. The magic sustaining them has not faded even after the clan disappeared.',
    synergy: 'Use wind or water jutsu to erode its defenses. Physical attacks are nearly ineffective.',
    attributes: [
      { label: 'Health', value: 850 },
      { label: 'Damage', value: '25-40' },
      { label: 'Experience', value: 180 },
      { label: 'Type', value: 'Construct' },
      { label: 'Weakness', value: 'Wind' },
    ],
    drops: [
      { name: 'Golem Core', rarity: 'rare', chance: 20, minQty: 1, maxQty: 1 },
      { name: 'Ancient Stone', rarity: 'uncommon', chance: 55, minQty: 1, maxQty: 5 },
      { name: 'Earth Crystal', rarity: 'epic', chance: 5, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'reinforced-bo-staff',
    name: 'Reinforced Bo Staff',
    category: 'weapons',
    level: 8,
    icon: '🪄',
    image: '/images/wiki/Reinforced_Bo_Staff.png',
    rarity: 'uncommon',
    description:
      'A sturdy bo staff reinforced with iron bands. Balanced and reliable, favored by taijutsu practitioners who want reach without sacrificing speed.',
    lore:
      'Crafted by the monks of the Iron Temple, these staves are given to those who pass the first trial of endurance. Each one is individually tested against a stone golem.',
    synergy:
      'Pairs well with Wind Release techniques. The reach bonus allows hitting from a safe distance while channeling jutsu.',
    attributes: [
      { label: 'Attack', value: '15-22' },
      { label: 'Durability', value: 120 },
      { label: 'Weight', value: 'Medium' },
      { label: 'Type', value: 'Staff' },
      { label: 'Req. Level', value: 8 },
    ],
    drops: [],
  },
  {
    id: 'kunai-pouch',
    name: 'Kunai Pouch',
    category: 'items',
    level: 1,
    icon: '👜',
    image: '/images/wiki/Kunai.png',
    rarity: 'common',
    description:
      'A leather pouch designed to hold kunai and small projectiles. Every ninja starts with one.',
    attributes: [
      { label: 'Capacity', value: 20 },
      { label: 'Weight', value: 'Light' },
      { label: 'Type', value: 'Accessory' },
    ],
    drops: [],
  },
  // ---- Exemplos de Rings (anéis) ----
  {
    id: 'ring-of-vigor',
    name: 'Ring of Vigor',
    category: 'items',
    itemType: 'ring',
    level: 20,
    icon: '💍',
    image: null,
    rarity: 'rare',
    description:
      'Anel comum de encontrar em drops de mobs de nível médio. Aumenta levemente a vida máxima do usuário.',
    attributes: [
      { label: 'Health', value: '+50' },
      { label: 'Type', value: 'Ring' },
      { label: 'Req. Level', value: 20 },
    ],
    drops: [],
  },
  {
    id: 'ring-of-focus',
    name: 'Ring of Focus',
    category: 'items',
    itemType: 'ring',
    level: 35,
    icon: '💍',
    image: null,
    rarity: 'epic',
    description:
      'Anel raro que aumenta a reserva de chakra. Placeholder — substituir por um anel real quando a equipe confirmar nome, variantes e fonte de obtenção.',
    attributes: [
      { label: 'Chakra', value: '+80' },
      { label: 'Type', value: 'Ring' },
      { label: 'Req. Level', value: 35 },
    ],
    drops: [],
  },
  {
    id: 'minor-healing-potion',
    name: 'Minor Healing Potion',
    category: 'items',
    level: 1,
    icon: '🧪',
    image: '',
    rarity: 'common',
    description:
      'A basic potion that restores a small amount of health. Essential for early survival.',
    attributes: [
      { label: 'Heal', value: 50 },
      { label: 'Cooldown', value: '10s' },
      { label: 'Type', value: 'Consumable' },
    ],
    drops: [],
  },
  {
    id: 'iron-katana',
    name: 'Iron Katana',
    category: 'weapons',
    level: 15,
    icon: '⚔️',
    image: '/images/wiki/Katana_Display.png',
    rarity: 'rare',
    description:
      'A well-forged katana made from iron. Its sharp blade can cut through most light armor with ease.',
    synergy: 'Critical hits with this weapon cause bleeding for 5 seconds.',
    attributes: [
      { label: 'Attack', value: '28-40' },
      { label: 'Durability', value: 200 },
      { label: 'Weight', value: 'Medium' },
      { label: 'Type', value: 'Sword' },
      { label: 'Req. Level', value: 15 },
    ],
    drops: [],
  },
  {
    id: 'beginner-quest',
    name: 'The Path Begins',
    category: 'missions',
    level: 1,
    icon: '📜',
    image: '',
    rarity: 'common',
    description:
      'Your first mission as a ninja. Speak to the Village Elder and learn the basics of combat.',
    attributes: [
      { label: 'Difficulty', value: 'Easy' },
      { label: 'Reward', value: '100 XP + Kunai Pouch' },
      { label: 'Location', value: 'Leaf Village' },
    ],
    drops: [],
  },
  {
    id: 'lost-relic',
    name: 'The Lost Relic',
    category: 'missions',
    level: 25,
    icon: '🏺',
    image: '',
    rarity: 'rare',
    description:
      'A dangerous mission to recover an ancient relic from the Ruined Temple, guarded by Stone Golems.',
    synergy: 'Bring a team — the golems are too tough for solo players at this level.',
    attributes: [
      { label: 'Difficulty', value: 'Hard' },
      { label: 'Reward', value: '5000 XP + Rare Item' },
      { label: 'Location', value: 'Ancient Ruins' },
    ],
    drops: [],
  },
  {
    id: 'silkmoth',
    name: 'Silkmoth',
    category: 'mobs',
    level: 7,
    icon: '🦋',
    image: '',
    rarity: 'uncommon',
    description:
      'The mature form of the Larva. Silkmoths can spew silk to slow their prey.',
    lore:
      'Silkmoths are farmed by the Silkweavers Guild for their valuable thread, which is used in many ninja garments.',
    synergy: 'Fire attacks burn through their silk defenses instantly.',
    attributes: [
      { label: 'Health', value: 85 },
      { label: 'Damage', value: '6-10' },
      { label: 'Experience', value: 28 },
      { label: 'Type', value: 'Insect' },
      { label: 'Weakness', value: 'Fire' },
    ],
    drops: [
      { name: 'Silk Thread', rarity: 'uncommon', chance: 50, minQty: 2, maxQty: 5 },
      { name: 'Silkmoth Wing', rarity: 'rare', chance: 12, minQty: 1, maxQty: 2 },
    ],
  },
];

// ---- Funcoes "de acesso aos dados" ----
// Isoladas aqui de proposito: quando a API existir, essas 4 funcoes
// (e so' elas) precisarao virar chamadas fetch()/await. Nenhum
// componente da UI deve filtrar o array `entries` diretamente - sempre
// passar por estas funcoes, para a troca futura ficar em um lugar so'.

// Filtra todas as entries de uma categoria (usado na pagina /catalog/[category]).
export function getEntriesByCategory(category: string): WikiEntry[] {
  return entries.filter((e) => e.category === category);
}

// Busca uma unica entry pelo id/slug (usado na pagina /detail/[id]).
export function getEntryById(id: string): WikiEntry | undefined {
  return entries.find((e) => e.id === id);
}

// Retorna ate' `count` entries da MESMA categoria, excluindo a atual -
// usado na secao "Entradas relacionadas" da pagina de detalhe.
// Nota: nao ha nenhuma logica de relevancia aqui, e' so' "os N primeiros
// da categoria" - se crescer o catalogo, vale trocar por algo mais
// inteligente (ex: mesmo nivel, mesma raridade).
export function getRelatedEntries(entry: WikiEntry, count = 4): WikiEntry[] {
  return entries
    .filter((e) => e.category === entry.category && e.id !== entry.id)
    .slice(0, count);
}

// Agrupa as entries de uma categoria em faixas de 10 niveis (0-9, 10-19...),
// usado para organizar o catalogo em secoes por faixa de level.
export function getLevelGroups(category: string): { range: string; entries: WikiEntry[] }[] {
  const catEntries = getEntriesByCategory(category).sort((a, b) => a.level - b.level);
  const groups: Record<string, WikiEntry[]> = {};

  for (const entry of catEntries) {
    const tier = Math.floor(entry.level / 10);
    const start = tier * 10;
    const end = start + 9;
    const key = `${start}-${end}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  return Object.entries(groups).map(([range, ents]) => ({ range, entries: ents }));
}
