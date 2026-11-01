'use client';

// Fundo do site PUBLICO: um CEU com nuvens que passam devagar em varias camadas. O tema claro/escuro do visitante vira DIA e NOITE: de dia ceu azul com sol,
// de noite ceu escuro com estrelas que brilham e lua. As nuvens e o ceu sao SVG/CSS feitos aqui (nenhuma imagem baixada para eles).
// Cada epoca festiva acrescenta o seu efeito:
//   Natal = neve (canvas) + sprites do jogo (arvores nevadas, arvore de Natal, boneco de neve, presentes, bengalas) + o NPC de Natal do jogo andando;
//   Ano Novo = fogos (canvas);  Valentine's Day = baloes de coracao + fogos em formato de coracao (canvas) + cerejeiras rosa do jogo;
//   Halloween = arvores de outono, arvore assombrada, abobora e teia do jogo, com brilho que oscila forte e fraco;  Pascoa = arvores verdes do jogo + ovos.
// Os sprites (pixel art) vem do cliente do jogo e ficam em public/images/seasonal. Canvas em components/season-canvas.tsx; animacoes em app/globals.css (sb-*).
// Quem pede menos movimento ao aparelho ve tudo parado (sem canvas, sem NPC andando).

import { useEffect, useState } from 'react';
import type { SeasonalTheme } from '@/lib/api-client';
import { SeasonCanvas } from '@/components/season-canvas';

/** Cores do ceu: dia (tema claro) e noite (tema escuro). `op` = opacidade das 4 camadas de nuvens (de longe para perto). */
const COLORS = {
  day: { sky: ['#6db3ea', '#d6ecfa'], cloud: '#ffffff', op: [0.55, 0.7, 0.85, 0.7] },
  night: { sky: ['#0a1626', '#172e48'], cloud: '#a9c3dc', op: [0.08, 0.11, 0.15, 0.11] },
} as const;

/** Gerador pseudo-aleatorio deterministico (mesmo desenho a cada vez). */
const rnd = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

