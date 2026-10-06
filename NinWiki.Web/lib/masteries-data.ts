// Dados de Masteries, Atributos e Jutsus. Portados do projeto de
// referencia (wiki-fan-nin2), que ja tinha a modelagem certa para este
// conteudo - lib/data.ts (WikiEntry generico) nao encaixa bem aqui
// porque Masteries/Jutsus tem campos muito especificos (chakraCost,
// castTime, tier, etc.) que nao existem em mob/item/arma.
//
// Assim como lib/data.ts, isto e' mock estatico ate a Fase 1 do
// backend existir - quando a API estiver pronta, estas mesmas funcoes
// helper (masteryById, jutsusByMastery, etc.) viram chamadas fetch().

export type MasteryId =
  | 'fire'
  | 'wind'
  | 'lightning'
  | 'earth'
  | 'water'
  | 'medical'
  | 'weapon'
  | 'taijutsu';

export type AttributeId = 'strength' | 'agility' | 'intellect' | 'chakra' | 'fortitude';

export type JutsuTier = 1 | 2 | 3 | 4 | 5;

export type MasteryPathId =
  | 'wind-elemental-unarmed'
  | 'wind-fan-leque'
  | 'water-elemental-unarmed'
  | 'water-pipe-cachimbo'
  | 'taijutsu-agility'
  | 'taijutsu-strength-gf'
  | 'medical-intellect-magical'
  | 'medical-chakra-support'
  | 'weapon-intellect-thrown'
  | 'weapon-strength-melee';

export interface MasteryPath {
  id: MasteryPathId;
  label: string;
  description: string;
  attributes: AttributeId[];
  requirement?: string;
}

export interface Mastery {
  id: MasteryId;
  name: string;
  englishName: string;
  type: 'elemental' | 'non-elemental';
  element: string; // nome japones (ex: "Katon")
  description: string; // resumo curto (usado no card)
  longDescription: string; // texto completo (usado na pagina de detalhe)
  icon: string; // chave de fallback para MasteryIcon (ex: "flame")
  image?: string; // imagem local da mastery, quando cadastrada
  color: string; // cor hexadecimal usada em icones/acentos desta mastery
  attributes: AttributeId[]; // atributos relacionados, exibidos na sidebar
  paths?: MasteryPath[]; // caminhos confirmados; ausente quando não há classificação por caminho
}

export interface Attribute {
  id: AttributeId;
  name: string;
  englishName: string;
  description: string; // ingles (principal)
  descriptionPt?: string; // portugues
  icon: string;
}

export interface Jutsu {
  id: string;
  name: string;
  englishName: string;
  masteryId: MasteryId;
  tier: JutsuTier; // 1 (básico) a 5 (mestre)
  chakraCost: number;
  description: string;
  longDescription: string;
  effect: string;
  range: string;
  castTime: string; // ex: "2 selos"
  cooldown: string;
  icon: string;
  // Obrigatório quando a mastery possui `paths`; masteries sem caminhos não usam este campo.
  pathId?: MasteryPathId;
  // GIF demonstrativo opcional. Exemplo: /images/jutsus/fuuton-renkuudan.gif
  gif?: string;
}

// ---- Atributos ----
export const attributes: Attribute[] = [
  {
    id: 'strength',
    name: 'Força',
    englishName: 'Strength',
    description: 'Scales melee weapons and Taijutsu with Gentle Fist GF enabled.',
    descriptionPt: 'Escala armas corpo a corpo e Taijutsu com Punho Gentil GF ativado.',
    icon: 'fist',
  },
  {
    id: 'agility',
    name: 'Agilidade',
    englishName: 'Agility',
    description: 'Scales the standard Taijutsu path.',
    descriptionPt: 'Escala o caminho padrão de Taijutsu.',
    icon: 'wind',
  },
  {
    id: 'intellect',
    name: 'Intelecto',
    englishName: 'Intellect',
    description: 'Increases elemental jutsu damage, Medical magic damage and ranged Weapon throws.',
    descriptionPt: 'Aumenta o dano de jutsus elementais, o dano mágico Médico e os arremessos de Arma à distância.',
    icon: 'brain',
  },
  {
    id: 'chakra',
    name: 'Chakra',
    englishName: 'Chakra',
    description: 'On the Medical support path, more Chakra increases damage and healing.',
    descriptionPt: 'No caminho de suporte Médico, mais Chakra aumenta o dano e a cura.',
    icon: 'sparkles',
  },
  {
    id: 'fortitude',
    name: 'Fortitude',
    englishName: 'Fortitude',
    description: 'Increases maximum health and damage resistance.',
    descriptionPt: 'Aumenta a vida máxima e a resistência a dano.',
    icon: 'shield',
  },
];

