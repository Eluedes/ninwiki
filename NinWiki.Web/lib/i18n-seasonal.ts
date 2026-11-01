// Textos dos temas festivos (Natal, Ano Novo, Valentine's Day, Pascoa, Halloween): tela /admin/seasonal-theme e as saudacoes que o site publico mostra.
// Arquivo proprio so' para nao inchar lib/i18n.ts; o dicionario principal importa daqui (chave `seasonal`), com as MESMAS chaves em ingles (principal) e portugues.

const en = {
  adminTitle: 'Festive theme',
  adminSubtitle: 'Background, decorations and effects for holidays and special dates. It has nothing to do with the site colors. Only the S.Adm can change it, and the chosen theme becomes the default for every visitor.',
  activeNow: 'Active now', save: 'Save theme', saving: 'Saving...', saved: 'Saved. Visitors see the new theme on their next page load.', saveError: 'Could not save the theme.',
  loadError: 'Could not load the current theme.', loading: 'Loading', motionNote: 'Visitors who ask their device for reduced motion see a still background and the greeting.',
  suggestedDates: 'Suggested dates',
  none: 'No theme', noneDesc: 'The normal site: a sky with slow-moving clouds (day or night, following the light/dark theme), no greeting.', noneWhen: 'Rest of the year',
  christmas: 'Christmas', christmasDesc: 'Falling snow on a snowy ground with snowy trees, a Christmas tree, gifts, a snowman and Santa, plus a holiday greeting.', christmasWhen: '1 to 26 December',
  newyear: 'New Year', newyearDesc: 'Rockets rising and bursting into fireworks of many colors, plus a New Year greeting.', newyearWhen: '27 December to 2 January',
  valentine: "Valentine's Day", valentineDesc: 'Cherry trees, heart balloons that inflate and pop, and fireworks that burst into heart shapes.', valentineWhen: '1 to 14 February',
  easter: 'Easter', easterDesc: 'Green trees and colorful Easter eggs gently bobbing at the bottom of the page.', easterWhen: 'Two weeks before Easter Sunday (the date changes every year)',
  halloween: 'Halloween', halloweenDesc: 'A haunted tree, pumpkins and a spiderweb from the game, glowing strong and faint.', halloweenWhen: '15 to 31 October',
  greetingChristmas: 'Merry Christmas from Nin Codex!', greetingNewyear: 'Happy New Year from Nin Codex!', greetingValentine: "Happy Valentine's Day from Nin Codex!",
  greetingEaster: 'Happy Easter from Nin Codex!', greetingHalloween: 'Happy Halloween from Nin Codex!', dismiss: 'Dismiss',
};

export type SeasonalDict = Record<keyof typeof en, string>;
export const seasonalEn: SeasonalDict = en;

export const seasonalPt: SeasonalDict = {
  adminTitle: 'Tema festivo',
  adminSubtitle: 'Fundo, enfeites e efeitos para feriados e datas comemorativas. Não tem nada a ver com as cores do site. Só o S.Adm troca, e o tema escolhido vira o padrão para todos os visitantes.',
  activeNow: 'Ativo agora', save: 'Salvar tema', saving: 'Salvando...', saved: 'Salvo. Os visitantes veem o tema novo na próxima vez que abrirem uma página.', saveError: 'Não foi possível salvar o tema.',
  loadError: 'Não foi possível carregar o tema atual.', loading: 'Carregando', motionNote: 'Quem pede menos movimento ao aparelho vê o fundo parado e a saudação.',
  suggestedDates: 'Datas sugeridas',
  none: 'Sem tema', noneDesc: 'O site normal: um céu com nuvens passando devagar (dia ou noite, conforme o tema claro/escuro), sem saudação.', noneWhen: 'O resto do ano',
  christmas: 'Natal', christmasDesc: 'Neve caindo sobre um chão de neve com árvores nevadas, árvore de Natal, presentes, boneco de neve e o Papai Noel, e uma saudação de Natal.', christmasWhen: '1 a 26 de dezembro',
  newyear: 'Ano Novo', newyearDesc: 'Foguetes subindo e estourando em fogos de várias cores, e uma saudação de Ano Novo.', newyearWhen: '27 de dezembro a 2 de janeiro',
  valentine: "Valentine's Day", valentineDesc: 'Cerejeiras, balões de coração que enchem e estouram, e fogos que estouram em formato de coração.', valentineWhen: '1 a 14 de fevereiro',
  easter: 'Páscoa', easterDesc: 'Árvores verdes e ovos de Páscoa coloridos balançando de leve no pé da página.', easterWhen: 'Duas semanas antes do domingo de Páscoa (a data muda todo ano)',
  halloween: 'Halloween', halloweenDesc: 'Uma árvore assombrada, abóboras e uma teia do jogo, que brilham forte e fraco.', halloweenWhen: '15 a 31 de outubro',
  greetingChristmas: 'Feliz Natal do Nin Codex!', greetingNewyear: 'Feliz Ano Novo do Nin Codex!', greetingValentine: "Feliz Valentine's Day do Nin Codex!",
  greetingEaster: 'Feliz Páscoa do Nin Codex!', greetingHalloween: 'Feliz Halloween do Nin Codex!', dismiss: 'Fechar',
};
