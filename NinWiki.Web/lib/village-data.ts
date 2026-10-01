// Dados das Vilas Ocultas. Assim como lib/masteries-data.ts, portado
// do projeto de referencia e mockado ate a Fase 1 do backend existir.

export type VillageId = 'leaf' | 'mist' | 'sand';

export interface Village {
  id: VillageId;
  name: string;
  englishName: string;
  element: string;
  motto: string;
  description: string; // resumo curto (usado no card)
  longDescription: string; // texto completo (usado na pagina de detalhe)
  emblem: string; // emoji usado como emblema da vila
  image?: string; // imagem local opcional; usa o emblema como fallback
  accentColor: string; // cor hexadecimal usada nos acentos visuais
  climate: string;
  leader: string;
}

export const villages: Village[] = [
  {
    id: 'leaf',
    name: 'Vila da Folha',
    englishName: 'Leaf Village',
    element: 'Fogo',
    motto: 'A folha que protege a árvore',
    description:
      'A maior e mais próspera das vilas ocultas, situada no País do Fogo. Conhecida por sua diversidade de clãs e forte senso de comunidade.',
    longDescription:
      'A Vila Oculta da Folha (Konohagakure) é a maior das grandes vilas shinobi. Fundada por líderes visionários, tornou-se símbolo de paz e cooperação entre clãs. Seus shinobis valorizam a determinação de proteger a próxima geração. A vila abriga clãs lendários e a Academia Ninja mais prestigiosa do mundo conhecido.',
    emblem: '🍃',
    image: '/images/villages/leaf.png',
    accentColor: '#558930',
    climate: 'Temperado, florestas densas',
    leader: 'Kami da Folha',
  },
  {
    id: 'mist',
    name: 'Vila da Névoa',
    englishName: 'Mist Village',
    element: 'Água',
    motto: 'Sob a névoa, o silêncio mata',
    description:
      'Uma vila insular envolta em névoa perpétua. Conhecida por seus shinobis implacáveis e pelo antigo regime de graduação sangrento.',
    longDescription:
      'A Vila Oculta da Névoa (Kirigakure) ergue-se nas ilhas do País da Água, permanentemente coberta por uma névoa espessa. No passado, era chamada de "Vila da Névoa Sangrenta" devido ao seu brutal exame de graduação. Hoje, sob nova liderança, busca reconstrução e redenção, mas mantém a reputação de formar os shinobis mais letais do mundo.',
    emblem: '🌊',
    image: '/images/villages/mist.png',
    accentColor: '#2D5686',
    climate: 'Úmido, ilhas nebulosas',
    leader: 'Kami da Névoa',
  },
  {
    id: 'sand',
    name: 'Vila da Areia',
    englishName: 'Sand Village',
    element: 'Vento',
    motto: 'O deserto não perdoa os fracos',
    description:
      'Situada no coração do País do Vento, esta vila prospera em um ambiente hostil. Seus shinobis dominam o vento e a areia.',
    longDescription:
      'A Vila Oculta da Areia (Sunagakure) localiza-se no vasto deserto do País do Vento. A sobrevivência em um ambiente tão inóspito forjou shinobis resilientes e estrategistas astutos. A vila é conhecida por seus manipuladores de areia e vento, e por uma aliança histórica com a Vila da Folha. Seu Kage comanda com sabedoria, equilibrando diplomacia e força militar.',
    emblem: '🏜️',
    image: '/images/villages/sand.png',
    accentColor: '#8F7029',
    climate: 'Desértico, seco e quente',
    leader: 'Kami da Areia',
  },
];

/** Acha uma vila pelo id nos dados estaticos. */
export function villageById(id: string): Village | undefined {
  return villages.find((v) => v.id === id);
}

// ---- Clãs ----
// Cada clã pertence a uma vila (escolhido na criação de personagem).
// Nomes reais confirmados na wiki oficial (Clans | Nin Online Wiki);
// descrições longas ainda precisam ser escritas pela equipe.
export interface Clan {
  id: string;
  name: string;
  villageId: VillageId;
  description: string;
  image?: string | null;
}

export const clans: Clan[] = [
  {
    id: 'yagyu',
    name: 'Clã Yagyu',
    villageId: 'mist',
    description:
      'Começou como sobreviventes de guerra e se tornou uma família de senhores feudais, com riqueza suficiente para treinar shinobis poderosos rapidamente.',
  },
  {
    id: 'sasayaki',
    name: 'Clã Sasayaki',
    villageId: 'leaf',
    description: 'Um dos clãs oferecidos na criação de personagem da Vila da Folha.',
  },
  {
    id: 'muteki',
    name: 'Clã Muteki',
    villageId: 'leaf',
    description: 'Um dos clãs oferecidos na criação de personagem da Vila da Folha.',
  },
  {
    id: 'suwa',
    name: 'Clã Suwa',
    villageId: 'leaf',
    description: 'Um dos clãs oferecidos na criação de personagem da Vila da Folha.',
  },
  {
    id: 'ukiyo',
    name: 'Clã Ukiyo',
    villageId: 'leaf',
    description: 'Um dos clãs oferecidos na criação de personagem da Vila da Folha.',
  },
  {
    id: 'hayashi',
    name: 'Clã Hayashi',
    villageId: 'sand',
    description: 'Um dos clãs oferecidos na criação de personagem da Vila da Areia.',
  },
];

/** Cla's de uma vila. */
export function clansByVillage(villageId: string): Clan[] {
  return clans.filter((c) => c.villageId === villageId);
}

// ---- Organizações ----
// Diferente de um clã (escolhido na criação do personagem) e de um
// rank (hierarquia normal da vila), uma Organização é um corpo
// especializado que um ninja pode ingressar depois - ex: ANBU, Hunter
// Nin. Não pertencem a uma vila só (ANBU e Hunter Nin existem em mais
// de uma vila), por isso `villageIds` é uma lista.
export interface Organization {
  id: string;
  name: string;
  villageIds: VillageId[];
  description: string;
}

export const organizations: Organization[] = [
  {
    id: 'anbu',
    name: 'ANBU',
    villageIds: ['leaf', 'mist', 'sand'],
    description:
      'Corpo de operações especiais de elite, subordinado diretamente ao Kage da vila. Missões de infiltração, assassinato e proteção de alto risco.',
  },
  {
    id: 'hunter-nin',
    name: 'Hunter Nin',
    villageIds: ['leaf', 'mist', 'sand'],
    description:
      'Especializados em caçar shinobis desertores e proteger os segredos da vila, evitando que técnicas caiam em mãos inimigas.',
  },
  {
    id: 'sand-assassins',
    name: 'Sand Assassins',
    villageIds: ['sand'],
    description: 'Corporação de especialistas em assassinato exclusiva da Vila da Areia.',
  },
];

/** Organizacoes que atuam em uma vila. */
export function organizationsByVillage(villageId: string): Organization[] {
  return organizations.filter((o) => o.villageIds.includes(villageId as VillageId));
}

// Posicao aproximada (em % da largura/altura) de cada vila no Mapa do
// Mundo (ver app/(wiki)/(lore)/map/page.tsx). Ajuste estes numeros se
// quiser reposicionar os marcadores - sao percentuais simples, nao
// coordenadas de um mapa real.
export const villageMapPosition: Record<VillageId, { x: number; y: number }> = {
  leaf: { x: 38, y: 32 },
  mist: { x: 72, y: 62 },
  sand: { x: 22, y: 68 },
};
