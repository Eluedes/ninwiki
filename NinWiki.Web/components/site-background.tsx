// Fundo do site (todas as paginas, inclusive o painel): um CEU com nuvens que passam devagar em 4 camadas (as de tras mais lentas).
// O tema claro/escuro do visitante vira DIA e NOITE: de dia ceu azul com sol; de noite ceu escuro com estrelas que brilham e lua.
// Tudo e' SVG/CSS feito aqui (nenhuma imagem baixada). As duas versoes ficam no HTML e o CSS `dark:` mostra a certa, sem JavaScript de estado:
// assim nao pisca no carregamento e funciona na renderizacao do servidor. Animacoes em app/globals.css (classes sb-*); quem pede menos movimento ve tudo parado.

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

/** Uma versao do ceu (dia ou noite) com as nuvens; `show` = classes que mostram so' no tema certo. */
function Sky({ c, night, show }: { c: typeof COLORS.day | typeof COLORS.night; night: boolean; show: string }) {
  return (
    <div className={`absolute inset-0 ${show}`} style={{ background: `linear-gradient(${c.sky[0]}, ${c.sky[1]})` }}>
      {night
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
    </div>
  );
}

/** Fundo fixo atras de todo o site (nao pega clique). */
export function SiteBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Sky c={COLORS.day} night={false} show="dark:hidden" />
      <Sky c={COLORS.night} night show="hidden dark:block" />
    </div>
  );
}
