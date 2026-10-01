// Dados das Vilas Ocultas, Clas e Organizacoes - usados como CONTEUDO INICIAL (seed) do banco.
//
// PADRAO DE IDIOMA (igual ao resto do site): os campos SEM sufixo (motto, description,
// longDescription, climate, clan.name/description, organization.name/description) estao em INGLES, o
// idioma principal; os campos "Pt" sao a versao em portugues. Em producao o conteudo e' editado no painel
// e a DeepL traduz EN -> PT sozinha; estes textos so' dao a partida.
// Excecao historica: nas vilas, `name` e' o nome em PORTUGUES e `englishName` o em ingles (o seed
// inverte: englishName vira o nome principal).

export type VillageId = 'leaf' | 'mist' | 'sand';

export interface Village {
  id: VillageId;
  name: string; // nome em portugues (historico) - ver comentario no topo
  englishName: string;
  element: string;
  motto: string;
  mottoPt: string;
  description: string; // resumo curto (usado no card)
  descriptionPt: string;
  longDescription: string; // texto completo (usado na pagina de detalhe)
  longDescriptionPt: string;
  emblem: string; // emoji usado como emblema da vila
  image?: string; // imagem local opcional; usa o emblema como fallback
  accentColor: string; // cor hexadecimal usada nos acentos visuais
  climate: string;
  climatePt: string;
  leader: string;
}

