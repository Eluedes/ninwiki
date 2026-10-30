/**
 * Summary: tipos, estilos e geometria do mapa-mundi (versao do site do "mapa do Atlas").
 *
 * Os dados vem de `public/game-maps/world-atlas.json` (gerado por `NinWiki.Api/scripts/extrair_mapas_do_jogo.py`); as imagens sao do cliente do jogo.
 * Coordenadas sempre em BLOCOS do mundo inteiro (5042 x 2836), as mesmas do Atlas.
 */

import type { useLanguage } from '@/components/providers/language-provider';

export type LoreDict = ReturnType<typeof useLanguage>['dict']['lore'];

/** Area do mundo: posicao e tamanho em blocos, zona, vila, casas e faixa de nivel dos mobs de caca (ou null). */
export type AMap = { id: number; x: number; y: number; w: number; h: number; z: string; v: number; hs: number; lv: [number, number] | null };
/** Entrada de um marcador: [tipo, nome, nome PT, nivel (so' chefes)]. */
export type MarkEntry = [string, string, string, number?];
/** Marcador: [tipo, x, y (mundo), id da area, entradas, [titulo, titulo PT] do predio ou null, id de destino (viagem) ou 0]. */
export type MarkRaw = [string, number, number, number, MarkEntry[], [string, string] | null, number];
export type Mark = { k: string; x: number; y: number; m: number; e: MarkEntry[]; t: [string, string] | null; to: number; screen?: [number, number, number] | null };
export type Route = { from: number; fx: number; fy: number; to: number; how: string; label: string; pt: string };
export type Edge = { a: number; b: number; dir: number; gap: number; s0: number; s1: number };
export type Soft = { a: number; b: number; side: number; ax: number; ay: number; bx: number; by: number };
export type Region = { village: number; name: string; pt: string; members: number[]; x0: number; y0: number; x1: number; y1: number };
export type AtlasRaw = { maps: AMap[]; marks: MarkRaw[]; routes: Route[]; edges: Edge[]; soft: Soft[]; regions: Region[] };
/** Ligacao tracejada entre duas areas (ma/mb = segmento de cada lado; ca/cb = centros). */
export type Connector = { ma: number[]; mb: number[]; ca: [number, number]; cb: [number, number]; straight: boolean; covered: boolean; both: boolean };
export type AtlasData = Omit<AtlasRaw, 'marks'> & { marks: Mark[]; byId: Map<number, AMap>; connectors: Connector[] };

/** Estilo de cada tipo de marcador: simbolo (glifo desenhado no canvas), cor, zoom minimo e chave do rotulo no dicionario. */
export type KindStyle = { glyph: string; color: string; min: number; label: keyof LoreDict };
export const KINDS: Record<string, KindStyle> = {
  hospital: { glyph: '+', color: '#f26b6b', min: 0.55, label: 'mapKindHospital' },
  bounty: { glyph: '!', color: '#f5c252', min: 0.55, label: 'mapKindBounty' },
  missions: { glyph: '?', color: '#ffd24d', min: 0.55, label: 'mapKindMissions' },
  boss: { glyph: '☠', color: '#f24d47', min: 0.2, label: 'mapKindBoss' },
  dungeon: { glyph: '⌂', color: '#80b8ff', min: 0.55, label: 'mapKindDungeon' },
  travel: { glyph: '➜', color: '#ff8c61', min: 0.45, label: 'mapKindTravel' },
  shop: { glyph: '$', color: '#ffc74d', min: 1.1, label: 'mapKindShop' },
  mailbox: { glyph: '✉', color: '#a8ccff', min: 1.1, label: 'mapKindMailbox' },
  notice: { glyph: '≡', color: '#ebd19e', min: 1.1, label: 'mapKindNotice' },
  barber: { glyph: '✂', color: '#f7a8db', min: 1.1, label: 'mapKindBarber' },
  headbands: { glyph: '◆', color: '#c7dbf5', min: 1.1, label: 'mapKindHeadbands' },
  polling: { glyph: '✔', color: '#dcdcff', min: 1.1, label: 'mapKindPolling' },
  leaderboards: { glyph: '♛', color: '#ffdb57', min: 1.1, label: 'mapKindLeaderboards' },
  wedding: { glyph: '♥', color: '#ff99b3', min: 1.1, label: 'mapKindWedding' },
  checkpoint: { glyph: '⚑', color: '#8feba8', min: 1.1, label: 'mapKindCheckpoint' },
  capture: { glyph: '◎', color: '#e6e6e6', min: 1.1, label: 'mapKindCapture' },
};
export const KIND_LIST = Object.keys(KINDS);
/** Tipos importantes: aparecem em zoom mais baixo e ficam por cima dos rotulos. */
export const IMPORTANT = new Set(['hospital', 'bounty', 'missions', 'boss', 'dungeon', 'travel']);
/** Tipos que a legenda nao deixa ligar/desligar (ficam quietos enquanto ha filtro). */
export const KEY_HIDDEN = new Set(['headbands', 'wedding', 'checkpoint']);
/** Cor da zona (borda do chip e das faixas) como no Atlas. */
export const ZONE_COLOR: Record<string, string> = {
  'Safe Zone': '#80f087', 'Danger Zone': '#ffab00', 'War Zone': '#ff594d', 'Arena Zone': '#ffffbf', 'Parkour Zone': '#66e6f2', 'No Zone': '#bfbfbf',
};
/** Cor do nome de cada vila no mapa. */
export const VILLAGE_COLOR: Record<number, string> = { 1: '#99ff80', 2: '#ffb366', 3: '#99b3ff', 4: '#ffffff' };