// ---- Masteries (os 8 caminhos: 5 elementais + 3 nao-elementais) ----
export const masteries: Mastery[] = [
  {
    id: 'fire',
    name: 'Fogo',
    englishName: 'Fire',
    type: 'elemental',
    element: 'Katon',
    description: 'Domínio das chamas. Dano explosivo e área de efeito.',
    longDescription:
      'A Mastery de Fogo (Katon) é uma das mais ofensivas. Especializa-se em dano explosivo e ataques em área. Os shinobis que dominam o fogo são temidos por sua capacidade de destruir múltiplos inimigos simultaneamente. O fogo é forte contra vento, mas fraco contra água.',
    icon: 'flame',
    image: '/images/masteries/ElementSelect_Fire.png',
    color: '#ef4444',
    attributes: ['intellect'],
  },
  {
    id: 'wind',
    name: 'Vento',
    englishName: 'Wind',
    type: 'elemental',
    element: 'Fuuton',
    description: 'Dois caminhos: elemental desarmado ou arma Fan-Leque.',
    longDescription:
      'A Mastery de Vento (Fuuton) possui dois caminhos de uso: elemental desarmado e arma Fan-Leque.',
    icon: 'wind',
    image: '/images/masteries/ElementSelect_Wind.png',
    color: '#467434',
    attributes: [],
    paths: [
      { id: 'wind-elemental-unarmed', label: 'Elemental desarmado', description: 'Caminho elemental sem arma.', attributes: [] },
      { id: 'wind-fan-leque', label: 'Arma: Fan-Leque', description: 'Caminho de arma Fan-Leque.', attributes: [] },
    ],
  },
  {
    id: 'lightning',
    name: 'Raio',
    englishName: 'Lightning',
    type: 'elemental',
    element: 'Raiton',
    description: 'Velocidade extrema e perfuração. Dano elétrico letal.',
    longDescription:
      'A Mastery de Raio (Raiton) é a mais rápida de todas. Seus jutsus executam-se em velocidades impossíveis de acompanhar a olho nu. O raio é forte contra terra, mas fraco contra vento. Ideal para shinobis que valorizam velocidade acima de tudo.',
    icon: 'zap',
    image: '/images/masteries/ElementSelect_Lightning.png',
    color: '#facc15',
    attributes: ['intellect'],
  },
  {
    id: 'earth',
    name: 'Terra',
    englishName: 'Earth',
    type: 'elemental',
    element: 'Doton',
    description: 'Defesa sólida e controle de terreno. Resistência inabalável.',
    longDescription:
      'A Mastery de Terra (Doton) é a mais defensiva das masteries elementais. Permite criar barreiras, manipular o solo e até endurecer a própria pele. A terra é forte contra água, mas fraca contra raio. Essencial para tanques e defensores.',
    icon: 'mountain',
    image: '/images/masteries/ElementSelect_Earth.png',
    color: '#a16207',
    attributes: ['intellect'],
  },
  {
    id: 'water',
    name: 'Água',
    englishName: 'Water',
    type: 'elemental',
    element: 'Suiton',
    description: 'Dois caminhos: elemental desarmado ou arma Pipe-Cachimbo.',
    longDescription:
      'A Mastery de Água (Suiton) possui dois caminhos de uso: elemental desarmado e arma Pipe-Cachimbo.',
    icon: 'droplet',
    image: '/images/masteries/ElementSelect_Water.png',
    color: '#3b82f6',
    attributes: [],
    paths: [
      { id: 'water-elemental-unarmed', label: 'Elemental desarmado', description: 'Caminho elemental sem arma.', attributes: [] },
      { id: 'water-pipe-cachimbo', label: 'Arma: Pipe-Cachimbo', description: 'Caminho de arma Pipe-Cachimbo.', attributes: [] },
    ],
  },
  {
    id: 'medical',
    name: 'Médica',
    englishName: 'Medical',
    type: 'non-elemental',
    element: 'Medical',
    description: 'Dano mágico por Intelecto; dano e cura de suporte por Chakra.',
    longDescription:
      'A Mastery Médica possui um caminho de dano mágico escalado com Intelecto e um caminho de dano e suporte. A cura de suporte escala com Chakra.',
    icon: 'heart-pulse',
    image: '/images/masteries/ElementSelect_Medical.png',
    color: '#72B1B1',
    attributes: ['intellect', 'chakra'],
    paths: [
      { id: 'medical-intellect-magical', label: 'Intelecto: dano mágico', description: 'Caminho de dano mágico escalado com Intelecto.', attributes: ['intellect'] },
      { id: 'medical-chakra-support', label: 'Chakra: dano e suporte', description: 'Quanto mais Chakra, maior o dano e a cura. O foco deste caminho é suporte.', attributes: ['chakra'] },
    ],
  },
  {
    id: 'weapon',
    name: 'Arma',
    englishName: 'Weapon',
    type: 'non-elemental',
    element: 'Weapon',
    description: 'Arremessos à distância por Intelecto ou armas corpo a corpo por Força.',
    longDescription:
      'A Mastery de Arma possui um caminho de arremessos à distância escalado com Intelecto e um caminho de armas corpo a corpo escalado com Força.',
    icon: 'swords',
    image: '/images/masteries/ElementSelect_Weapon.png',
    color: '#94a3b8',
    attributes: ['strength', 'intellect'],
    paths: [
      { id: 'weapon-intellect-thrown', label: 'Intelecto: arremessos à distância', description: 'Caminho de armas arremessadas e alcance.', attributes: ['intellect'] },
      { id: 'weapon-strength-melee', label: 'Força: arma corpo a corpo', description: 'Caminho de armas corpo a corpo.', attributes: ['strength'] },
    ],
  },
  {
    id: 'taijutsu',
    name: 'Taijutsu',
    englishName: 'Taijutsu',
    type: 'non-elemental',
    element: 'Taijutsu',
    description: 'Agilidade no caminho padrão ou Força com Punho Gentil GF ativado.',
    longDescription:
      'A Mastery de Taijutsu possui um caminho padrão escalado com Agilidade e um caminho de Força que requer a ativação de Punho Gentil GF.',
    icon: 'fist',
    image: '/images/masteries/ElementSelect_Taijutsu.png',
    color: '#9C4E3D',
    attributes: ['strength', 'agility'],
    paths: [
      { id: 'taijutsu-agility', label: 'Agilidade: padrão', description: 'Caminho padrão escalado com Agilidade.', attributes: ['agility'] },
      { id: 'taijutsu-strength-gf', label: 'Força: Punho Gentil GF', description: 'Caminho de Força.', attributes: ['strength'], requirement: 'Requer ativação de Punho Gentil GF.' },
    ],
  },
];