export const villages: Village[] = [
  {
    id: 'leaf',
    name: 'Vila da Folha',
    englishName: 'Leaf Village',
    element: 'Fire',
    motto: 'The leaf that protects the tree',
    mottoPt: 'A folha que protege a árvore',
    description:
      'The largest and most prosperous of the hidden villages, located in the Land of Fire. Known for its variety of clans and its strong sense of community.',
    descriptionPt:
      'A maior e mais próspera das vilas ocultas, situada no País do Fogo. Conhecida por sua diversidade de clãs e forte senso de comunidade.',
    longDescription:
      'The Hidden Leaf Village (Konohagakure) is the largest of the great shinobi villages. Founded by visionary leaders, it became a symbol of peace and cooperation between clans. Its shinobi value the determination to protect the next generation. The village is home to legendary clans and to the most prestigious Ninja Academy in the known world.',
    longDescriptionPt:
      'A Vila Oculta da Folha (Konohagakure) é a maior das grandes vilas shinobi. Fundada por líderes visionários, tornou-se símbolo de paz e cooperação entre clãs. Seus shinobis valorizam a determinação de proteger a próxima geração. A vila abriga clãs lendários e a Academia Ninja mais prestigiosa do mundo conhecido.',
    emblem: '🍃',
    image: '/images/villages/leaf.png',
    accentColor: '#558930',
    climate: 'Temperate, dense forests',
    climatePt: 'Temperado, florestas densas',
    leader: 'Leaf Kami',
  },
  {
    id: 'mist',
    name: 'Vila da Névoa',
    englishName: 'Mist Village',
    element: 'Water',
    motto: 'Beneath the mist, silence kills',
    mottoPt: 'Sob a névoa, o silêncio mata',
    description:
      'An island village wrapped in perpetual mist. Known for its relentless shinobi and its old, bloody graduation system.',
    descriptionPt:
      'Uma vila insular envolta em névoa perpétua. Conhecida por seus shinobis implacáveis e pelo antigo regime de graduação sangrento.',
    longDescription:
      'The Hidden Mist Village (Kirigakure) rises on the islands of the Land of Water, permanently covered by a thick fog. In the past it was called the "Village of the Bloody Mist" because of its brutal graduation exam. Today, under new leadership, it seeks reconstruction and redemption, but it keeps its reputation for producing the deadliest shinobi in the world.',
    longDescriptionPt:
      'A Vila Oculta da Névoa (Kirigakure) ergue-se nas ilhas do País da Água, permanentemente coberta por uma névoa espessa. No passado, era chamada de "Vila da Névoa Sangrenta" devido ao seu brutal exame de graduação. Hoje, sob nova liderança, busca reconstrução e redenção, mas mantém a reputação de formar os shinobis mais letais do mundo.',
    emblem: '🌊',
    image: '/images/villages/mist.png',
    accentColor: '#2D5686',
    climate: 'Humid, misty islands',
    climatePt: 'Úmido, ilhas nebulosas',
    leader: 'Mist Kami',
  },
  {
    id: 'sand',
    name: 'Vila da Areia',
    englishName: 'Sand Village',
    element: 'Wind',
    motto: 'The desert does not forgive the weak',
    mottoPt: 'O deserto não perdoa os fracos',
    description:
      'Located in the heart of the Land of Wind, this village thrives in a hostile environment. Its shinobi master the wind and the sand.',
    descriptionPt:
      'Situada no coração do País do Vento, esta vila prospera em um ambiente hostil. Seus shinobis dominam o vento e a areia.',
    longDescription:
      'The Hidden Sand Village (Sunagakure) lies in the vast desert of the Land of Wind. Surviving in such an inhospitable environment forged resilient shinobi and cunning strategists. The village is known for its sand and wind manipulators, and for a historic alliance with the Leaf Village. Its Kage rules wisely, balancing diplomacy and military strength.',
    longDescriptionPt:
      'A Vila Oculta da Areia (Sunagakure) localiza-se no vasto deserto do País do Vento. A sobrevivência em um ambiente tão inóspito forjou shinobis resilientes e estrategistas astutos. A vila é conhecida por seus manipuladores de areia e vento, e por uma aliança histórica com a Vila da Folha. Seu Kage comanda com sabedoria, equilibrando diplomacia e força militar.',
    emblem: '🏜️',
    image: '/images/villages/sand.png',
    accentColor: '#8F7029',
    climate: 'Desert, dry and hot',
    climatePt: 'Desértico, seco e quente',
    leader: 'Sand Kami',
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
  name: string; // ingles (principal)
  namePt: string;
  villageId: VillageId;
  description: string; // ingles (principal)
  descriptionPt: string;
  image?: string | null;
}

const LEAF_CLAN_EN = 'One of the clans offered during character creation for the Leaf Village.';
const LEAF_CLAN_PT = 'Um dos clãs oferecidos na criação de personagem da Vila da Folha.';

export const clans: Clan[] = [
  {
    id: 'yagyu',
    name: 'Yagyu Clan',
    namePt: 'Clã Yagyu',
    villageId: 'mist',
    description:
      'It began as war survivors and grew into a family of feudal lords, with enough wealth to train powerful shinobi quickly.',
    descriptionPt:
      'Começou como sobreviventes de guerra e se tornou uma família de senhores feudais, com riqueza suficiente para treinar shinobis poderosos rapidamente.',
  },
  { id: 'sasayaki', name: 'Sasayaki Clan', namePt: 'Clã Sasayaki', villageId: 'leaf', description: LEAF_CLAN_EN, descriptionPt: LEAF_CLAN_PT },
  { id: 'muteki', name: 'Muteki Clan', namePt: 'Clã Muteki', villageId: 'leaf', description: LEAF_CLAN_EN, descriptionPt: LEAF_CLAN_PT },
  { id: 'suwa', name: 'Suwa Clan', namePt: 'Clã Suwa', villageId: 'leaf', description: LEAF_CLAN_EN, descriptionPt: LEAF_CLAN_PT },
  { id: 'ukiyo', name: 'Ukiyo Clan', namePt: 'Clã Ukiyo', villageId: 'leaf', description: LEAF_CLAN_EN, descriptionPt: LEAF_CLAN_PT },
  {
    id: 'hayashi',
    name: 'Hayashi Clan',
    namePt: 'Clã Hayashi',
    villageId: 'sand',
    description: 'One of the clans offered during character creation for the Sand Village.',
    descriptionPt: 'Um dos clãs oferecidos na criação de personagem da Vila da Areia.',
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
  name: string; // ingles (principal)
  namePt: string;
  villageIds: VillageId[];
  description: string; // ingles (principal)
  descriptionPt: string;
}

export const organizations: Organization[] = [
  {
    id: 'anbu',
    name: 'ANBU',
    namePt: 'ANBU',
    villageIds: ['leaf', 'mist', 'sand'],
    description:
      "An elite special-operations corps answering directly to the village's Kage. High-risk infiltration, assassination and protection missions.",
    descriptionPt:
      'Corpo de operações especiais de elite, subordinado diretamente ao Kage da vila. Missões de infiltração, assassinato e proteção de alto risco.',
  },
  {
    id: 'hunter-nin',
    name: 'Hunter Nin',
    namePt: 'Hunter Nin',
    villageIds: ['leaf', 'mist', 'sand'],
    description:
      "Specialists in hunting down deserter shinobi and protecting the village's secrets, keeping techniques from falling into enemy hands.",
    descriptionPt:
      'Especializados em caçar shinobis desertores e proteger os segredos da vila, evitando que técnicas caiam em mãos inimigas.',
  },
  {
    id: 'sand-assassins',
    name: 'Sand Assassins',
    namePt: 'Assassinos da Areia',
    villageIds: ['sand'],
    description: 'A corps of assassination specialists exclusive to the Sand Village.',
    descriptionPt: 'Corporação de especialistas em assassinato exclusiva da Vila da Areia.',
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
