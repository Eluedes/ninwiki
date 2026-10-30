// Categoria "Utility" (Utilidade) dos jutsus: jutsus que NAO pertencem a nenhuma mastery - qualquer pessoa pode usar.
// No banco e' um jutsu com mastery_id vazio (null). Como nao existe uma linha de mastery para ela, o site usa este objeto "de mentira"
// (UTILITY_MASTERY) para reaproveitar o card, a pagina de lista e o link do jutsu; a rota publica e' /masteries/utility.
import type { ApiMastery } from '@/lib/api-client';

/** Id usado na URL (/masteries/utility) e no seletor do editor para "sem mastery". */
export const UTILITY_ID = 'utility';

/** Link da "mastery" nas paginas publicas: Utility NAO e' mastery, tem area propria (/utility); as demais vao para /masteries/<id>. */
export function masteryHref(m: { id: string }): string {
  return m.id === UTILITY_ID ? '/utility' : `/masteries/${m.id}`;
}

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

/** Id usado na URL (/masteries/npc) da secao "NPC": os Jutsus NPC (versoes dos jutsus ensinadas/usadas por NPC). */
export const NPC_ID = 'npc';

/** Mastery "virtual" da secao NPC (nao existe no banco): reaproveita o card e a pagina de lista das masteries. */
export const NPC_MASTERY: ApiMastery = {
  id: NPC_ID,
  name: 'NPC Jutsu',
  namePt: 'Jutsu NPC',
  type: 'non-elemental',
  element: 'NPC',
  description: 'Versions of the jutsus taught and used by NPCs. They share names with the mastery and Utility jutsus, but have small differences.',
  longDescription: 'NPC jutsus are the versions of the techniques that NPCs teach and use. They look like the player versions, but have small differences.',
  descriptionPt: 'Versões dos jutsus ensinadas e usadas por NPCs. Têm os mesmos nomes dos jutsus de mastery e de Utilidade, mas com pequenas diferenças.',
  longDescriptionPt: 'Os Jutsus NPC são as versões das técnicas que os NPCs ensinam e usam. Parecem as versões dos jogadores, mas têm pequenas diferenças.',
  icon: 'users',
  color: '#f59e0b',
  image: null,
  gif: null,
  paths: [],
  attributeIds: [],
};
