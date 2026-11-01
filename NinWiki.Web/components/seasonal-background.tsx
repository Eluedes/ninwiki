'use client';

// Fundo ilustrado do site PUBLICO: um fundo padrao fora de epoca e um fundo para cada epoca festiva (Natal, Ano Novo, Valentine's Day, Pascoa, Halloween).
// Tudo e' desenho em SVG feito aqui (nenhuma imagem do jogo, nenhum arquivo para baixar): pesa poucos KB. O estilo (copas em blocos com luz e sombra, tronco
// grande, raios de luz, folhas na frente) e' so' inspirado no visual do menu do jogo. Cada epoca junta os fundos que o dono escolheu: Natal = JC + C1 + C2,
// Ano Novo = JN, Valentine = JV + V1, Pascoa = E2, Halloween = JH + H1 + H2, padrao = J1 (tema escuro) e J2 (tema claro).
// O fundo fica parado atras do conteudo (fixo, sem clique) e escurecido para o texto continuar legivel; quem pede menos movimento nao ve a nevoa se mexer.

import type { SeasonalTheme } from '@/lib/api-client';

// ---- pecas de desenho (coordenadas num quadro de 320 x 200; o SVG "corta" para preencher a tela) ----

/** Gerador pseudo-aleatorio deterministico (mesma semente = mesmo desenho, sem pular entre renders). */
const rnd = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
/** Repete um desenho n vezes com 4 numeros aleatorios por vez. */
const dots = (n: number, seed: number, fn: (a: number, b: number, c: number, d: number, i: number) => string) => {
  const r = rnd(seed); let o = '';
  for (let i = 0; i < n; i++) o += fn(r(), r(), r(), r(), i);
  return o;
};
const lg = (id: string, c1: string, c2: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
const rg = (id: string, c: string, o: number) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
const blur = (id: string, s: number) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${s}"/></filter>`;
const HEART = 'M0 6C-12 -4 -10 -14 -3 -13C0 -12 0 -9 0 -8C0 -9 0 -12 3 -13C10 -14 12 -4 0 6Z';
const BAT = 'M0 0C-4-4-10-4-14 0C-10-1-8 1-6 4C-4 2-2 2 0 4C2 2 4 2 6 4C8 1 10-1 14 0C10-4 4-4 0 0Z';

/** Copas de arvore em blocos: um circulo escuro com um circulo claro deslocado (luz vinda de cima/esquerda), como no menu do jogo. */
function canopy(seed: number, y0: number, n: number, r: number, dark: string, light: string) {
  const q = rnd(seed);
  let o = `<rect y="${y0 + 10}" width="320" height="${210 - y0}" fill="${dark}"/>`;
  for (let i = 0; i < n; i++) {
    const x = -10 + (i + q() * 0.7) * (340 / n), y = y0 + q() * 16, rr = r * (0.75 + q() * 0.6);
    o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="${dark}"/><circle cx="${(x - rr * 0.2).toFixed(1)}" cy="${(y - rr * 0.25).toFixed(1)}" r="${(rr * 0.6).toFixed(1)}" fill="${light}" opacity=".5"/>`;
  }
  return o;
}
/** Tronco grande a esquerda, com faixa de luz e um galho. */
const trunk = (col: string, hi: string) => `<path d="M-4 0H44C36 50 50 110 38 150C34 175 40 190 36 202H-4Z" fill="${col}"/><path d="M14 0H22C16 60 28 120 20 200H12C18 120 8 60 14 0Z" fill="${hi}" opacity=".5"/><path d="M40 70C70 56 88 40 112 44" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
const leaf = (x: number, y: number, rot: number, s: number, col: string, hi: string) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C14 -22 42 -22 56 0C42 22 14 22 0 0Z" fill="${col}"/><path d="M4 0H50" stroke="${hi}" stroke-width="1.2" opacity=".5"/></g>`;
/** Folhas grandes nos cantos de baixo, na frente de tudo. */
const fgLeaves = (col: string, hi: string) => leaf(-6, 196, -30, 1.2, col, hi) + leaf(20, 205, -62, 1.3, col, hi) + leaf(8, 185, -10, 0.9, col, hi) + leaf(326, 198, 200, 1.3, col, hi) + leaf(300, 206, 232, 1.3, col, hi) + leaf(318, 182, 170, 0.9, col, hi);
/** Fogos de artificio: raios com uma bolinha na ponta. */
const burst = (x: number, y: number, c: string, r: number) => Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2, r2 = r + (i % 2) * 7;
  const x2 = (x + Math.cos(a) * r2).toFixed(1), y2 = (y + Math.sin(a) * r2).toFixed(1);
  return `<line x1="${(x + Math.cos(a) * 6).toFixed(1)}" y1="${(y + Math.sin(a) * 6).toFixed(1)}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><circle cx="${x2}" cy="${y2}" r="1.8" fill="${c}"/>`;
}).join('');

interface SceneOpts {
  seed: number;
  sky: [string, string];
  far: [string, string];
  mid: [string, string];
  near: [string, string];
  ray: string;
  /** Desenhado ENTRE o ceu e a floresta (lua, fogos...). */
  back?: string;
  /** Desenhado POR CIMA de tudo (neve, coracoes, flores, morcegos...). */
  front?: string;
  /** Definicoes extras (gradientes, filtros) que o back/front usam. */
  defs?: string;
}

/** Floresta em camadas: ceu, copas de longe (desfocadas), raios de luz, copas do meio, tronco, nevoa que se move devagar e folhas na frente. */
function forest(id: string, o: SceneOpts) {
  const defs = lg(`${id}g`, o.sky[0], o.sky[1])
    + `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.ray}" stop-opacity=".55"/><stop offset="1" stop-color="${o.ray}" stop-opacity="0"/></linearGradient>`
    + blur(`${id}b`, 1.4) + blur(`${id}s`, 3.2) + rg(`${id}p`, o.ray, 0.35) + (o.defs ?? '');
  const rays = `<g fill="url(#${id}r)" opacity=".8" filter="url(#${id}s)"><path d="M40 0H96L210 200H120Z"/><path d="M120 0H146L272 200H226Z"/><path d="M0 0H26L112 200H52Z"/><path d="M200 0H214L320 150V200H282Z" opacity=".6"/></g>`;
  const mist = `<g class="sb-mist"><ellipse cx="90" cy="150" rx="160" ry="9" fill="${o.ray}" opacity=".08"/><ellipse cx="250" cy="176" rx="170" ry="8" fill="${o.ray}" opacity=".07"/></g>`;
  const body = `<rect width="320" height="200" fill="url(#${id}g)"/>${o.back ?? ''}`
    + `<g filter="url(#${id}b)">${canopy(o.seed, 108, 15, 24, o.far[0], o.far[1])}</g>${rays}`
    + canopy(o.seed + 1, 136, 11, 32, o.mid[0], o.mid[1])
    + `<ellipse cx="170" cy="190" rx="70" ry="12" fill="url(#${id}p)"/>${mist}`
    + trunk(o.near[0], o.near[1]) + fgLeaves(o.near[0], o.near[1]) + (o.front ?? '');
  return { defs, body };
}

// ---- as cenas ----

/** Padrao, tema escuro (J1): floresta verde-agua. */
const J1 = () => forest('J1', { seed: 3, sky: ['#0a1219', '#1d3d46'], far: ['#17333b', '#3a6e74'], mid: ['#0e2229', '#2b5a60'], near: ['#060d11', '#1c3a3e'], ray: '#d6f0e6' });
/** Padrao, tema claro (J2): floresta azul-noite (aparece bem suave). */
const J2 = () => forest('J2', { seed: 5, sky: ['#0a0d1e', '#24305a'], far: ['#1a2348', '#4a5da0'], mid: ['#101734', '#34437c'], near: ['#060916', '#202c58'], ray: '#cfd9ff' });

/** Natal: floresta azul-gelo (JC) + flocos grandes desfocados e estrelas (C1) + pisca-pisca e luzes desfocadas no topo (C2). */
function christmas() {
  const lights = ['#e11d48', '#22c55e', '#f2b84b'];
  return forest('JC', {
    seed: 7, sky: ['#0a1330', '#27487c'], far: ['#1f3a6a', '#7fa6d6'], mid: ['#122a52', '#5b86bc'], near: ['#071226', '#2c4d80'], ray: '#e3efff',
    defs: blur('JCf', 2.2),
    front: dots(90, 5, (a, b, c, d) => `<circle cx="${(a * 320).toFixed(1)}" cy="${(b * 200).toFixed(1)}" r="${(c * 1.8 + 0.6).toFixed(2)}" fill="#fff" opacity="${(d * 0.5 + 0.4).toFixed(2)}"/>`)
      + dots(24, 9, (a, b, c, d, i) => `<circle cx="${(a * 320).toFixed(1)}" cy="${(b * 200).toFixed(1)}" r="${(c * 5 + 4).toFixed(1)}" fill="${['#e11d48', '#22c55e', '#f2b84b', '#3b82f6'][i % 4]}" opacity="${(d * 0.16 + 0.1).toFixed(2)}" filter="url(#JCf)"/>`)
      + '<path d="M-10 14C60 44 120 -4 200 26S300 8 340 22" stroke="#21432e" stroke-width="2.4" fill="none"/>'
      + [20, 62, 104, 146, 188, 230, 272, 312].map((x, i) => `<circle class="sb-twinkle" style="animation-delay:${i * 0.4}s" cx="${x}" cy="${(25 + 13 * Math.sin(i * 1.4)).toFixed(1)}" r="3.2" fill="${lights[i % 3]}"/>`).join(''),
  });
}

/** Ano Novo (JN): floresta roxa com tres fogos dourado, rosa e azul e brilhos. */
const newYear = () => forest('JN', {
  seed: 9, sky: ['#070a1c', '#232a60'], far: ['#1a1e4a', '#5a52a0'], mid: ['#101338', '#443c86'], near: ['#06071a', '#262a58'], ray: '#ffd9a0',
  back: burst(80, 50, '#f2b84b', 26) + burst(236, 38, '#f472b6', 24) + burst(160, 80, '#67e8f9', 18)
    + dots(40, 4, (a, b, c) => `<circle class="sb-twinkle" style="animation-delay:${(c * 3).toFixed(1)}s" cx="${(a * 320).toFixed(1)}" cy="${(b * 110).toFixed(1)}" r="1" fill="#fff" opacity=".8"/>`),
});

/** Valentine's Day: floresta rosa e vinho (JV) + coracoes desfocados grandes (V1) + coracoes nitidos pequenos. */
const valentine = () => forest('JV', {
  seed: 11, sky: ['#220a18', '#5a1c38'], far: ['#4a1830', '#c0587f'], mid: ['#341024', '#92406a'], near: ['#14050f', '#5a2040'], ray: '#ffc2da',
  defs: blur('JVb', 1.8),
  front: dots(14, 7, (a, b, c, d) => `<path transform="translate(${(a * 310 + 5).toFixed(1)} ${(b * 170 + 5).toFixed(1)}) scale(${(c * 1.6 + 0.9).toFixed(2)})" d="${HEART}" fill="#ff6b9d" opacity="${(d * 0.25 + 0.2).toFixed(2)}" filter="url(#JVb)"/>`)
    + dots(14, 17, (a, b, c, d) => `<path transform="translate(${(a * 310 + 5).toFixed(1)} ${(b * 150 + 5).toFixed(1)}) scale(${(c * 1 + 0.5).toFixed(2)})" d="${HEART}" fill="#ff6b9d" opacity="${(d * 0.3 + 0.3).toFixed(2)}"/>`),
});

/** Pascoa (E2): ceu roxo-noite com ovos coloridos levemente girados e um brilho suave. */
function easter() {
  const cols = ['#f9a8d4', '#fde68a', '#a7f3d0', '#c4b5fd', '#93c5fd'];
  const defs = lg('E2g', '#16112a', '#2a2050') + rg('E2p', '#fde68a', 0.25);
  const eggs = dots(26, 33, (a, b, c, d, i) => `<g transform="translate(${(a * 300 + 10).toFixed(1)} ${(b * 170 + 14).toFixed(1)}) rotate(${(c * 50 - 25).toFixed(0)}) scale(${(d * 0.8 + 0.8).toFixed(2)})" opacity=".6"><ellipse rx="9" ry="12" fill="${cols[i % 5]}"/><path d="M-8 -2Q0 3 8 -2M-7 4Q0 9 7 4" stroke="#fff" stroke-width="1.6" fill="none" opacity=".7"/></g>`);
  const body = `<rect width="320" height="200" fill="url(#E2g)"/><circle cx="260" cy="40" r="90" fill="url(#E2p)"/><circle cx="40" cy="170" r="80" fill="url(#E2p)" opacity=".6"/>${eggs}`
    + '<path fill="#0f0b20" d="M0 200V184Q60 168 120 182T240 178T320 184V200Z"/>';
  return { defs, body };
}

/** Halloween: floresta de outono roxa e laranja (JH) + lua e morcegos (H1) + arvore seca a direita (H1) + teia no canto e abobora no chao (H2). */
function halloween() {
  const pumpkin = (x: number, s: number) => `<circle cx="${x}" cy="176" r="40" fill="url(#JHc)"/><g transform="translate(${x} 186) scale(${s})"><ellipse rx="16" ry="13" fill="#e8760f"/><path d="M-8 -3L-3 -3L-5 2Z M3 -3L8 -3L5 2Z M-6 5Q0 9 6 5" fill="#2a0f02"/><rect x="-1.5" y="-17" width="3" height="5" fill="#2f7d32"/></g>`;
  const web = [30, 55, 80, 105].map((r) => `<path d="M${320 - r} 0Q${320 - r * 0.55} ${r * 0.55} 320 ${r}" stroke="#fff" stroke-width="1" fill="none" opacity=".28"/>`).join('')
    + '<path d="M320 0L206 0M320 0L226 52M320 0L262 96M320 0L320 112M320 0L240 24M320 0L292 100" stroke="#fff" stroke-width="1" opacity=".28" fill="none"/>';
  return forest('JH', {
    seed: 15, sky: ['#190b2a', '#5a2a14'], far: ['#3a1b4e', '#b8602c'], mid: ['#26103a', '#8a3d3a'], near: ['#0a0410', '#3a1830'], ray: '#ffb060',
    defs: rg('JHc', '#ff8a1f', 0.35),
    back: '<circle cx="256" cy="50" r="50" fill="#ff9a30" opacity=".22"/><circle cx="256" cy="50" r="28" fill="#f6b756"/><circle cx="248" cy="44" r="4.5" fill="#d99a3a" opacity=".6"/><circle cx="264" cy="58" r="3.2" fill="#d99a3a" opacity=".6"/>',
    front: '<g stroke="#07040c" stroke-width="4" stroke-linecap="round" fill="none"><path d="M300 200V138M300 160L316 146M300 150L286 136M300 142L308 128"/></g>'
      + web + pumpkin(120, 0.9) + pumpkin(215, 1.1)
      + [[60, 36, 1], [190, 66, 0.8], [150, 26, 0.7]].map(([x, y, s]) => `<path transform="translate(${x} ${y}) scale(${s})" d="${BAT}" fill="#050308"/>`).join(''),
  });
}

/** Desenho (definicoes + corpo) de cada tema. */
function sceneFor(season: SeasonalTheme, light: boolean) {
  switch (season) {
    case 'christmas': return christmas();
    case 'newyear': return newYear();
    case 'valentine': return valentine();
    case 'easter': return easter();
    case 'halloween': return halloween();
    default: return light ? J2() : J1();
  }
}

/** Fundo fixo atras do site. `season` 'none' = fundo padrao. Mostra duas versoes (escuro/claro) que o CSS alterna pelo tema do visitante. */
export function SeasonalBackground({ season }: { season: SeasonalTheme }) {
  const svg = (s: { defs: string; body: string }) => `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs>${s.defs}</defs>${s.body}</svg>`;
  // Os SVGs saem so' de constantes deste arquivo (nada vem do usuario), por isso o HTML e' seguro.
  // Epoca festiva: um desenho so' (tema escuro forte, claro bem suave). Padrao: J1 no escuro e J2 no claro (ids diferentes, entao nao se misturam).
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {season === 'none' ? (
        <>
          <div className="absolute inset-0 hidden opacity-60 dark:block" dangerouslySetInnerHTML={{ __html: svg(sceneFor(season, false)) }} />
          <div className="absolute inset-0 opacity-[0.16] dark:hidden" dangerouslySetInnerHTML={{ __html: svg(sceneFor(season, true)) }} />
        </>
      ) : (
        <div className="absolute inset-0 opacity-[0.16] dark:opacity-60" dangerouslySetInnerHTML={{ __html: svg(sceneFor(season, false)) }} />
      )}
      {/* veu: escurece o fundo para o texto e os cartoes continuarem legiveis */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/25 to-background/60" />
    </div>
  );
}
