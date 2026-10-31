// Missoes do jogo (secao /missions): a ficha de cada uma vem de data/missions.json, gerado por NinWiki.Api/scripts/importar_missoes_fandom.py
// (Nin Online Wiki no Fandom, conferido com os textos do cliente do jogo). Fica em json e nao no banco porque a tabela de conteudo nao tem campos de
// missao (objetivos, recompensas, tipo, rank) - ver o aviso no README. Este arquivo e' so' tipos e funcoes puras (sem React): serve ao servidor e ao navegador.

import raw from '@/data/missions.json';

export type MissionType = 'daily' | 'repeatable' | 'story' | 'side';
export type MissionArea = 'leaf' | 'sand' | 'mist' | 'takumi' | 'land-of-spirits' | 'land-of-iron';

/** Ficha de uma missao. Texto com [[Alvo|Rotulo]] vem do wiki: o site transforma em link/miniatura quando o alvo e' um item publicado. */
export interface Mission {
  id: string;
  name: string;
  level: number | null;
  rank: string | null;
  type: MissionType;
  areas: MissionArea[];
  npc: string | null;
  location: string | null;
  quote: string | null;
  summary: string | null;
  description: string | null;
  objectives: string[];
  requirements: string[];
  rewards: { exp: string | null; ryo: string | null; extra: string | null; list: string[] };
  sections: { title: string; lines: string[] }[];
  inClient: boolean;
  /** Conferencia com os textos do cliente do jogo (so' nomes e textos; nivel/rank/recompensas nao existem no cliente). */
  clientStatus?: 'confirmed' | 'partial' | 'divergent' | 'fandom-only';
  clientName?: string;
  clientNote?: string;
  source: string;
}

/** Todas as missoes, por nivel (as sem nivel vao para o fim) e depois por nome. */
export function listMissions(): Mission[] {
  const all = (raw as { missions: Mission[] }).missions;
  return [...all].sort((a, b) => (a.level ?? 9999) - (b.level ?? 9999) || a.name.localeCompare(b.name));
}

/** Uma missao pelo id (undefined se nao existe). */
export function getMission(id: string): Mission | undefined {
  return (raw as { missions: Mission[] }).missions.find((m) => m.id === id);
}

/** Um pedaco de texto: simples, ou referencia [[alvo|rotulo]] a uma pagina do wiki. */
export type Segment = { text: string } | { target: string; label: string };

/** Quebra "Kill [[Bat]]s x50" em pedacos (texto / referencia). */
export function parseMarkup(input: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of input.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    if (m.index > last) out.push({ text: input.slice(last, m.index) });
    out.push({ target: m[1].trim(), label: (m[2] ?? m[1]).trim() });
    last = m.index + m[0].length;
  }
  if (last < input.length) out.push({ text: input.slice(last) });
  return out;
}

/** Todos os alvos [[...]] citados numa missao (para o servidor buscar so' esses itens). */
export function missionTargets(m: Mission): string[] {
  const texts = [
    ...(m.npc ? [m.npc] : []), ...(m.location ? [m.location] : []), ...m.objectives, ...m.requirements, ...m.rewards.list,
    ...(m.rewards.extra ? [m.rewards.extra] : []), ...m.sections.flatMap((s) => s.lines), ...(m.summary ? [m.summary] : []),
  ];
  const set = new Set<string>();
  for (const t of texts) for (const seg of parseMarkup(t)) if ('target' in seg) set.add(seg.target.toLowerCase());
  return [...set];
}

/** Texto plano (sem colchetes) - usado na busca e no resumo dos cartoes. */
export function plainMarkup(input: string): string {
  return parseMarkup(input).map((s) => ('text' in s ? s.text : s.label)).join('');
}
