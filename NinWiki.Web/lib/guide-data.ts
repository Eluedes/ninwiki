// Dados de Profissões (proficiencies) e Ranks Ninja, exibidos dentro
// da categoria "Guia" (/catalog/guides), junto dos Atributos (que já
// existem em lib/masteries-data.ts e são reaproveitados, não duplicados
// aqui). Nomes confirmados na wiki oficial (Proficiencies e Ranks).
//
// IDIOMA: description (e name de arcos, village/stages de summons) esta' em INGLES (principal); os campos
// "Pt" sao o portugues. Conteudo inicial do banco (seed); em producao a DeepL traduz EN -> PT.
// Excecao historica: em profissoes/ranks/summons `name` e' o nome em PORTUGUES e `englishName` o em ingles.

// ---- Profissões (proficiencies) ----
// O jogo separa em duas famílias: "Coleta" (Gathering) e "Criação"
// (Crafting). Esse agrupamento é só pra exibição - cada profissão é
// independente, não precisa de outra entidade pra isso.
export type ProfessionGroup = 'gathering' | 'crafting';

export interface Profession {
  id: string;
  name: string;
  englishName: string;
  group: ProfessionGroup;
  description: string;
  descriptionPt: string;
  icon: string; // emoji usado como icone
}

export const professions: Profession[] = [
  {
    id: 'mining',
    name: 'Mineração',
    englishName: 'Mining',
    group: 'gathering',
    description:
      'Extracts ore from mining nodes around the world. Ore can be refined into bars through Forging.',
    descriptionPt:
      'Extrai minérios de nós de mineração pelo mundo. Os minérios podem ser refinados em barras através da Forja.',
    icon: '⛏️',
  },
  {
    id: 'woodcutting',
    name: 'Corte de Madeira',
    englishName: 'Woodcutting',
    group: 'gathering',
    description:
      'Chops trees (basic, fine and huge variants) to obtain wood, used in Carpentry and other crafting professions.',
    descriptionPt:
      'Corta árvores (variantes básica, fina e enorme) para obter madeira, usada em Carpintaria e outras profissões de criação.',
    icon: '🪓',
  },
  {
    id: 'fishing',
    name: 'Pesca',
    englishName: 'Fishing',
    group: 'gathering',
    description:
      'Catches fish and special items in bodies of water. Requires a fishing rod bought from a vendor NPC.',
    descriptionPt:
      'Captura peixes e itens especiais em corpos d\'água. Requer uma vara de pesca comprada de um NPC vendedor.',
    icon: '🎣',
  },
  {
    id: 'foraging',
    name: 'Forrageamento',
    englishName: 'Foraging',
    group: 'gathering',
    description: 'Gathers herbs and natural materials found in the world, used in crafting recipes.',
    descriptionPt: 'Coleta ervas e materiais naturais encontrados no mundo, usados em receitas de criação.',
    icon: '🌿',
  },
  {
    id: 'forging',
    name: 'Forja',
    englishName: 'Forging',
    group: 'crafting',
    description: 'Turns ore gathered through Mining into bars and equipment.',
    descriptionPt: 'Transforma minérios coletados na Mineração em barras e equipamentos.',
    icon: '🔨',
  },
];

/** Profissoes de um grupo (dados estaticos do Guia). */
export function professionsByGroup(group: ProfessionGroup): Profession[] {
  return professions.filter((p) => p.group === group);
}

// ---- Ranks Ninja ----
// Hierarquia normal de progressão dentro de uma vila (do mais baixo
// ao mais alto). Diferente de uma Organização (ANBU, Hunter Nin - ver
// lib/village-data.ts), que não é um rank, é um corpo especializado
// que se ingressa à parte.
export interface NinjaRank {
  id: string;
  name: string;
  englishName: string;
  order: number; // posicao na hierarquia, do mais baixo (1) ao mais alto
  description: string;
  descriptionPt: string;
}

export const ninjaRanks: NinjaRank[] = [
  {
    id: 'academy-student',
    name: 'Estudante da Academia',
    englishName: 'Academy Student',
    order: 1,
    description:
      "Not yet considered part of the ninja forces. Makes up the Academy's student body, where the basic techniques and the workings of the shinobi world are learned.",
    descriptionPt:
      'Ainda não é considerado parte das forças ninja. Compõe o corpo estudantil da Academia, onde aprende as técnicas básicas e o funcionamento do mundo shinobi.',
  },
  {
    id: 'genin',
    name: 'Genin',
    englishName: 'Genin',
    order: 2,
    description: "First rank after graduating from the Academy and joining the village's regular ninja forces.",
    descriptionPt: 'Primeiro rank ao se formar na Academia e ingressar nas forças ninja regulares da vila.',
  },
  {
    id: 'chunin',
    name: 'Chunin',
    englishName: 'Chunin',
    order: 3,
    description: 'Intermediate rank. Chunin and above can host RP (roleplay) missions.',
    descriptionPt: 'Rank intermediário. Chunin e acima podem hospedar missões de RP (interpretação de papel).',
  },
  {
    id: 'jonin',
    name: 'Jonin',
    englishName: 'Jonin',
    order: 4,
    description: 'Advanced rank, with considerable authority within the village.',
    descriptionPt: 'Rank avançado, com autoridade considerável dentro da vila.',
  },
  {
    id: 'kage',
    name: 'Kage',
    englishName: 'Kage',
    order: 5,
    description: 'The most talented ninja in the village, and its leader. Top of the normal rank hierarchy.',
    descriptionPt: 'O ninja mais talentoso da vila, e seu líder. Topo da hierarquia normal de ranks.',
  },
];