// ---- Jutsus (tecnicas de cada mastery) ----
export const jutsus: Jutsu[] = [
  {
    id: 'katon-goukakyuu',
    name: 'Bola de Fogo',
    englishName: 'Fireball Jutsu',
    masteryId: 'fire',
    tier: 1,
    chakraCost: 15,
    description: 'Cria uma bola de fogo que causa dano em área.',
    longDescription:
      'O Jutsu Bola de Fogo é a técnica fundamental da Mastery de Fogo. O usuário acumula chakra nos pulmões e o expulsa como uma esfera flamejante. É o jutsu de entrada para qualquer shinobi que deseje seguir o caminho do Katon.',
    effect: 'Dano de fogo em área',
    range: 'Médio (5-10m)',
    castTime: '1 selo',
    cooldown: '3 segundos',
    icon: 'flame',
  },
  {
    id: 'katon-ryuuka',
    name: 'Dragão de Fogo',
    englishName: 'Fire Dragon Jutsu',
    masteryId: 'fire',
    tier: 3,
    chakraCost: 45,
    description: 'Invoca um dragão de chamas que persegue o alvo.',
    longDescription:
      'Uma técnica avançada de Katon que molda as chamas na forma de um dragão. O dragão persegue o alvo e explode em contato, causando dano massivo. Requer controle de chakra refinado para manter a forma.',
    effect: 'Dano de fogo direcionado',
    range: 'Longo (10-20m)',
    castTime: '3 selos',
    cooldown: '8 segundos',
    icon: 'flame',
  },
  {
    id: 'katon-housenka',
    name: 'Flores de Fogo',
    englishName: 'Phoenix Flower Jutsu',
    masteryId: 'fire',
    tier: 2,
    chakraCost: 25,
    description: 'Dispara múltiplas pequenas bolas de fogo.',
    longDescription:
      'O usuário expulsa várias pequenas esferas de fogo, como pétalas de uma flor. Cada esfera causa dano individual, tornando difícil para o inimigo esquivar de todas. Pode ser combinada com shurikens.',
    effect: 'Múltiplos projéteis de fogo',
    range: 'Médio (5-15m)',
    castTime: '2 selos',
    cooldown: '5 segundos',
    icon: 'flame',
  },
  {
    id: 'fuuton-renkuudan',
    name: 'Esfera de Vento',
    englishName: 'Wind Sphere',
    masteryId: 'wind',
    tier: 1,
    chakraCost: 12,
    description: 'Comprime ar em uma esfera cortante lançada ao inimigo.',
    longDescription:
      'Técnica basica de Fuuton que comprime uma esfera de ar denso, disparada em alta velocidade contra o alvo. Serve como o jutsu de entrada para a Mastery de Vento.',
    effect: 'Dano de corte',
    range: 'Médio (5-10m)',
    castTime: '1 selo',
    cooldown: '3 segundos',
    icon: 'wind',
  },
  {
    id: 'fuuton-daitoppa',
    name: 'Grande Rajada',
    englishName: 'Great Breakthrough',
    masteryId: 'wind',
    tier: 2,
    chakraCost: 22,
    description: 'Libera uma rajada de vento que empurra e corta inimigos em cone.',
    longDescription:
      'Uma tecnica versatil que pode ser usada tanto ofensivamente quanto para dispersar fumaça/nevoa criada por outros jutsus. O impacto empurra inimigos leves para tras.',
    effect: 'Dano em cone + repulsao',
    range: 'Médio (8m)',
    castTime: '2 selos',
    cooldown: '6 segundos',
    icon: 'wind',
  },
  {
    id: 'raiton-jibashi',
    name: 'Corrente Elétrica',
    englishName: 'Electric Current',
    masteryId: 'lightning',
    tier: 1,
    chakraCost: 14,
    description: 'Descarrega eletricidade pelo corpo, atordoando quem tocar.',
    longDescription:
      'Jutsu de entrada da Mastery de Raio. O usuario carrega o corpo com eletricidade estatica, atordoando brevemente qualquer inimigo que entre em contato fisico direto.',
    effect: 'Dano + atordoamento curto',
    range: 'Corpo a corpo',
    castTime: '1 selo',
    cooldown: '4 segundos',
    icon: 'zap',
  },
  {
    id: 'raiton-chidori',
    name: 'Mil Pássaros',
    englishName: 'Chidori',
    masteryId: 'lightning',
    tier: 4,
    chakraCost: 60,
    description: 'Concentra uma quantidade massiva de chakra elétrico na mão para um golpe perfurante.',
    longDescription:
      'Uma das tecnicas mais reconheciveis de Raiton. Exige altíssimo controle de chakra para concentrar eletricidade suficiente na palma da mão sem se autolesionar. O som lembra o canto de mil passaros. Perfura quase qualquer defesa.',
    effect: 'Dano perfurante massivo',
    range: 'Corpo a corpo',
    castTime: '3 selos',
    cooldown: '15 segundos',
    icon: 'zap',
  },
  {
    id: 'doton-doryuuheki',
    name: 'Muralha de Terra',
    englishName: 'Earth Wall',
    masteryId: 'earth',
    tier: 1,
    chakraCost: 16,
    description: 'Ergue uma parede de terra solida para bloquear ataques.',
    longDescription:
      'Jutsu defensivo fundamental de Doton. Manipula o solo ao redor para erguer uma muralha capaz de bloquear projeteis e jutsus de dano moderado.',
    effect: 'Bloqueio de ataques',
    range: 'Curto (proximo ao usuario)',
    castTime: '1 selo',
    cooldown: '6 segundos',
    icon: 'mountain',
  },
  {
    id: 'doton-shinjuu',
    name: 'Decapitação Oculta',
    englishName: 'Hidden Mole',
    masteryId: 'earth',
    tier: 2,
    chakraCost: 24,
    description: 'Move-se sob a terra para emboscar o alvo por baixo.',
    longDescription:
      'O usuario mergulha no solo e se desloca silenciosamente ate emergir sob o inimigo, puxando-o parcialmente para dentro da terra e desequilibrando-o.',
    effect: 'Imobilizacao parcial + dano',
    range: 'Curto',
    castTime: '2 selos',
    cooldown: '10 segundos',
    icon: 'mountain',
  },
  {
    id: 'suiton-suijinheki',
    name: 'Parede de Água',
    englishName: 'Water Wall',
    masteryId: 'water',
    tier: 1,
    chakraCost: 15,
    description: 'Ergue uma parede de agua para absorver e desviar ataques.',
    longDescription:
      'Jutsu defensivo de Suiton que cria uma barreira liquida capaz de absorver o impacto de jutsus de fogo e projeteis fisicos leves.',
    effect: 'Bloqueio de ataques',
    range: 'Curto',
    castTime: '1 selo',
    cooldown: '5 segundos',
    icon: 'droplet',
  },
  {
    id: 'suiton-suiryuudan',
    name: 'Dragão de Água',
    englishName: 'Water Dragon Jutsu',
    masteryId: 'water',
    tier: 3,
    chakraCost: 42,
    description: 'Invoca um dragao de agua que atinge e arrasta o alvo.',
    longDescription:
      'Tecnica avançada que exige uma fonte de agua proxima. Molda um grande volume de agua na forma de um dragao que colide com o alvo, causando dano e arrastando-o.',
    effect: 'Dano + deslocamento do alvo',
    range: 'Longo (10-15m)',
    castTime: '3 selos',
    cooldown: '9 segundos',
    icon: 'droplet',
  },
  {
    id: 'iryou-mystic-palm',
    name: 'Palma Mística',
    englishName: 'Mystic Palm',
    masteryId: 'medical',
    pathId: 'medical-chakra-support',
    tier: 1,
    chakraCost: 18,
    description: 'Canaliza chakra curativo pelas mãos para tratar ferimentos.',
    longDescription:
      'Tecnica basica de qualquer shinobi medico. Concentra chakra nas palmas das maos, acelerando a regeneracao de tecidos de um aliado ferido.',
    effect: 'Cura ao longo do tempo',
    range: 'Corpo a corpo',
    castTime: '1 selo',
    cooldown: '4 segundos',
    icon: 'heart-pulse',
  },
  {
    id: 'iryou-byakugou',
    name: 'Selo de Força Sublime',
    englishName: 'Strength of a Hundred Seal',
    masteryId: 'medical',
    pathId: 'medical-chakra-support',
    tier: 3,
    chakraCost: 80,
    description: 'Armazena chakra por anos para uma cura instantanea de ferimentos quase fatais.',
    longDescription:
      'A tecnica medica mais avançada conhecida. Requer decadas de acumulo de chakra em um selo na testa. Quando ativado, cura ferimentos que normalmente seriam fatais quase instantaneamente.',
    effect: 'Cura massiva instantanea',
    range: 'Corpo a corpo',
    castTime: 'Instantâneo',
    cooldown: '60 segundos',
    icon: 'heart-pulse',
  },
  {
    id: 'buki-shuriken-chain',
    name: 'Corrente de Shurikens',
    englishName: 'Shuriken Chain',
    masteryId: 'weapon',
    tier: 1,
    chakraCost: 10,
    description: 'Arremessa uma sequencia rapida de shurikens.',
    longDescription:
      'Tecnica de entrada de Bukijutsu. O usuario arremessa varios shurikens em sequencia rapida, dificultando a esquiva total do alvo.',
    effect: 'Multiplos hits de dano fisico',
    range: 'Médio (5-12m)',
    castTime: 'Instantâneo',
    cooldown: '3 segundos',
    icon: 'swords',
  },
  {
    id: 'buki-katana-iai',
    name: 'Corte Relâmpago',
    englishName: 'Iaido Slash',
    masteryId: 'weapon',
    tier: 3,
    chakraCost: 30,
    description: 'Desembainha e golpeia com a katana em um unico movimento fulminante.',
    longDescription:
      'Tecnica de espada baseada no iaido: o corte acontece no exato instante em que a lamina deixa a bainha, tornando o golpe quase impossivel de prever ou bloquear a tempo.',
    effect: 'Dano de corte critico',
    range: 'Corpo a corpo',
    castTime: 'Instantâneo',
    cooldown: '10 segundos',
    icon: 'swords',
  },
  {
    id: 'tai-leaf-hurricane',
    name: 'Furacão da Folha',
    englishName: 'Leaf Hurricane',
    masteryId: 'taijutsu',
    pathId: 'taijutsu-agility',
    tier: 2,
    chakraCost: 0,
    description: 'Um chute giratório de baixa altura que derruba o oponente.',
    longDescription:
      'Tecnica classica de Taijutsu. O usuario gira o corpo executando um chute baixo e amplo, desequilibrando qualquer inimigo proximo. Nao consome chakra, apenas condicionamento fisico.',
    effect: 'Dano + derrubada',
    range: 'Corpo a corpo',
    castTime: 'Instantâneo',
    cooldown: '6 segundos',
    icon: 'fist',
  },
  {
    id: 'tai-eight-gates',
    name: 'Oitavo Portão',
    englishName: 'Eighth Gate',
    masteryId: 'taijutsu',
    pathId: 'taijutsu-strength-gf',
    tier: 4,
    chakraCost: 0,
    description: 'Técnica proibida que destrói o próprio corpo pelo poder.',
    longDescription:
      'Uma das técnicas mais perigosas de Taijutsu. O usuário abre os Portões de Chakra, liberando o limite natural do corpo. Em troca de poder devastador, causa dano severo aos próprios músculos. Pode derrotar oponentes muito superiores, mas com grande custo pessoal.',
    effect: 'Dano físico massivo + auto-dano',
    range: 'Corpo a corpo',
    castTime: 'Instantâneo',
    cooldown: '20 segundos',
    icon: 'fist',
  },
];

