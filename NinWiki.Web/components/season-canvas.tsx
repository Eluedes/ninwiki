'use client';

// Animacoes em canvas dos fundos de epoca (as nuvens de base ficam em seasonal-background.tsx):
//   fireworks  = Ano Novo: foguetes que sobem e estouram em varias cores;
//   heartworks = Valentine's Day: foguetes que estouram em FORMATO DE CORACAO;
//   balloons   = Valentine's Day: baloes em formato de coracao que enchem e estouram;
//   christmas  = Natal: neve caindo e o Papai Noel voando com as renas de tempos em tempos.
// O canvas e' transparente, fica atras do conteudo e nao pega clique. Quem pede menos movimento ao aparelho nao ve nada (as nuvens ficam paradas).
// O laco para sozinho quando a aba esta escondida (requestAnimationFrame) e e' cancelado ao desmontar.

import { useEffect, useRef } from 'react';

export type CanvasKind = 'fireworks' | 'heartworks' | 'balloons' | 'christmas';
type Size = () => { W: number; H: number };
type Step = (dt: number) => void;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------- fogos: foguetes sobem e estouram (redondos ou em coracao)
const FIRE_HUES = [45, 330, 190, 130, 20, 270, 0];   // dourado, rosa, ciano, verde, laranja, violeta, vermelho
const HEART_HUES = [340, 350, 0, 320, 330];            // rosas e vermelhos