/** Uma nuvem de contorno suave: circulos sobrepostos + base achatada + dois tracos por dentro (estilo das nuvens orientais). */
function cloud(x: number, y: number, s: number, fill: string, cut: string, op: number) {
  const c = (cx: number, cy: number, r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><g fill="${fill}" opacity="${op}">${c(0, 0, 22)}${c(-26, 6, 16)}${c(28, 7, 18)}${c(-10, -14, 18)}${c(12, -12, 15)}<ellipse cx="0" cy="14" rx="48" ry="10"/></g>`
    + `<path d="M-30 8Q-12 -8 8 4M8 -16Q22 -24 36 -10" fill="none" stroke="${cut}" stroke-width="2" stroke-linecap="round" opacity="${(op * 0.9).toFixed(2)}"/></g>`;
}
/** Faixa de nuvens que se repete na horizontal (cada nuvem e' desenhada tambem uma largura antes e depois, para a emenda sumir). */
function cloudTile(w: number, h: number, seed: number, count: number, scale: number, fill: string, cut: string, op: number) {
  const q = rnd(seed);
  let body = '';
  for (let i = 0; i < count; i++) {
    const cx = q() * w, cy = h * (0.15 + q() * 0.6), s = scale * (0.8 + q() * 0.5);
    for (const dx of [-w, 0, w]) body += cloud(cx + dx, cy, s, fill, cut, op);
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}")`;
}

/** As 4 camadas de nuvens: [semente, quantidade, escala da nuvem, topo (%), altura da faixa (px), segundos por volta]. Quanto mais perto, maior e mais rapida. */
const LAYERS: [number, number, number, number, number, number][] = [
  [11, 7, 0.55, 2, 300, 260],
  [23, 5, 0.9, 24, 375, 170],
  [37, 3, 1.5, 46, 480, 110],
  [51, 5, 0.9, 70, 375, 190],
];

/** Estrelas da noite: posicao (%), tamanho (px) e atraso do brilho. */
const STARS = (() => { const q = rnd(7); return Array.from({ length: 70 }, () => ({ left: q() * 100, top: q() * 62, size: 1 + Math.floor(q() * 3), delay: q() * 6 })); })();

/** Tamanho original (px) de cada sprite do jogo em public/images/seasonal: [largura, altura]. */
const SPRITE_SIZE: Record<string, [number, number]> = {
  'tree-spring': [157, 180], 'tree-winter': [157, 180], 'tree-autumn': [157, 180], 'tree-green': [157, 180],
  'pumpkin-pole': [35, 54], 'pumpkin-desk': [32, 36], 'haunted-tree': [85, 87], 'cobweb': [28, 40],
  'xmas-tree': [47, 61], 'candy-canes': [39, 54], 'gifts-a': [24, 30], 'gifts-b': [30, 25], 'snowman': [25, 47],
};
/** [sprite, esquerda (%), base (%), ampliacao (x), brilha?]. Pixel art: ampliacao inteira/grande, sem suavizar. */
type Sprite = [keyof typeof SPRITE_SIZE, number, number, number, boolean?];
const SCENES: Partial<Record<SeasonalTheme, Sprite[]>> = {
  christmas: [['tree-winter', -2, 0, 1.5], ['tree-winter', 88, 0, 1.3], ['tree-winter', 17, -1, 0.9], ['xmas-tree', 27, 1, 4.2], ['gifts-a', 37, 1, 3.4], ['candy-canes', 46, 1, 2.6], ['gifts-b', 58, 1, 3.4], ['snowman', 68, 1, 4]],
  halloween: [['tree-autumn', -2, 0, 1.5], ['tree-autumn', 88, 0, 1.3], ['haunted-tree', 14, 1, 4, true], ['pumpkin-desk', 33, 1, 4, true], ['pumpkin-pole', 46, 1, 3, true], ['pumpkin-desk', 60, 1, 3.2, true], ['cobweb', 70, 1, 3.5], ['pumpkin-pole', 79, 1, 3.4, true]],
  valentine: [['tree-spring', -2, 0, 1.5], ['tree-spring', 88, 0, 1.3], ['tree-spring', 18, -1, 0.9], ['tree-spring', 76, -1, 0.9]],
  easter: [['tree-green', -2, 0, 1.5], ['tree-green', 88, 0, 1.3]],
};

/** Um sprite do jogo no chao da tela. O tamanho segue --sb-k (menor no celular). `glow` = halo laranja + brilho que oscila forte e fraco (Halloween). */
function SpriteImg({ s, i }: { s: Sprite; i: number }) {
  const [name, left, bottom, scale, glow] = s;
  const [w, h] = SPRITE_SIZE[name];
  const px = (n: number) => `calc(${n * scale}px * var(--sb-k, 1))`;
  return (
    <div className="absolute" style={{ left: `${left}%`, bottom: `${bottom}%`, width: px(w), height: px(h) }}>
      {glow && <div className="sb-halo absolute" style={{ inset: '-45%', background: 'radial-gradient(circle, rgba(255,150,30,0.55), transparent 65%)', animationDelay: `${-i * 1.7}s` }} />}
      <div className={`absolute inset-0 ${glow ? 'sb-pump' : ''}`} style={{ backgroundImage: `url(/images/seasonal/${name}.png)`, backgroundSize: '100% 100%', imageRendering: 'pixelated', animationDelay: `${-i * 1.7}s` }} />
    </div>
  );
}

/** O NPC de Natal do jogo andando pela parte de baixo da tela (um indo para a direita e outro para a esquerda, em tempos diferentes). */
function Npc({ dir, delay }: { dir: 'right' | 'left'; delay: number }) {
  const h = dir === 'right' ? 91 : 93, scale = 3;
  return (
    <div className={`sb-npc-walk-${dir} absolute`} style={{ left: 0, bottom: '1%', animationDelay: `${-delay}s` }}>
      <div className="sb-npc" style={{ width: `calc(${54 * scale}px * var(--sb-k, 1))`, height: `calc(${h * scale}px * var(--sb-k, 1))`, backgroundImage: `url(/images/seasonal/npc-walk-${dir}.png)`, backgroundSize: '800% 100%', imageRendering: 'pixelated' }} />
    </div>
  );
}

/** Ovo de Pascoa de enfeite no chao, com uma faixa em ziguezague. */
function Egg({ left, size, color, delay }: { left: string; size: number; color: string; delay: number }) {
  return (
    <svg viewBox="0 0 30 38" width={size} height={size * 1.27} className="sb-float absolute" style={{ left, bottom: '1%', animationDelay: `${-delay}s` }}>
      <ellipse cx="15" cy="20" rx="12" ry="16" fill={color} opacity="0.85" />
      <path d="M4 20L9 15L15 20L21 15L26 20" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.7" /><path d="M4.5 27Q15 32 25.5 27" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity="0.6" />
    </svg>
  );
}
const EGGS = [
  { left: '8%', size: 44, color: '#f9a8d4' }, { left: '21%', size: 56, color: '#a7f3d0' }, { left: '36%', size: 40, color: '#fde68a' }, { left: '63%', size: 48, color: '#c4b5fd' },
  { left: '77%', size: 60, color: '#93c5fd' }, { left: '86%', size: 42, color: '#fdba74' },
];

/** Fundo fixo atras do site; `season` 'none' = so' o ceu com as nuvens. */
export function SeasonalBackground({ season }: { season: SeasonalTheme }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));   // so' monta no navegador (SeasonalDecor espera a API)
  useEffect(() => {   // acompanha o botao claro/escuro (o <html> muda de classe)
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains('dark'));
    update();
    const mo = new MutationObserver(update);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  const c = dark ? COLORS.night : COLORS.day;
  const sprites = SCENES[season];
  return (
    <div aria-hidden data-sb={season} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: `linear-gradient(${c.sky[0]}, ${c.sky[1]})` }}>
      {dark
        ? <>
            {STARS.map((s, i) => <span key={i} className="sb-star absolute rounded-full bg-white" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${-s.delay}s` }} />)}
            <div className="absolute rounded-full" style={{ right: '12%', top: '8%', width: 70, height: 70, background: 'radial-gradient(circle at 35% 35%, #ffffff, #dbe5f5 60%, #b9c8e0)', boxShadow: '0 0 70px 18px rgba(190,210,255,0.28)' }} />
          </>
        : <div className="sb-sun absolute rounded-full" style={{ right: '12%', top: '8%', width: 80, height: 80, background: 'radial-gradient(circle, #fff6c2, #ffd54a 65%)', boxShadow: '0 0 90px 36px rgba(255,225,110,0.5)' }} />}
      {LAYERS.map(([seed, count, scale, top, h, secs], i) => (
        <div key={i} className="sb-cloud absolute left-0 right-0" style={{
          top: `${top}%`, height: h, backgroundRepeat: 'repeat-x', animationDuration: `${secs}s`,
          backgroundImage: cloudTile(1000, 300, seed, count, scale, c.cloud, c.sky[0], c.op[i]), backgroundSize: `${(h / 300) * 1000}px ${h}px`, ['--sb-tile' as string]: `${(h / 300) * 1000}px`,
        }} />
      ))}
      {sprites && <div className="absolute inset-0" style={{ filter: dark ? 'brightness(0.78)' : undefined }}>{sprites.map((s, i) => <SpriteImg key={i} s={s} i={i} />)}</div>}
      {season === 'christmas' && <><Npc dir="right" delay={0} /><Npc dir="left" delay={50} /></>}
      {season === 'easter' && EGGS.map((e, i) => <Egg key={i} {...e} delay={i * 1.3} />)}
      {season === 'newyear' && <SeasonCanvas kind="fireworks" dark={dark} />}
      {season === 'christmas' && <SeasonCanvas kind="christmas" dark={dark} />}
      {season === 'valentine' && <><SeasonCanvas kind="balloons" dark={dark} /><SeasonCanvas kind="heartworks" dark={dark} /></>}
    </div>
  );
}
