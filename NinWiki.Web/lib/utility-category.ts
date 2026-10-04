// Categoria "Utility" (Utilidade) dos jutsus: jutsus que NAO pertencem a nenhuma mastery - qualquer pessoa pode usar.
// No banco e' um jutsu com mastery_id vazio (null). Como nao existe uma linha de mastery para ela, o site usa este objeto "de mentira"
// (UTILITY_MASTERY) para reaproveitar o card, a pagina de lista e o link do jutsu; a rota publica e' /masteries/utility.
import type { ApiMastery } from '@/lib/api-client';

/** Id usado na URL (/masteries/utility) e no seletor do editor para "sem mastery". */
export const UTILITY_ID = 'utility';

/** Mastery "virtual" da categoria Utility (nao existe no banco; nao vem de /masteries). */
export const UTILITY_MASTERY: ApiMastery = {
  id: UTILITY_ID,
  name: 'Utility',
  namePt: 'Utilidade',
  type: 'non-elemental',
  element: 'Utility',
  description: 'Techniques that do not belong to any mastery: anyone can use them.',
  longDescription: 'Utility jutsus are not tied to a mastery, so every player can learn and use them.',
  descriptionPt: 'Técnicas que não pertencem a nenhuma mastery: qualquer pessoa pode usar.',
  longDescriptionPt: 'Os jutsus de Utilidade não dependem de uma mastery, então todo jogador pode aprender e usar.',
  icon: 'wrench',
  color: '#14b8a6',
  image: null,
  gif: null,
  paths: [],
  attributeIds: [],
};