function makeFireworks(ctx: CanvasRenderingContext2D, size: Size, dark: boolean, heart: boolean): Step {
  interface Rocket { x: number; y: number; vy: number; targetY: number }
  interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; r: number }
  const rockets: Rocket[] = [], sparks: Spark[] = [];
  let timer = 0.5;
  const light = dark ? 64 : 46;   // no fundo claro as cores precisam ser mais escuras para aparecer

  function explode(x: number, y: number, s: number) {
    if (heart) {
      // Pontos sobre a curva do coracao; a velocidade de cada ponto aponta para fora do centro, entao o formato "abre" mantendo a forma.
      const hues = [pick(HEART_HUES), pick(HEART_HUES)];
      for (const ring of [1, 0.55]) {   // dois coracoes, um dentro do outro, para parecer cheio
        const n = Math.round(46 * ring);
        for (let i = 0; i < n; i++) {
          const t = (i / n) * Math.PI * 2;
          const hx = 16 * Math.pow(Math.sin(t), 3), hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          const k = 3.6 * s * ring;
          sparks.push({ x, y, vx: hx * k, vy: hy * k, life: 0, max: rand(1.6, 2.1), hue: pick(hues), r: rand(1.4, 2.3) });
        }
      }
      return;
    }
    const hues = [pick(FIRE_HUES), pick(FIRE_HUES), pick(FIRE_HUES)];   // cada estouro mistura ate 3 cores
    const n = Math.round(rand(44, 68));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(30, 150) * s;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(1.3, 2.0), hue: pick(hues), r: rand(1.2, 2.4) });
    }
  }

  return (dt) => {
    const { W, H } = size(), s = Math.max(0.6, H / 900);
    ctx.globalCompositeOperation = 'destination-out';   // apaga um pouco a cada quadro: deixa o rastro sumir devagar
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 6)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

    timer -= dt;
    if (timer <= 0 && rockets.length < 2) {
      rockets.push({ x: rand(0.1, 0.9) * W, y: H + 10, vy: -rand(380, 520) * s, targetY: H * rand(0.18, 0.5) });
      timer = heart ? rand(2.2, 3.6) : rand(1.2, 2.4);
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y += r.vy * dt;
      if (r.y <= r.targetY) { explode(r.x, r.y, s); rockets.splice(i, 1); continue; }
      ctx.fillStyle = `hsl(${heart ? 340 : 45} 100% ${light + 10}% / 0.95)`;
      ctx.beginPath(); ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2); ctx.fill();
      if (Math.random() < 0.7) sparks.push({ x: r.x, y: r.y + 4, vx: rand(-12, 12), vy: rand(10, 40), life: 0, max: 0.45, hue: heart ? 340 : 40, r: 1.1 });   // fagulhas do rastro
    }
    const drag = heart ? 1.1 : 0.9, gravity = heart ? 22 : 55;   // coracao cai menos, para a forma durar
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt;
      if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      p.vx *= 1 - drag * dt; p.vy = p.vy * (1 - drag * dt) + gravity * s * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.fillStyle = `hsl(${p.hue} 100% ${light}% / ${(1 - p.life / p.max).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  };
}

// ---------------------------------------------------------------- baloes de coracao: enchem e estouram
/** Caminho de um coracao com a ponta para baixo; `s` = meia largura aproximada. */
function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0.9 * s);
  ctx.bezierCurveTo(-1.1 * s, 0.1 * s, -0.8 * s, -0.9 * s, 0, -0.4 * s);
  ctx.bezierCurveTo(0.8 * s, -0.9 * s, 1.1 * s, 0.1 * s, 0, 0.9 * s);
  ctx.closePath();
}

function makeBalloons(ctx: CanvasRenderingContext2D, size: Size): Step {
  interface Balloon { x: number; y: number; size: number; t: number; hue: number; wob: number }
  interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; s: number; rot: number }
  interface Ring { x: number; y: number; r: number; t: number; hue: number }
  const balloons: Balloon[] = [], bits: Bit[] = [], rings: Ring[] = [];
  let timer = 0.3;
  const INFLATE = 3.2, HOLD = 0.7;   // segundos enchendo e segurando antes de estourar
  const HUES = [340, 350, 320, 5, 330];

  function burst(b: Balloon, scale: number) {
    rings.push({ x: b.x, y: b.y, r: b.size * scale * 0.8, t: 0, hue: b.hue });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.2, 0.2), sp = rand(70, 170);
      bits.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(0.9, 1.3), hue: b.hue + rand(-12, 12), s: rand(5, 10), rot: rand(0, 6) });
    }
  }

  return (dt) => {
    const { W, H } = size();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    timer -= dt;
    if (timer <= 0 && balloons.length < 3) {
      balloons.push({ x: rand(0.08, 0.92) * W, y: rand(0.2, 0.8) * H, size: rand(34, 62) * clamp(W / 1200 + 0.5, 0.8, 1.3), t: 0, hue: pick(HUES), wob: rand(0, 6.28) });
      timer = rand(1.6, 2.8);
    }

    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      b.t += dt;
      const k = Math.min(b.t / INFLATE, 1), grow = 1 - Math.pow(1 - k, 3);   // enche rapido no comeco e devagar no fim
      const swell = b.t > INFLATE ? 1 + 0.1 * Math.pow((b.t - INFLATE) / HOLD, 2) : 1;   // incha mais um pouco antes de estourar
      const scale = grow * swell * (1 + 0.015 * Math.sin(b.t * 4));
      if (b.t >= INFLATE + HOLD) { burst(b, scale); balloons.splice(i, 1); continue; }
      const s = b.size * scale;
      ctx.save();
      ctx.globalAlpha = 0.85 * Math.min(1, b.t / 0.4);
      ctx.translate(b.x, b.y + Math.sin(b.t * 1.2 + b.wob) * 3);
      ctx.rotate(Math.sin(b.t * 1.1 + b.wob) * 0.07);
      ctx.strokeStyle = `hsl(${b.hue} 40% 55% / 0.5)`; ctx.lineWidth = 1.2;   // fio
      ctx.beginPath(); ctx.moveTo(0, 0.95 * s); ctx.quadraticCurveTo(Math.sin(b.t * 1.5) * 0.4 * s, 1.5 * s, 0, 2.1 * s); ctx.stroke();
      const g = ctx.createRadialGradient(-0.3 * s, -0.3 * s, 0.1 * s, 0, 0, 1.3 * s);
      g.addColorStop(0, `hsl(${b.hue} 90% 80% / 0.95)`); g.addColorStop(0.6, `hsl(${b.hue} 85% 62% / 0.92)`); g.addColorStop(1, `hsl(${b.hue} 80% 46% / 0.92)`);
      ctx.fillStyle = g; heartPath(ctx, s); ctx.fill();
      ctx.fillStyle = `hsl(${b.hue} 85% 55%)`;   // nozinho
      ctx.beginPath(); ctx.moveTo(0, 0.88 * s); ctx.lineTo(-0.1 * s, 1.04 * s); ctx.lineTo(0.1 * s, 1.04 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';   // brilho
      ctx.beginPath(); ctx.ellipse(-0.42 * s, -0.38 * s, 0.16 * s, 0.1 * s, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    for (let i = rings.length - 1; i >= 0; i--) {   // onda do estouro
      const r = rings[i];
      r.t += dt; r.r += 200 * dt;
      if (r.t > 0.5) { rings.splice(i, 1); continue; }
      ctx.strokeStyle = `hsl(${r.hue} 90% 70% / ${(0.6 * (1 - r.t / 0.5)).toFixed(2)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = bits.length - 1; i >= 0; i--) {   // coracoezinhos que saem do estouro
      const p = bits[i];
      p.life += dt;
      if (p.life >= p.max) { bits.splice(i, 1); continue; }
      p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 40 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 2;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.rot) * 0.5);
      ctx.fillStyle = `hsl(${p.hue} 90% 66% / ${(0.9 * (1 - p.life / p.max)).toFixed(2)})`;
      heartPath(ctx, p.s * 0.5); ctx.fill();
      ctx.restore();
    }
  };
}