/** Nivel 0..80: verde nos baixos, passando por amarelo, ate' vermelho no topo do jogo. */
export const TOP_LEVEL = 80;
export const levelColor = (lv: number, a: number) => `hsla(${Math.round(120 - 120 * Math.min(1, lv / TOP_LEVEL))}, 75%, 50%, ${a})`;
export const levelText = (lv: [number, number]) => (lv[0] === lv[1] ? `${lv[0]}` : `${lv[0]}-${lv[1]}`);

let promessa: Promise<AtlasData> | null = null;
/** Carrega e prepara os dados do mundo sob demanda (uma vez so'; o site nao depende do Atlas em tempo de execucao). */
export function carregarAtlas(): Promise<AtlasData> {
  return (promessa ??= import('@/public/game-maps/world-atlas.json').then((m) => preparar(m.default as unknown as AtlasRaw)));
}

/** Ligacoes entre areas: bordas com vao (edges) e saidas "macias" (soft), com a mesma geometria do Atlas. Calculado uma vez, nao depende da vista. */
function preparar(raw: AtlasRaw): AtlasData {
  const byId = new Map(raw.maps.map((m) => [m.id, m]));
  const marks: Mark[] = raw.marks.map(([k, x, y, m, e, t, to]) => ({ k, x, y, m, e, t, to }));
  const covers = (x0: number, y0: number, x1: number, y1: number, skip: AMap[]) => {
    const lx = Math.min(x0, x1), hx = Math.max(x0, x1), ly = Math.min(y0, y1), hy = Math.max(y0, y1);
    return raw.maps.some((m) => !skip.includes(m) && m.x < hx && m.x + m.w > lx && m.y < hy && m.y + m.h > ly);
  };
  const connectors: Connector[] = [];
  const add = (a: AMap, b: AMap, ma: number[], mb: number[], both: boolean) => {
    const ca: [number, number] = [(ma[0] + ma[2]) / 2, (ma[1] + ma[3]) / 2];
    const cb: [number, number] = [(mb[0] + mb[2]) / 2, (mb[1] + mb[3]) / 2];
    const horizontal = Math.abs(ca[0] - cb[0]) >= Math.abs(ca[1] - cb[1]);
    const straight = horizontal ? Math.abs(ca[1] - cb[1]) <= 1.5 : Math.abs(ca[0] - cb[0]) <= 1.5;
    connectors.push({ ma, mb, ca, cb, straight, covered: covers(ca[0], ca[1], cb[0], cb[1], [a, b]), both });
  };
  for (const e of raw.edges) {
    const a = byId.get(e.a), b = byId.get(e.b);
    if (e.gap <= 0 || !a || !b) continue;
    const ay = e.dir === 1 ? a.y + a.h : a.y, by = e.dir === 1 ? b.y : b.y + b.h;
    const ax = e.dir === 3 ? a.x + a.w : a.x, bx = e.dir === 3 ? b.x : b.x + b.w;
    if (e.dir <= 1) add(a, b, [e.s0, ay, e.s1, ay], [e.s0, by, e.s1, by], true);
    else add(a, b, [ax, e.s0, ax, e.s1], [bx, e.s0, bx, e.s1], true);
  }
  const softPairs = new Set(raw.soft.map((s) => `${s.a}>${s.b}`));
  const done = new Set<string>();
  for (const s of raw.soft) {
    const key = [s.a, s.b].sort().join('|');
    const a = byId.get(s.a), b = byId.get(s.b);
    if (done.has(key) || !a || !b) continue;
    done.add(key);
    const ax = a.x + s.ax, ay = a.y + s.ay, bx = b.x + s.bx, by = b.y + s.by;
    const v = s.side <= 1;
    add(a, b, v ? [ax - 1.5, ay, ax + 1.5, ay] : [ax, ay - 1.5, ax, ay + 1.5], v ? [bx - 1.5, by, bx + 1.5, by] : [bx, by - 1.5, bx, by + 1.5], softPairs.has(`${s.b}>${s.a}`));
  }
  return { ...raw, marks, byId, connectors };
}