// ---- Funcoes de acesso (mesmo padrao de lib/data.ts - isoladas para
// facilitar a troca por chamadas de API no futuro) ----
export function masteryById(id: string): Mastery | undefined {
  return masteries.find((m) => m.id === id);
}

/** Acha um atributo pelo id nos dados estaticos. */
export function attributeById(id: string): Attribute | undefined {
  return attributes.find((a) => a.id === id);
}

/** Jutsus de uma mastery (dados estaticos usados pelo seed). */
export function jutsusByMastery(masteryId: string): Jutsu[] {
  return jutsus.filter((j) => j.masteryId === masteryId);
}

/** Acha um caminho de mastery pelo id. */
export function masteryPathById(masteryId: string, pathId?: MasteryPathId): MasteryPath | undefined {
  if (!pathId) return undefined;
  return masteryById(masteryId)?.paths?.find((path) => path.id === pathId);
}

/** Jutsus de um caminho de mastery. */
export function jutsusByMasteryPath(masteryId: string, pathId: MasteryPathId): Jutsu[] {
  return jutsus.filter((j) => j.masteryId === masteryId && j.pathId === pathId);
}

/** Acha um jutsu pelo id. */
export function jutsuById(id: string): Jutsu | undefined {
  return jutsus.find((j) => j.id === id);
}