// ---------------------------------------------------------------- Natal: neve caindo + Papai Noel voando com as renas
/** Uma rena de lado (virada para a direita). `u` = unidade de tamanho; `ph` = fase do galope; `nose` = nariz vermelho brilhante. */
function drawReindeer(ctx: CanvasRenderingContext2D, u: number, ph: number, nose: boolean, t: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b3a24'; ctx.lineWidth = 0.12 * u;
  for (const k of [-0.55, -0.3, 0.35, 0.6]) {   // pernas em galope
    const sw = Math.sin(ph + (k > 0 ? Math.PI : 0) + k * 3) * 0.6;
    ctx.beginPath(); ctx.moveTo(k * u, 0.3 * u); ctx.lineTo(k * u + Math.sin(sw) * 0.55 * u, 0.3 * u + Math.cos(sw) * 0.55 * u); ctx.stroke();
  }
  ctx.fillStyle = '#8a5a3a';
  ctx.beginPath(); ctx.ellipse(0, 0, 0.85 * u, 0.42 * u, 0, 0, Math.PI * 2); ctx.fill();   // corpo
  ctx.fillStyle = '#f3e9dc';
  ctx.beginPath(); ctx.ellipse(-0.85 * u, -0.12 * u, 0.12 * u, 0.09 * u, 0, 0, Math.PI * 2); ctx.fill();   // rabinho
  ctx.fillStyle = '#8a5a3a';
  ctx.beginPath(); ctx.moveTo(0.55 * u, -0.25 * u); ctx.lineTo(0.95 * u, -0.85 * u); ctx.lineTo(1.18 * u, -0.65 * u); ctx.lineTo(0.8 * u, 0.05 * u); ctx.closePath(); ctx.fill();   // pescoco
  ctx.fillStyle = '#9b6a46';
  ctx.beginPath(); ctx.ellipse(1.22 * u, -0.8 * u, 0.3 * u, 0.2 * u, -0.3, 0, Math.PI * 2); ctx.fill();   // cabeca
  ctx.strokeStyle = '#4a2f1c'; ctx.lineWidth = 0.07 * u;   // chifres
  ctx.beginPath(); ctx.moveTo(1.1 * u, -0.95 * u); ctx.lineTo(1.0 * u, -1.4 * u); ctx.moveTo(1.0 * u, -1.25 * u); ctx.lineTo(1.2 * u, -1.45 * u); ctx.moveTo(1.0 * u, -1.4 * u); ctx.lineTo(0.8 * u, -1.55 * u); ctx.stroke();
  if (nose) {
    const glow = 0.55 + 0.35 * Math.sin(t * 5), g = ctx.createRadialGradient(1.48 * u, -0.78 * u, 0, 1.48 * u, -0.78 * u, 0.5 * u);
    g.addColorStop(0, `rgba(255,70,60,${glow})`); g.addColorStop(1, 'rgba(255,70,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1.48 * u, -0.78 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3b30';
  } else ctx.fillStyle = '#3b2418';
  ctx.beginPath(); ctx.arc(1.48 * u, -0.78 * u, 0.09 * u, 0, Math.PI * 2); ctx.fill();   // nariz
}

/** Trenó com o Papai Noel (virado para a direita), com o saco de presentes. */
function drawSleigh(ctx: CanvasRenderingContext2D, u: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#e0b04a'; ctx.lineWidth = 0.09 * u;   // patins dourados
  ctx.beginPath(); ctx.moveTo(-1.7 * u, 1.0 * u); ctx.quadraticCurveTo(0, 1.08 * u, 1.4 * u, 0.92 * u); ctx.quadraticCurveTo(1.75 * u, 0.82 * u, 1.65 * u, 0.5 * u); ctx.stroke();
  ctx.fillStyle = '#b8232b';   // corpo do trenó
  ctx.beginPath(); ctx.moveTo(-1.5 * u, 0); ctx.lineTo(1.2 * u, 0); ctx.quadraticCurveTo(1.35 * u, 0.55 * u, 0.6 * u, 0.78 * u); ctx.lineTo(-1.3 * u, 0.78 * u); ctx.quadraticCurveTo(-1.75 * u, 0.4 * u, -1.5 * u, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e0b04a'; ctx.lineWidth = 0.06 * u;
  ctx.beginPath(); ctx.moveTo(-1.35 * u, 0.62 * u); ctx.lineTo(0.7 * u, 0.62 * u); ctx.stroke();
  ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.arc(-1.0 * u, -0.25 * u, 0.5 * u, 0, Math.PI * 2); ctx.fill();   // saco
  ctx.fillStyle = '#d23a3a'; ctx.beginPath(); ctx.ellipse(-0.1 * u, -0.3 * u, 0.5 * u, 0.45 * u, 0, 0, Math.PI * 2); ctx.fill();   // corpo do Noel
  ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(-0.05 * u, -0.95 * u, 0.28 * u, 0, Math.PI * 2); ctx.fill();   // rosto
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0.0 * u, -0.8 * u, 0.26 * u, 0.1, Math.PI - 0.1); ctx.fill();   // barba
  ctx.fillStyle = '#d23a3a'; ctx.beginPath(); ctx.moveTo(-0.32 * u, -1.08 * u); ctx.lineTo(0.22 * u, -1.1 * u); ctx.lineTo(-0.6 * u, -1.45 * u); ctx.closePath(); ctx.fill();   // gorro
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.34 * u, -1.14 * u, 0.58 * u, 0.1 * u);
  ctx.beginPath(); ctx.arc(-0.6 * u, -1.46 * u, 0.1 * u, 0, Math.PI * 2); ctx.fill();   // pompom
}