/** Ranks ninja em ordem crescente. */
export function ninjaRanksSorted(): NinjaRank[] {
  return [...ninjaRanks].sort((a, b) => a.order - b.order);
}

// ---- Story Arcs ----
// Capítulos de conteúdo narrativo lançados ao longo do tempo. Nomes
// confirmados nas notas de atualização oficiais do jogo.
export interface StoryArc {
  id: string;
  name: string;
  namePt: string;
  levelRange: string; // faixa de nível recomendada pra participar
  description: string;
  descriptionPt: string;
}

export const storyArcs: StoryArc[] = [
  {
    id: 'land-of-spirits',
    name: 'Land of Spirits Arc',
    namePt: 'Arco da Terra dos Espíritos',
    levelRange: '60-70',
    description:
      'The most recent arc. Level cap raised to 70, with Advanced Jutsu unlocked for every mastery and a corrupted spirit realm to restore, guided by Lady Kitsune.',
    descriptionPt:
      'Arco mais recente. Level cap elevado a 70, com Jutsu Avançado liberado para cada mastery e um reino espiritual corrompido para restaurar, guiado pela Lady Kitsune.',
  },
  {
    id: 'kinsen-arc',
    name: 'Kinsen Arc',
    namePt: 'Arco Kinsen',
    levelRange: '15-25',
    description: 'Early progression arc, referenced in the official leveling guides as the milestone to keep farming level 15 to 25 mobs.',
    descriptionPt: 'Arco de progressão inicial, referenciado nos guias oficiais de leveling como marco pra continuar farmando mobs de nível 15 a 25.',
  },
];

/** Acha um arco de historia pelo id. */
export function storyArcById(id: string): StoryArc | undefined {
  return storyArcs.find((a) => a.id === id);
}

// ---- Summons (invocações) ----
// Toda invocação evolui em 3 formas conforme o nível do vínculo:
// Jovem (1-3), Adolescente (4-6), Adulta (7+) - por isso `stages` é
// um array de exatamente 3 textos, não um campo único.
export interface Summon {
  id: string;
  name: string;
  englishName: string;
  village: string; // vila/local onde o contrato e' obtido (ex: "Leaf Village")
  villagePt: string;
  stages: [string, string, string]; // [Young, Teen, Adult] - ingles
  stagesPt: [string, string, string]; // [Jovem, Adolescente, Adulta]
}

export const summons: Summon[] = [
  {
    id: 'toad',
    name: 'Sapo',
    englishName: 'Toad',
    village: 'Leaf Village',
    villagePt: 'Vila da Folha',
    stages: ['Small tadpole, low damage', 'Medium combat toad', 'Adult toad, high damage and health'],
    stagesPt: ['Girino pequeno, dano baixo', 'Sapo de combate médio', 'Sapo adulto, dano e vida altos'],
  },
  {
    id: 'slug',
    name: 'Lesma',
    englishName: 'Slug',
    village: 'Leaf Village',
    villagePt: 'Vila da Folha',
    stages: ['Young slug, support focus', 'Moderate-healing slug', 'Adult slug, area healing'],
    stagesPt: ['Lesma jovem, foco em suporte', 'Lesma de cura moderada', 'Lesma adulta, cura em área'],
  },
  {
    id: 'monkey',
    name: 'Macaco',
    englishName: 'Monkey',
    village: 'Universal',
    villagePt: 'Universal',
    stages: ['Agile cub', 'Warrior monkey', 'Adult monkey, high attack speed'],
    stagesPt: ['Filhote ágil', 'Macaco guerreiro', 'Macaco adulto, alta velocidade de ataque'],
  },
  {
    id: 'snake',
    name: 'Cobra',
    englishName: 'Snake',
    village: 'Universal',
    villagePt: 'Universal',
    stages: ['Young snake, weak venom', 'Combat snake with venom', 'Adult snake, potent venom'],
    stagesPt: ['Cobra jovem, veneno fraco', 'Cobra de combate com veneno', 'Cobra adulta, veneno potente'],
  },
];

/** Acha um summon pelo id. */
export function summonById(id: string): Summon | undefined {
  return summons.find((s) => s.id === id);
}
