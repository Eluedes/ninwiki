'use client';

// Fundo do site PUBLICO: NUVENS que passam devagar, em varias camadas (as de tras mais lentas), numa cor unica (nao muda com o tema de cores; so' tem
// uma versao clara e uma escura, conforme o tema claro/escuro do visitante). Desenhadas aqui em SVG (nenhuma imagem baixada).
// Todas as epocas usam essas nuvens de base e acrescentam o seu efeito:
//   Ano Novo = fogos (canvas);  Natal = neve caindo + Papai Noel voando com as renas (canvas);
//   Valentine's Day = baloes de coracao + fogos em formato de coracao (canvas);  Halloween = abobora com olhos que brilham forte e fraco;  Pascoa = ovos.
// Canvas em components/season-canvas.tsx; animacoes CSS em app/globals.css (classes sb-*). Quem pede menos movimento ao aparelho ve tudo parado.

import { useEffect, useState } from 'react';
import type { SeasonalTheme } from '@/lib/api-client';
import { SeasonCanvas } from '@/components/season-canvas';

/** Cores unicas do fundo: [claro, escuro]. `sky` = ceu (degrade de cima para baixo), `cloud` = nuvem, `op` = opacidade das 4 camadas (de longe para perto). */
const COLORS = {
  light: { sky: ['#cfe1f1', '#eef5fb'], cloud: '#ffffff', op: [0.5, 0.6, 0.72, 0.6] },
  dark: { sky: ['#0a1626', '#172e48'], cloud: '#a9c3dc', op: [0.08, 0.11, 0.15, 0.11] },
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

/** Abobora de Halloween com olhos, nariz e boca que brilham (forte e fraco). `delay` desencontra o brilho de uma para outra. */
function Pumpkin({ left, bottom, top, size, delay, float }: { left?: string; bottom?: string; top?: string; size: number; delay: number; float?: boolean }) {
  const face = 'M27 48L41 48L34 34Z M59 48L73 48L66 34Z M50 56L45 64L55 64Z M27 68L36 76L43 70L50 78L57 70L64 76L73 68Q50 90 27 68Z';
  return (
    <svg viewBox="0 0 100 90" width={size} height={size * 0.9} className={`absolute ${float ? 'sb-float' : ''}`} style={{ left, bottom, top, animationDelay: `${-delay}s` }}>
      <ellipse cx="30" cy="52" rx="26" ry="34" fill="#d85f0c" /><ellipse cx="70" cy="52" rx="26" ry="34" fill="#d85f0c" /><ellipse cx="50" cy="52" rx="28" ry="36" fill="#f97316" />
      <path d="M50 17Q40 52 50 88M34 22Q16 52 34 86M66 22Q84 52 66 86" fill="none" stroke="#b9470a" strokeWidth="1.6" opacity="0.7" />
      <path d="M46 16Q48 4 57 6L54 17Z" fill="#3f7d2a" />
      <path d={face} fill="#2a0f02" />
      <g className="sb-eye" style={{ animationDelay: `${-delay}s` }}>
        <path d={face} fill="#f59e0b" filter="url(#sbGlow)" />
        <path d={face} fill="#fde047" />
      </g>
    </svg>
  );
}
/** Posicoes das abobora: algumas no chao e algumas flutuando nas laterais. */
const PUMPKINS = [
  { left: '3%', bottom: '2%', size: 96, delay: 0 }, { left: '15%', bottom: '-1%', size: 62, delay: 2.1 }, { left: '30%', bottom: '1%', size: 52, delay: 4.3 },
  { left: '70%', bottom: '0%', size: 58, delay: 1.2 }, { left: '82%', bottom: '3%', size: 104, delay: 3.2 }, { left: '93%', bottom: '-1%', size: 60, delay: 5.1 },
  { left: '2%', top: '30%', size: 56, delay: 2.7, float: true }, { left: '94%', top: '22%', size: 64, delay: 4.8, float: true },
];

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
  { left: '6%', size: 44, color: '#f9a8d4' }, { left: '19%', size: 56, color: '#a7f3d0' }, { left: '34%', size: 40, color: '#fde68a' }, { left: '63%', size: 48, color: '#c4b5fd' },
  { left: '77%', size: 60, color: '#93c5fd' }, { left: '90%', size: 42, color: '#fdba74' },
];

/** Fundo fixo atras do site; `season` 'none' = so' as nuvens. */
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

  const c = dark ? COLORS.dark : COLORS.light;
  return (
    <div aria-hidden data-sb={season} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: `linear-gradient(${c.sky[0]}, ${c.sky[1]})` }}>
      {LAYERS.map(([seed, count, scale, top, h, secs], i) => (
        <div key={i} className="sb-cloud absolute left-0 right-0" style={{
          top: `${top}%`, height: h, backgroundRepeat: 'repeat-x', animationDuration: `${secs}s`,
          backgroundImage: cloudTile(1000, 300, seed, count, scale, c.cloud, c.sky[0], c.op[i]), backgroundSize: `${(h / 300) * 1000}px ${h}px`, ['--sb-tile' as string]: `${(h / 300) * 1000}px`,
        }} />
      ))}
      {season === 'newyear' && <SeasonCanvas kind="fireworks" dark={dark} />}
      {season === 'christmas' && <SeasonCanvas kind="christmas" dark={dark} />}
      {season === 'valentine' && <><SeasonCanvas kind="balloons" dark={dark} /><SeasonCanvas kind="heartworks" dark={dark} /></>}
      {season === 'halloween' && (
        <>
          <svg width="0" height="0" className="absolute"><defs><filter id="sbGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter></defs></svg>
          {PUMPKINS.map((p, i) => <Pumpkin key={i} {...p} />)}
        </>
      )}
      {season === 'easter' && EGGS.map((e, i) => <Egg key={i} {...e} delay={i * 1.3} />)}
    </div>
  );
}