function makeChristmas(ctx: CanvasRenderingContext2D, size: Size, dark: boolean): Step {
  interface Flake { x: number; y: number; r: number; vy: number; ph: number; a: number }
  interface Glint { x: number; y: number; life: number }
  let flakes: Flake[] = [];
  const glints: Glint[] = [];
  let santa: { x: number; y0: number; dir: number; t: number; u: number; speed: number } | null = null;
  let wait = 2.5, t = 0;
  const snowColor = dark ? '255,255,255' : '120,150,190';   // no fundo claro o flocos brancos sumiriam

  return (dt) => {
    const { W, H } = size();
    t += dt;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    if (!flakes.length) {   // poucos flocos no celular
      const n = W < 700 ? 45 : 90;
      flakes = Array.from({ length: n }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(1, 3.2), vy: rand(18, 46), ph: rand(0, 6.28), a: rand(0.45, 0.9) }));
    }
    for (const f of flakes) {
      f.y += f.vy * dt; f.x += Math.sin(t * 0.8 + f.ph) * 14 * dt;
      if (f.y > H + 5) { f.y = -5; f.x = rand(0, W); }
      ctx.fillStyle = `rgba(${snowColor},${f.a})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }

    if (!santa) {
      wait -= dt;
      if (wait <= 0) {
        const u = clamp(H / 16, 26, 52), dir = Math.random() < 0.5 ? 1 : -1;
        santa = { x: dir > 0 ? -10 * u : W + 10 * u, y0: H * rand(0.12, 0.38), dir, t: 0, u, speed: (W + 14 * u) / 18 };   // atravessa a tela em ~18 s
      }
    } else {
      const s = santa;
      s.t += dt; s.x += s.dir * s.speed * dt;
      const y = s.y0 + Math.sin(s.t * 0.9) * s.u * 0.5, u = s.u;
      if ((s.dir > 0 && s.x - 2 * u > W) || (s.dir < 0 && s.x + 2 * u < 0)) { santa = null; wait = rand(10, 20); }
      else {
        if (Math.random() < 0.5) glints.push({ x: s.x - s.dir * 2 * u, y: y + rand(-0.3 * u, 0.7 * u), life: 0 });   // brilho dourado que fica para tras
        ctx.save();
        ctx.translate(s.x, y); ctx.scale(s.dir, 1);
        ctx.strokeStyle = 'rgba(240,200,110,0.8)'; ctx.lineWidth = 0.04 * u;   // rédeas
        ctx.beginPath(); ctx.moveTo(1.4 * u, 0.1 * u); ctx.lineTo((3.1 + 3 * 2.0) * u + 0.2 * u, 0); ctx.stroke();
        drawSleigh(ctx, u);
        for (let i = 3; i >= 0; i--) { ctx.save(); ctx.translate((3.1 + i * 2.0) * u, 0); drawReindeer(ctx, u, s.t * 9 + i * 1.3, i === 3, s.t); ctx.restore(); }
        ctx.restore();
      }
    }
    for (let i = glints.length - 1; i >= 0; i--) {
      const g = glints[i];
      g.life += dt;
      if (g.life > 1) { glints.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(250,210,110,${(0.9 * (1 - g.life)).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(g.x, g.y + g.life * 10, 1.8 * (1 - g.life * 0.5), 0, Math.PI * 2); ctx.fill();
    }
  };
}

/** Canvas de efeito (ver CanvasKind). `dark` = tema escuro do visitante (muda o brilho/cor dos efeitos). */
export function SeasonCanvas({ kind, dark }: { kind: CanvasKind; dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);   // 1.5 no maximo: economiza bateria em telas muito densas
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const size: Size = () => ({ W, H });
    const step = kind === 'fireworks' ? makeFireworks(ctx, size, dark, false)
      : kind === 'heartworks' ? makeFireworks(ctx, size, dark, true)
      : kind === 'balloons' ? makeBalloons(ctx, size)
      : makeChristmas(ctx, size, dark);
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      step(Math.min((now - last) / 1000, 0.05));   // dt limitado: ao voltar de outra aba nao "pula"
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [kind, dark]);
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />;
}
