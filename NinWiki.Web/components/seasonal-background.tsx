'use client';

// Fundo do site PUBLICO: padrao japones de ondas (seigaiha), o mesmo estilo do fundo da wiki do Fandom, mas desenhado aqui em SVG (nenhuma imagem baixada).
// Fora de epoca usa a cor padrao do site; em cada epoca festiva (Natal, Ano Novo, Valentine's Day, Pascoa, Halloween) muda a paleta e o JEITO de se mexer
// (ver app/globals.css, classes sb-*): as ondas deslizam devagar, um brilho "respira" nos cantos e uma faixa de luz passa. Nada cai nem sobe na tela.
// Quem pede menos movimento ao aparelho ve o fundo parado. Duas paletas por tema: clara (parecida com a do Fandom) e escura.

import type { SeasonalTheme } from '@/lib/api-client';

interface Palette {
  bg: string;      // cor do fundo das ondas
  ring: string;    // cor dos aneis (linhas das ondas)
  glowA: string;   // brilho do canto de cima/esquerda
  glowB: string;   // brilho do canto de baixo/direita
  sheen: string;   // faixa de luz que passa
}

/** Paletas: [claro, escuro] de cada epoca ('none' = fundo padrao). */
const PALETTES: Record<SeasonalTheme, [Palette, Palette]> = {
  none: [
    { bg: '#eef1f3', ring: '#d9dfe3', glowA: '#22c55e22', glowB: '#38bdf822', sheen: '#ffffff88' },
    { bg: '#0b1316', ring: '#162428', glowA: '#22c55e26', glowB: '#38bdf21f', sheen: '#9be8c010' },
  ],
  christmas: [
    { bg: '#eaf1fb', ring: '#cfdcef', glowA: '#93c5fd44', glowB: '#ffffff99', sheen: '#ffffffaa' },
    { bg: '#0a1426', ring: '#1b3157', glowA: '#60a5fa40', glowB: '#e0f2fe30', sheen: '#bfdbfe20' },
  ],
  newyear: [
    { bg: '#f6f1e3', ring: '#e8dcbd', glowA: '#f2b84b44', glowB: '#f472b633', sheen: '#fff3c8aa' },
    { bg: '#0b0b1f', ring: '#25254f', glowA: '#f2b84b3a', glowB: '#a78bfa30', sheen: '#fcd34d22' },
  ],
  valentine: [
    { bg: '#faeef2', ring: '#efd3dc', glowA: '#fb718544', glowB: '#f9a8d444', sheen: '#ffffff99' },
    { bg: '#1c0a16', ring: '#431832', glowA: '#ff6b9d3a', glowB: '#be123c33', sheen: '#fda4af1a' },
  ],
  easter: [
    { bg: '#f3f0fa', ring: '#ddd6ee', glowA: '#a7f3d066', glowB: '#fde68a66', sheen: '#ffffff99' },
    { bg: '#14112a', ring: '#2a2559', glowA: '#a7f3d03a', glowB: '#fde68a30', sheen: '#e9d5ff1a' },
  ],
  halloween: [
    { bg: '#f8efe6', ring: '#ecd6c0', glowA: '#fb923c55', glowB: '#a855f733', sheen: '#fff7ed99' },
    { bg: '#150b1c', ring: '#37182c', glowA: '#ff8a1f44', glowB: '#7c3aed30', sheen: '#fdba7416' },
  ],
};

/** Peca que se repete: 80 x 40, circulos de aneis (raio 40) cada um tapando o de cima, como as escamas de onda do seigaiha. */
function tile(p: Palette) {
  const centers: [number, number][] = [[40, -20], [0, 0], [80, 0], [40, 20], [0, 40], [80, 40], [40, 60]];   // de cima para baixo: o de baixo cobre o de cima
  const rings = centers.map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="40" fill="${p.bg}" stroke="${p.ring}" stroke-width="2"/>`
    + [30, 20, 10].map((r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${p.ring}" stroke-width="2"/>`).join(''),
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><rect width="80" height="40" fill="${p.bg}"/>${rings}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Uma versao do fundo (clara ou escura): ondas + dois brilhos + faixa de luz. `show` diz em qual tema do visitante ela aparece. */
function Layers({ p, show }: { p: Palette; show: string }) {
  const glow = (c: string) => `radial-gradient(circle, ${c}, transparent 65%)`;
  return (
    <div className={`absolute inset-0 overflow-hidden ${show}`}>
      <div className="sb-waves absolute inset-0" style={{ backgroundImage: tile(p), backgroundSize: '120px 60px', ['--sb-tile' as string]: '120px' }} />
      <div className="sb-glow absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full" style={{ background: glow(p.glowA) }} />
      <div className="sb-glow absolute -bottom-1/4 -right-1/4 h-3/4 w-3/4 rounded-full" style={{ background: glow(p.glowB), animationDelay: '-4s' }} />
      <div className="sb-sheen absolute inset-y-0 left-0 w-1/3 -skew-x-12" style={{ background: `linear-gradient(90deg, transparent, ${p.sheen}, transparent)` }} />
    </div>
  );
}

/** Fundo fixo atras do site; `season` 'none' = fundo padrao. */
export function SeasonalBackground({ season }: { season: SeasonalTheme }) {
  const [light, dark] = PALETTES[season];
  return (
    <div aria-hidden data-sb={season} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Layers p={light} show="dark:hidden" />
      <Layers p={dark} show="hidden dark:block" />
    </div>
  );
}
