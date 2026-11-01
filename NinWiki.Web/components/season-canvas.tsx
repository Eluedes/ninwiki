'use client';

// Animacoes em canvas dos fundos de epoca (so' Ano Novo e Valentine's Day; as outras epocas usam so' o desenho CSS de seasonal-background.tsx):
//   fireworks = foguetes que sobem de baixo e estouram em varias cores;  balloons = baloes em formato de coracao que enchem e estouram.
// O canvas e' transparente, fica atras do conteudo e nao pega clique. Quem pede menos movimento ao aparelho nao ve nada (o desenho de fundo fica parado).
// O laco para sozinho quando a aba esta escondida (requestAnimationFrame) e e' cancelado ao desmontar.

import { useEffect, useRef } from 'react';

export type CanvasKind = 'fireworks' | 'balloons';
type Size = () => { W: number; H: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

// ---------------------------------------------------------------- fogos: foguetes sobem e estouram
const FIRE_HUES = [45, 330, 190, 130, 20, 270, 0];   // dourado, rosa, ciano, verde, laranja, violeta, vermelho

function makeFireworks(ctx: CanvasRenderingContext2D, size: Size, dark: boolean) {
  interface Rocket { x: number; y: number; vy: number; targetY: number }
  interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; r: number }
  const rockets: Rocket[] = [], sparks: Spark[] = [];
  let timer = 0.5;
  const light = dark ? 64 : 46;   // no fundo claro as cores precisam ser mais escuras para aparecer

  function explode(x: number, y: number, s: number) {
    const hues = [pick(FIRE_HUES), pick(FIRE_HUES), pick(FIRE_HUES)];   // cada estouro mistura ate 3 cores
    const n = Math.round(rand(44, 68));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(30, 150) * s;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(1.3, 2.0), hue: pick(hues), r: rand(1.2, 2.4) });
    }
  }

  return (dt: number) => {
    const { W, H } = size(), s = Math.max(0.6, H / 900);
    ctx.globalCompositeOperation = 'destination-out';   // apaga um pouco a cada quadro: deixa o rastro sumir devagar
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 6)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

    timer -= dt;
    if (timer <= 0 && rockets.length < 2) {
      rockets.push({ x: rand(0.08, 0.92) * W, y: H + 10, vy: -rand(380, 520) * s, targetY: H * rand(0.15, 0.5) });
      timer = rand(1.2, 2.4);
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y += r.vy * dt;
      if (r.y <= r.targetY) { explode(r.x, r.y, s); rockets.splice(i, 1); continue; }
      ctx.fillStyle = `hsl(45 100% ${light + 10}% / 0.95)`;
      ctx.beginPath(); ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2); ctx.fill();
      if (Math.random() < 0.7) sparks.push({ x: r.x, y: r.y + 4, vx: rand(-12, 12), vy: rand(10, 40), life: 0, max: 0.45, hue: 40, r: 1.1 });   // fagulhas do rastro
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt;
      if (p.life >= p.max) { sparks.splice(i, 1); continue; }
      p.vx *= 1 - 0.9 * dt; p.vy = p.vy * (1 - 0.9 * dt) + 55 * s * dt;   // freio do ar e um pouco de gravidade
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

function makeBalloons(ctx: CanvasRenderingContext2D, size: Size) {
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

  return (dt: number) => {
    const { W, H } = size();
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    timer -= dt;
    if (timer <= 0 && balloons.length < 4) {
      balloons.push({ x: rand(0.08, 0.92) * W, y: rand(0.2, 0.8) * H, size: rand(34, 62) * Math.max(0.8, Math.min(1.3, W / 1200 + 0.5)), t: 0, hue: pick(HUES), wob: rand(0, 6.28) });
      timer = rand(1.3, 2.5);
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

/** Canvas de efeito (fogos ou baloes). `dark` = tema escuro do visitante (muda o brilho das cores). */
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
    const step = kind === 'fireworks' ? makeFireworks(ctx, size, dark) : makeBalloons(ctx, size);
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
