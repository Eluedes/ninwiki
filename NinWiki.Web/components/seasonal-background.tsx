'use client';

// Fundo do site PUBLICO: padrao japones repetido, no estilo do fundo da wiki do Fandom, desenhado aqui em SVG (nenhuma imagem baixada).
// A COR e' sempre a mesma (clara ou escura, conforme o tema do visitante). O que muda em cada epoca e' o FORMATO do desenho e o JEITO de se mexer:
//   fora de epoca = ondas (seigaiha) que deslizam e balancam; Natal = flocos de neve; Ano Novo = fogos de artificio; Valentine's Day = coracoes;
//   Pascoa = ovos; Halloween = teias de aranha. Os movimentos de cada epoca estao em app/globals.css (classes sb-*, ligadas por data-sb).
// Nada cai nem sobe na tela. Quem pede menos movimento ao aparelho ve o fundo parado.

import type { SeasonalTheme } from '@/lib/api-client';

interface Palette {
  bg: string;     // cor do fundo
  ring: string;   // cor das linhas do desenho
}
/** [claro, escuro]: iguais em todas as epocas (so' o formato muda). O claro parece com o do Fandom. */
const COLORS: [Palette, Palette] = [
  { bg: '#eef1f3', ring: '#d9dfe3' },
  { bg: '#0b1316', ring: '#1b2d33' },
];

const HEART = 'M0 6C-12 -4 -10 -14 -3 -13C0 -12 0 -9 0 -8C0 -9 0 -12 3 -13C10 -14 12 -4 0 6Z';
const f = (n: number) => n.toFixed(1);

/** Uma peca que se repete: tamanho e desenho (as linhas usam a cor `c`, o fundo `bg`). */
interface Tile { w: number; h: number; draw: (c: string, bg: string) => string }

/** Circulos de aneis (raio 40) em fileiras desencontradas; cada um tapa o de cima, como as escamas do seigaiha. `spokes` acrescenta raios (teia). */
function scales(spokes: boolean): Tile['draw'] {
  const centers: [number, number][] = [[40, -20], [0, 0], [80, 0], [40, 20], [0, 40], [80, 40], [40, 60]];   // de cima para baixo
  return (c, bg) => centers.map(([x, y]) => {
    const rings = [30, 20, 10].map((r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="2"/>`).join('');
    const web = spokes ? Array.from({ length: 8 }, (_, k) => `<line x1="${x}" y1="${y}" x2="${f(x + 40 * Math.cos(k * Math.PI / 4))}" y2="${f(y + 40 * Math.sin(k * Math.PI / 4))}" stroke="${c}" stroke-width="1.5"/>`).join('') : '';
    return `<circle cx="${x}" cy="${y}" r="40" fill="${bg}" stroke="${c}" stroke-width="2"/>${rings}${web}`;
  }).join('');
}
/** Floco de neve: tres tracos cruzados com pontinhas. */
const flake = (x: number, y: number, r: number, c: string) => [0, 60, 120].map((a) => {
  const dx = r * Math.cos(a * Math.PI / 180), dy = r * Math.sin(a * Math.PI / 180);
  return `<line x1="${f(x - dx)}" y1="${f(y - dy)}" x2="${f(x + dx)}" y2="${f(y + dy)}" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`
    + `<circle cx="${f(x + dx)}" cy="${f(y + dy)}" r="1.6" fill="${c}"/><circle cx="${f(x - dx)}" cy="${f(y - dy)}" r="1.6" fill="${c}"/>`;
}).join('');
/** Fogo de artificio: raios saindo do centro com uma bolinha na ponta. */
const burst = (x: number, y: number, r: number, c: string) => Array.from({ length: 12 }, (_, i) => {
  const a = i * Math.PI / 6, c1 = Math.cos(a), s1 = Math.sin(a);
  return `<line x1="${f(x + c1 * r * 0.35)}" y1="${f(y + s1 * r * 0.35)}" x2="${f(x + c1 * r)}" y2="${f(y + s1 * r)}" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/><circle cx="${f(x + c1 * (r + 2.5))}" cy="${f(y + s1 * (r + 2.5))}" r="1.3" fill="${c}"/>`;
}).join('');
/** Coracao de contorno (e outro menor dentro). */
const heart = (x: number, y: number, c: string) => [1.2, 0.65].map((s) => `<path transform="translate(${x} ${y}) scale(${s})" d="${HEART}" fill="none" stroke="${c}" stroke-width="${f(1.6 / s)}"/>`).join('');
/** Ovo de Pascoa de contorno com uma faixa em ziguezague. */
const egg = (x: number, y: number, c: string) => `<g transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="1.6"><ellipse rx="9" ry="12"/><path d="M-8 2L-4 -2L0 2L4 -2L8 2"/><path d="M-8.5 7Q0 11 8.5 7"/></g>`;

/** O desenho de cada epoca ('none' = ondas). */
const TILES: Record<SeasonalTheme, Tile> = {
  none: { w: 80, h: 40, draw: scales(false) },
  christmas: { w: 60, h: 60, draw: (c) => flake(15, 15, 11, c) + flake(45, 45, 11, c) },
  newyear: { w: 70, h: 70, draw: (c) => burst(35, 35, 15, c) + [[0, 0], [70, 0], [0, 70], [70, 70]].map(([x, y]) => burst(x, y, 8, c)).join('') },
  valentine: { w: 48, h: 48, draw: (c) => heart(12, 12, c) + heart(36, 36, c) },
  easter: { w: 60, h: 60, draw: (c) => egg(15, 16, c) + egg(45, 46, c) },
  halloween: { w: 80, h: 40, draw: scales(true) },
};
const SCALE = 1.5;   // tamanho na tela = peca x 1.5

/** Imagem de fundo (data URI) de uma epoca com uma paleta. */
function tileUrl(t: Tile, p: Palette) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="${t.h}" viewBox="0 0 ${t.w} ${t.h}"><rect width="${t.w}" height="${t.h}" fill="${p.bg}"/>${t.draw(p.ring, p.bg)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Uma versao do fundo (clara ou escura); `show` diz em qual tema do visitante ela aparece. A camada e' maior que a tela para o balanco/pulso nao mostrar bordas. */
function Layer({ season, p, show }: { season: SeasonalTheme; p: Palette; show: string }) {
  const t = TILES[season];
  return (
    <div className={`absolute inset-0 overflow-hidden ${show}`} style={{ background: p.bg }}>
      <div className="sb-waves absolute -inset-8" style={{ backgroundImage: tileUrl(t, p), backgroundSize: `${t.w * SCALE}px ${t.h * SCALE}px`, ['--sb-tile' as string]: `${t.w * SCALE}px` }} />
    </div>
  );
}

/** Fundo fixo atras do site; `season` 'none' = fundo padrao (ondas). */
export function SeasonalBackground({ season }: { season: SeasonalTheme }) {
  return (
    <div aria-hidden data-sb={season} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Layer season={season} p={COLORS[0]} show="dark:hidden" />
      <Layer season={season} p={COLORS[1]} show="hidden dark:block" />
    </div>
  );
}
