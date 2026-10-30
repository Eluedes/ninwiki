/**
 * Summary: motor do mapa-mundi em canvas (sem React): fundo, mosaico das areas, ligacoes, rotas, rotulos, marcadores,
 * arrastar com inercia, zoom suave (roda e pinca), voo ate' uma area e clique/hover.
 *
 * Segue o desenho do mapa do Nin Atlas: fundo escuro com o terreno do mundo; as areas coladas nas posicoes do jogo (1 px por bloco
 * ate' zoom 1,6 e depois a imagem de 4 px por bloco); rotulos por tamanho da area sem se sobrepor; marcadores por tipo que
 * so' aparecem a partir de um zoom; vilas nomeadas de longe. O componente React (`world-atlas.tsx`) so' liga botoes, busca e painel a este motor.
 */

import { IMPORTANT, KEY_HIDDEN, KINDS, KIND_LIST, VILLAGE_COLOR, ZONE_COLOR, levelColor, levelText, type AMap, type AtlasData, type LoreDict, type Mark } from './atlas-data';

export type WorldInfo = { width: number; height: number; ox: number; oy: number; mw: number; mh: number };
export type Tip = { x: number; y: number; title: string; lines: string[]; color?: string } | null;
export type Pick = { mapId: number; mark: Mark | null } | null;
type Callbacks = { onPick: (p: Pick) => void; onTip: (t: Tip) => void; nameOf: (id: number) => [string, string] };

const MAX_ZOOM = 10;
const PANEL_W = 340;
const FAMILY = 'ui-sans-serif, system-ui, "Segoe UI", sans-serif';
const FONT = `16px ${FAMILY}`;
const FONT_BOLD = `700 22px ${FAMILY}`;
const GOLD = (a = 1) => `rgba(245,199,89,${a})`;
const CREAM = (a = 1) => `rgba(255,245,214,${a})`;
const TRAVEL = (a = 1) => `rgba(255,140,97,${a})`;
const overlaps = (taken: number[][], r: number[]) => taken.some((t) => r[0] < t[2] && r[2] > t[0] && r[1] < t[3] && r[3] > t[1]);

export function createEngine(canvas: HTMLCanvasElement, data: AtlasData, world: WorldInfo, cb: Callbacks) {
  const ctx = canvas.getContext('2d')!;
  const maps = data.maps;
  const bySize = [...maps].sort((a, b) => b.w * b.h - a.w * a.h);
  const regionMember = new Set(data.regions.flatMap((r) => r.members));
  const view = { cx: world.ox + world.mw / 2, cy: world.oy + world.mh / 2, z: 0.3 };
  let W = 0, H = 0, dpr = 1;
  let t: LoreDict | null = null;
  let pt = false;
  let hoverMap: AMap | null = null, hoverMark: Mark | null = null, selected: AMap | null = null, selMark: Mark | null = null, keyHover: string | null = null;
  let hidden = new Set<string>();
  let levelsOn = false;
  let inset = { right: 0, bottom: 0 };
  let reserved: number[][] = [];
  let fly: { from: typeof view; to: typeof view; start: number } | null = null;
  let zoomAnim: { target: number; sx: number; sy: number; wx: number; wy: number } | null = null;
  let glide: { vx: number; vy: number } | null = null;
  let looping = false, queued = false, last = 0, dead = false;

  // ---- imagens (fundo, mosaico e a imagem de 4 px por bloco de cada area), carregadas sob demanda
  const cache = new Map<string, HTMLImageElement>();
  const image = (src: string) => {
    let img = cache.get(src);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.onload = draw;
      img.src = src;
      cache.set(src, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  };

  // ---- vista
  const fitZoom = () => Math.max(W / world.width, H / world.height);
  const clampZoom = (z: number) => Math.max(fitZoom(), Math.min(Math.max(fitZoom(), MAX_ZOOM), z));
  const visW = () => W - inset.right;
  const visH = () => H - inset.bottom;
  function clampView() {
    view.z = clampZoom(view.z);
    const hw = W / 2 / view.z, hh = H / 2 / view.z;
    view.cx = hw * 2 >= world.width ? world.width / 2 : Math.max(hw, Math.min(world.width - hw, view.cx));
    view.cy = hh * 2 >= world.height ? world.height / 2 : Math.max(hh, Math.min(world.height - hh, view.cy));
  }
  const toScreen = (wx: number, wy: number): [number, number] => [(wx - view.cx) * view.z + W / 2, (wy - view.cy) * view.z + H / 2];
  const toWorld = (sx: number, sy: number): [number, number] => [(sx - W / 2) / view.z + view.cx, (sy - H / 2) / view.z + view.cy];

  // ---- animacao: um laco unico cuida de voo, zoom suave e inercia do arraste
  function animate() {
    if (!looping && !dead) {
      looping = true;
      last = performance.now();
      requestAnimationFrame(step);
    }
  }
  function step(now: number) {
    if (dead) return;
    const dt = Math.min(50, now - last);
    last = now;
    if (fly) {
      const p = Math.min(1, (now - fly.start) / 450), e = 1 - Math.pow(1 - p, 3);
      view.cx = fly.from.cx + (fly.to.cx - fly.from.cx) * e;
      view.cy = fly.from.cy + (fly.to.cy - fly.from.cy) * e;
      view.z = Math.exp(Math.log(fly.from.z) + (Math.log(fly.to.z) - Math.log(fly.from.z)) * e);
      if (p >= 1) fly = null;
    }
    if (zoomAnim) {
      const k = 1 - Math.exp(-dt / 70);
      const z = Math.exp(Math.log(view.z) + (Math.log(zoomAnim.target) - Math.log(view.z)) * k);
      view.z = Math.abs(z - zoomAnim.target) / zoomAnim.target < 0.002 ? zoomAnim.target : z;
      view.cx = zoomAnim.wx - (zoomAnim.sx - W / 2) / view.z;
      view.cy = zoomAnim.wy - (zoomAnim.sy - H / 2) / view.z;
      if (view.z === zoomAnim.target) zoomAnim = null;
    }
    if (glide) {
      view.cx -= (glide.vx * dt) / view.z;
      view.cy -= (glide.vy * dt) / view.z;
      const decay = Math.exp(-dt / 260);
      glide.vx *= decay;
      glide.vy *= decay;
      if (Math.hypot(glide.vx, glide.vy) < 0.02) glide = null;
    }
    clampView();
    render();
    if (fly || zoomAnim || glide || keyHover) requestAnimationFrame(step);
    else looping = false;
  }
  const stopMotion = () => {
    fly = null;
    zoomAnim = null;
    glide = null;
  };
  function flyTo(cx: number, cy: number, z: number) {
    stopMotion();
    hoverMap = hoverMark = null;
    cb.onTip(null);
    fly = { from: { ...view }, to: { cx, cy, z: clampZoom(z) }, start: performance.now() };
    animate();
  }
  /** Com o painel aberto a parte visivel e' menor: mira no centro dela. */
  const shiftX = (z: number) => inset.right / 2 / z;
  const shiftY = (z: number) => inset.bottom / 2 / z;
  function flyToPoint(wx: number, wy: number, z: number) {
    const zz = clampZoom(z);
    flyTo(wx + shiftX(zz), wy + shiftY(zz), zz);
  }
  function flyToMap(m: AMap) {
    flyToPoint(m.x + m.w / 2, m.y + m.h / 2, Math.min(MAX_ZOOM, 0.85 * Math.min(visW() / m.w, visH() / m.h)));
  }

  // ---- desenho
  let widths = new Map<string, number>();
  const textWidth = (text: string, font: string) => {
    const key = font + text;
    let w = widths.get(key);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(text).width;
      widths.set(key, w);
    }
    return w;
  };
  function outlined(text: string, x: number, y: number, color: string, font: string, alpha = 0.85) {
    ctx.font = font;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) ctx.fillText(text, x + dx, y + dy);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  const nm = (id: number) => cb.nameOf(id)[pt ? 1 : 0];

  function draw() {
    if (looping || queued || dead) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  function render() {
    if (!W || dead) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1317';
    ctx.fillRect(0, 0, W, H);
    const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(W, H);

    // Fundo: terreno do mundo (metade do tamanho do mundo); so' a parte visivel e' escalada.
    const bg = image('/game-maps/world-bg.webp');
    if (bg) {
      const k = bg.width / world.width;
      const sx = Math.max(0, x0 * k), sy = Math.max(0, y0 * k);
      const sw = Math.min(bg.width, x1 * k) - sx, sh = Math.min(bg.height, y1 * k) - sy;
      if (sw > 0 && sh > 0) {
        const [dx, dy] = toScreen(sx / k, sy / k);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(bg, sx, sy, sw, sh, dx, dy, (sw / k) * view.z, (sh / k) * view.z);
      }
    }
    // Sombra de cada area (da' profundidade, como no Atlas) e depois o mosaico (1 px por bloco) so' na parte visivel.
    const visible = maps.filter((m) => !(m.x > x1 || m.y > y1 || m.x + m.w < x0 || m.y + m.h < y0));
    if (view.z > 0.2) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = Math.min(24, 8 + view.z * 6);
      ctx.fillStyle = '#16100a';
      for (const m of visible) {
        const [sx, sy] = toScreen(m.x, m.y);
        ctx.fillRect(sx, sy, m.w * view.z, m.h * view.z);
      }
      ctx.restore();
    }
    const mosaic = image('/game-maps/world-map.webp');
    if (mosaic) {
      const sx = Math.max(0, x0 - world.ox), sy = Math.max(0, y0 - world.oy);
      const sw = Math.min(world.mw, x1 - world.ox) - sx, sh = Math.min(world.mh, y1 - world.oy) - sy;
      if (sw > 0 && sh > 0) {
        const [dx, dy] = toScreen(sx + world.ox, sy + world.oy);
        ctx.imageSmoothingEnabled = view.z < 4;
        ctx.drawImage(mosaic, sx, sy, sw, sh, dx, dy, sw * view.z, sh * view.z);
      }
    }
    // Mais perto: a imagem de 4 px por bloco de cada area visivel substitui o mosaico.
    if (view.z >= 1.6) {
      ctx.imageSmoothingEnabled = view.z < 4;
      for (const m of visible) {
        const img = image(`/game-maps/${m.id}.webp`);
        if (img) {
          const [sx, sy] = toScreen(m.x, m.y);
          ctx.drawImage(img, sx, sy, m.w * view.z, m.h * view.z);
        }
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    const taken = [...reserved];
    if (inset.right) taken.push([W - inset.right, 0, W, H]);
    if (inset.bottom) taken.push([0, H - inset.bottom, W, H]);
    if (levelsOn) drawLevelTint(visible);
    drawOutlines();
    drawConnectors();
    drawRoutes();
    drawHouses(visible, taken);
    drawRegions(taken);
    drawMarkers(taken, true);
    drawLabels(visible, taken);
    drawRouteLabels(taken);
    if (levelsOn) drawLevelLabels(visible, taken);
    drawMarkers(taken, false);
    ctx.restore();
  }

  function drawLevelTint(list: AMap[]) {
    for (const m of list) {
      if (!m.lv) continue;
      const [x, y] = toScreen(m.x, m.y);
      const w = m.w * view.z, h = m.h * view.z;
      const avg = (m.lv[0] + m.lv[1]) / 2;
      ctx.fillStyle = levelColor(avg, 0.38);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = levelColor(avg, 0.9);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
    }
  }
  function drawLevelLabels(list: AMap[], taken: number[][]) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of bySize) {
      if (!m.lv || !list.includes(m)) continue;
      const [x, y] = toScreen(m.x + m.w / 2, m.y + m.h / 2);
      if (m.w * view.z < 44 || m.h * view.z < 22) continue;
      const text = (t?.mapLevelRange ?? 'Lv {lv}').replace('{lv}', levelText(m.lv));
      const tw = textWidth(text, `700 15px ${FAMILY}`);
      const rect = [x - tw / 2 - 6, y - 10, x + tw / 2 + 6, y + 10];
      if (overlaps(taken, rect)) continue;
      taken.push(rect);
      outlined(text, x, y, '#fff', `700 15px ${FAMILY}`, 0.9);
    }
  }
  function drawOutlines() {
    if (hoverMap && hoverMap !== selected && !hoverMark) {
      const [x, y] = toScreen(hoverMap.x, hoverMap.y);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, hoverMap.w * view.z - 1, hoverMap.h * view.z - 1);
    }
    if (selected) {
      const [x, y] = toScreen(selected.x, selected.y);
      ctx.strokeStyle = GOLD(0.95);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x - 1, y - 1, selected.w * view.z + 2, selected.h * view.z + 2);
    }
  }
  function dashed(points: [number, number][], color: string, width: number, dash: number, gap: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([dash, gap]);
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function curve(p0: [number, number], p1: [number, number]) {
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const c = [mx - dy * 0.18, my + dx * 0.18];
    const n = Math.max(8, Math.min(256, Math.round(Math.hypot(dx, dy) / 6)));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const p = i / n, u = 1 - p;
      pts.push([u * u * p0[0] + 2 * u * p * c[0] + p * p * p1[0], u * u * p0[1] + 2 * u * p * c[1] + p * p * p1[1]]);
    }
    return { pts, mid: [0.25 * p0[0] + 0.5 * c[0] + 0.25 * p1[0], 0.25 * p0[1] + 0.5 * c[1] + 0.25 * p1[1]] as [number, number] };
  }
  function arrows(mx: number, my: number, dirs: [number, number][]) {
    const s = Math.max(3.5, Math.min(7, view.z * 3));
    for (const [dx, dy] of dirs) {
      const px = mx + dx * 1.1 * s, py = my + dy * 1.1 * s;
      const bx = px - 0.6 * s * dx, by = py - 0.6 * s * dy, nx = -dy * 0.75 * s, ny = dx * 0.75 * s;
      ctx.beginPath();
      ctx.moveTo(px + dx * s, py + dy * s);
      ctx.lineTo(bx + nx, by + ny);
      ctx.lineTo(bx - nx, by - ny);
      ctx.closePath();
      ctx.fillStyle = CREAM();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  /** Saidas entre areas: faixa tracejada quando as bordas estao lado a lado, linha com setas quando ha' vao entre elas. */
  function drawConnectors() {
    for (const c of data.connectors) {
      const sa = toScreen(...c.ca), sb = toScreen(...c.cb);
      const len = Math.hypot(sb[0] - sa[0], sb[1] - sa[1]);
      if (len < 3) continue;
      if (Math.max(sa[0], sb[0]) < -8 || Math.min(sa[0], sb[0]) > W + 8 || Math.max(sa[1], sb[1]) < -8 || Math.min(sa[1], sb[1]) > H + 8) continue;
      if (c.covered) {
        dashed(curve(sa, sb).pts, CREAM(0.45), 2, 2, 4);
        continue;
      }
      if (c.straight) {
        const q = [toScreen(c.ma[0], c.ma[1]), toScreen(c.ma[2], c.ma[3]), toScreen(c.mb[2], c.mb[3]), toScreen(c.mb[0], c.mb[1])];
        ctx.beginPath();
        q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = CREAM(0.16);
        ctx.fill();
        dashed([...q, q[0]], CREAM(0.6), 1.2, 5, 4);
      } else {
        if (len < 8) continue;
        dashed([sa, sb], CREAM(0.45), 2, 2, 4);
      }
      if (view.z >= 0.45 && len >= 5 * Math.max(3.5, Math.min(7, view.z * 3))) {
        const d: [number, number] = [(sb[0] - sa[0]) / len, (sb[1] - sa[1]) / len];
        arrows((sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2, c.both ? [d, [-d[0], -d[1]]] : [d]);
      }
    }
  }
  const routeCurve = (r: AtlasData['routes'][number]) => {
    const from = data.byId.get(r.from), to = data.byId.get(r.to);
    if (!from || !to) return null;
    return curve(toScreen(from.x + r.fx + 0.5, from.y + r.fy + 0.5), toScreen(to.x + to.w / 2, to.y + to.h / 2));
  };
  function drawRoutes() {
    for (const r of data.routes) {
      const npc = r.how.startsWith('npc:');
      if (npc && hidden.has('travel')) continue;
      const c = routeCurve(r);
      if (c) dashed(c.pts, npc ? TRAVEL(0.85) : CREAM(0.4), 2, npc ? 8 : 2, npc ? 6 : 5);
    }
  }
  /** Nome das vilas, visto de longe (de perto cada area ja' tem o proprio rotulo). */
  function drawRegions(taken: number[][]) {
    if (view.z >= 1.1) return;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    for (const r of data.regions) {
      const [x, y] = toScreen((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
      if (x < -80 || y < -80 || x > W + 80 || y > H + 80) continue;
      const name = pt ? r.pt : r.name;
      const color = VILLAGE_COLOR[r.village] ?? '#fff';
      const w = textWidth(name, FONT_BOLD);
      ctx.beginPath();
      ctx.arc(x, y - 8, 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      outlined(name, x, y + 4, color, FONT_BOLD);
      taken.push([x - Math.max(16, w / 2) - 4, y - 18, x + Math.max(16, w / 2) + 4, y + 32]);
    }
  }
  function drawLabels(list: AMap[], taken: number[][]) {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    const order = selected ? [selected, ...bySize.filter((m) => m !== selected)] : bySize;
    for (const m of order) {
      if (!list.includes(m) && m !== selected) continue;
      const [x, y] = toScreen(m.x, m.y);
      const w = m.w * view.z, h = m.h * view.z;
      if (x > W || y > H || x + w < 0 || y + h < 0) continue;
      if (view.z < 1.1 && regionMember.has(m.id)) continue;
      const forced = m === selected || m === hoverMap;
      const name = nm(m.id);
      const tw = textWidth(name, FONT);
      const top = y + Math.min(8, h / 2 - 8.5);
      const rect = [x + w / 2 - tw / 2 - 4, top - 2, x + w / 2 + tw / 2 + 4, top + 19];
      if (!forced && (w < 70 || h < 26 || tw > 1.25 * w || overlaps(taken, rect))) continue;
      taken.push(rect);
      outlined(name, x + w / 2, top, forced ? GOLD() : '#fff', FONT);
    }
  }
  function drawRouteLabels(taken: number[][]) {
    if (view.z <= 0.6 || hidden.has('travel')) return;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const seen = new Set<string>();
    for (const r of data.routes) {
      const key = `${r.from}|${r.label}`;
      const first = !seen.has(key);
      seen.add(key);
      if (!r.how.startsWith('npc:') || !first) continue;
      const c = routeCurve(r);
      if (!c) continue;
      const label = pt ? r.pt : r.label;
      const tw = textWidth(label, FONT);
      const rect = [c.mid[0] - tw / 2 - 3, c.mid[1] - 9.5, c.mid[0] + tw / 2 + 3, c.mid[1] + 9.5];
      if (overlaps(taken, rect)) continue;
      taken.push(rect);
      outlined(label, c.mid[0], c.mid[1], TRAVEL(), FONT);
    }
  }
  function drawHouses(list: AMap[], taken: number[][]) {
    if (view.z <= 0.9) return;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const m of list) {
      if (m.hs < 3) continue;
      const [x, y] = toScreen(m.x, m.y);
      const w = m.w * view.z, h = m.h * view.z;
      const text = (t?.mapHousesN ?? '{n} houses').replace('{n}', String(m.hs));
      const tw = textWidth(text, FONT) + 24;
      const cy = y + h - Math.min(22, h * 0.18);
      const rect = [x + w / 2 - tw / 2, cy - 11, x + w / 2 + tw / 2, cy + 11];
      if (overlaps(taken, rect)) continue;
      taken.push(rect);
      // casinha verde (telhado + corpo) no lugar do icone do jogo
      ctx.fillStyle = '#5bbf4a';
      ctx.beginPath();
      ctx.moveTo(rect[0] + 10, cy - 9);
      ctx.lineTo(rect[0] + 20, cy);
      ctx.lineTo(rect[0], cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(rect[0] + 3, cy, 14, 8);
      outlined(text, rect[0] + 24, cy, '#fff', FONT);
    }
  }

  /** Distintivo do marcador: circulo da cor do tipo com o simbolo dentro. */
  function drawIcon(kind: string, x: number, y: number, r: number, alpha = 1) {
    const st = KINDS[kind];
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14,18,22,.92)';
    ctx.fill();
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `700 ${Math.round(r * 1.2)}px ui-sans-serif, system-ui, "Segoe UI Symbol", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = st.color;
    ctx.fillText(st.glyph, x, y + 0.5);
    ctx.globalAlpha = 1;
  }
  function halo(x: number, y: number, r: number, p = 0) {
    ctx.beginPath();
    ctx.arc(x, y, r + 5 + 2 * p, 0, Math.PI * 2);
    ctx.fillStyle = GOLD(0.2 + 0.12 * p);
    ctx.fill();
    ctx.strokeStyle = GOLD(0.95);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  function drawMarkers(taken: number[][], important: boolean) {
    const pulse = keyHover ? 0.5 + 0.5 * Math.sin((performance.now() / 1000) * 6) : 0;
    // Enquanto a legenda filtra, os tipos que ficaram ligados aparecem em qualquer zoom e passam na frente dos rotulos.
    const filtering = hidden.size > 0;
    for (const g of data.marks) {
      if ((filtering || IMPORTANT.has(g.k)) !== important) continue;
      g.screen = null;
      const forced = g === hoverMark || g === selMark;
      const off = hidden.has(g.k) || (filtering && KEY_HIDDEN.has(g.k));
      const chosen = (filtering && !off) || keyHover === g.k;
      if (!forced && (off || (!chosen && view.z < KINDS[g.k].min))) continue;
      const [x, y] = toScreen(g.x, g.y).map(Math.round);
      if (x < -24 || y < -24 || x > W + 24 || y > H + 24) continue;
      const r = 10;
      const rect = [x - r - 2, y - r - 2, x + r + 2, y + r + 2];
      if (!forced && !chosen && overlaps(taken, rect)) continue;
      taken.push(rect);
      if (forced) halo(x, y, r);
      if (keyHover === g.k) halo(x, y, r, pulse);
      drawIcon(g.k, x, y, r, keyHover && keyHover !== g.k ? 0.3 : 1);
      g.screen = [x, y, r];
    }
  }

  // ---- busca de alvos sob o cursor
  function mapAt(sx: number, sy: number): AMap | null {
    const [wx, wy] = toWorld(sx, sy);
    let best: AMap | null = null;
    for (const m of maps) if (wx >= m.x && wy >= m.y && wx < m.x + m.w && wy < m.y + m.h && (!best || m.w * m.h < best.w * best.h)) best = m;
    return best;
  }
  function markAt(sx: number, sy: number): Mark | null {
    let best: Mark | null = null;
    for (const g of data.marks) if (g.screen && Math.hypot(g.screen[0] - sx, g.screen[1] - sy) <= g.screen[2] + 2) best = g;
    return best;
  }

  // ---- dica ao passar o mouse
  const kindName = (k: string) => (t ? (t[KINDS[k].label] as string) : k);
  function tipFor(g: Mark | null, m: AMap | null, x: number, y: number): Tip {
    if (g) {
      const names = [...new Set(g.e.map((e) => (pt ? e[2] : e[1])))];
      const extra = names.length > 6 ? [`+${names.length - 6}`] : [];
      return { x, y, title: g.t ? (pt ? g.t[1] : g.t[0]) : names.length === 1 ? names[0] : kindName(g.k), lines: g.t || names.length > 1 ? [...names.slice(0, 6), ...extra] : [kindName(g.k)], color: KINDS[g.k].color };
    }
    if (m) {
      const lines = [m.z ? m.z : ''];
      if (m.lv) lines.push((t?.mapLevelRange ?? 'Lv {lv}').replace('{lv}', levelText(m.lv)));
      return { x, y, title: nm(m.id), lines: lines.filter(Boolean), color: ZONE_COLOR[m.z] };
    }
    return null;
  }
  function hover(sx: number, sy: number) {
    const g = markAt(sx, sy);
    const m = g ? null : mapAt(sx, sy);
    if (g !== hoverMark || m !== hoverMap) {
      hoverMark = g;
      hoverMap = m;
      draw();
      canvas.style.cursor = g || m ? 'pointer' : 'grab';
    }
    cb.onTip(tipFor(g, m, sx, sy));
  }

  // ---- entrada: arrastar (com inercia), pinca, toque duplo e roda
  type Drag = { x: number; y: number; cx: number; cy: number; moved: boolean; trail: [number, number, number][] };
  let drag: Drag | null = null;
  let pinch: { dist: number; z: number; world: [number, number] } | null = null;
  let lastTap = 0;
  const touches = new Map<number, [number, number]>();
  const pinchState = () => {
    const [a, b] = [...touches.values()];
    return { dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number] };
  };
  const rel = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onDown = (e: PointerEvent) => {
    const [px, py] = rel(e);
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, [px, py]);
      if (touches.size === 2) {
        stopMotion();
        drag = null;
        const s = pinchState();
        pinch = { dist: s.dist, z: view.z, world: toWorld(...s.mid) };
        return;
      }
      if (e.timeStamp - lastTap < 300) {
        const [wx, wy] = toWorld(px, py);
        flyTo(wx, wy, view.z * 2);
        lastTap = 0;
        return;
      }
      lastTap = e.timeStamp;
    }
    if (e.button !== 0 && e.button !== 1) return;
    stopMotion();
    // Sem capturar o ponteiro aqui: so' depois que vira arraste (capturar no clique atrapalharia o clique de verdade).
    drag = { x: px, y: py, cx: view.cx, cy: view.cy, moved: false, trail: [[px, py, e.timeStamp]] };
  };
  const onMove = (e: PointerEvent) => {
    const [px, py] = rel(e);
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, [px, py]);
    if (pinch && touches.size === 2) {
      const s = pinchState();
      view.z = clampZoom((pinch.z * s.dist) / pinch.dist);
      view.cx = pinch.world[0] - (s.mid[0] - W / 2) / view.z;
      view.cy = pinch.world[1] - (s.mid[1] - H / 2) / view.z;
      clampView();
      draw();
      return;
    }
    if (drag) {
      const dx = px - drag.x, dy = py - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        cb.onTip(null);
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
      }
      if (drag.moved) {
        view.cx = drag.cx - dx / view.z;
        view.cy = drag.cy - dy / view.z;
        clampView();
        drag.trail.push([px, py, e.timeStamp]);
        if (drag.trail.length > 6) drag.trail.shift();
        draw();
      }
      return;
    }
    if (e.pointerType !== 'touch') hover(px, py);
  };
  const endTouch = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
  };
  const onUp = (e: PointerEvent) => {
    const wasPinch = Boolean(pinch);
    endTouch(e);
    if (wasPinch) {
      drag = null;
      return;
    }
    const d = drag;
    drag = null;
    if (!d) return;
    canvas.style.cursor = 'grab';
    if (d.moved) {
      // Continua deslizando com a velocidade dos ultimos movimentos.
      const a = d.trail[0], b = d.trail[d.trail.length - 1], ms = b[2] - a[2];
      if (ms > 0 && e.timeStamp - b[2] < 80) {
        glide = { vx: (b[0] - a[0]) / ms, vy: (b[1] - a[1]) / ms };
        animate();
      }
      return;
    }
    const [px, py] = rel(e);
    const g = markAt(px, py);
    if (g) {
      selMark = g;
      selected = data.byId.get(g.m) ?? null;
      draw();
      cb.onPick({ mapId: g.m, mark: g });
      return;
    }
    const m = mapAt(px, py);
    selMark = null;
    selected = m;
    draw();
    cb.onPick(m ? { mapId: m.id, mark: null } : null);
  };
  const onCancel = (e: PointerEvent) => {
    endTouch(e);
    drag = null;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    fly = null;
    glide = null;
    const notches = -e.deltaY / (e.deltaMode === 1 ? 3 : 100);
    const target = clampZoom((zoomAnim ? zoomAnim.target : view.z) * Math.pow(1.18, notches));
    const [px, py] = rel(e);
    const [wx, wy] = toWorld(px, py);
    zoomAnim = { target, sx: px, sy: py, wx, wy };
    animate();
    cb.onTip(null);
  };
  const onLeave = () => {
    if (!drag) {
      hoverMap = hoverMark = null;
      cb.onTip(null);
      draw();
    }
  };
  /** Atalhos com o mapa focado: + e - dao zoom, 0 mostra o mundo, setas movem. */
  const onKey = (e: KeyboardEvent) => {
    const step = 120 / view.z;
    if (e.key === '+' || e.key === '=') zoomBy(1.5);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.5);
    else if (e.key === '0') fit();
    else if (e.key.startsWith('Arrow')) flyTo(view.cx + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), view.cy + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0), view.z);
    else return;
    e.preventDefault();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);

  // ---- comandos para o componente
  function zoomBy(f: number) {
    const target = clampZoom((zoomAnim ? zoomAnim.target : view.z) * f);
    const sx = visW() / 2, sy = visH() / 2;
    const [wx, wy] = toWorld(sx, sy);
    zoomAnim = { target, sx, sy, wx, wy };
    animate();
  }
  /** Enquadra o mapa-mundi inteiro (a parte do mundo que tem areas). */
  function fit() {
    flyToPoint(world.ox + world.mw / 2, world.oy + world.mh / 2, Math.min(visW() / world.mw, visH() / world.mh) * 0.97);
  }
  function resize(w: number, h: number, ratio: number) {
    const first = W === 0;
    W = w;
    H = h;
    dpr = ratio;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    if (first) {
      view.z = Math.max(fitZoom(), Math.min(w / world.mw, h / world.mh) * 0.97);
      view.cx = world.ox + world.mw / 2;
      view.cy = world.oy + world.mh / 2;
    }
    clampView();
    updateReserved();
    draw();
  }
  /** Areas da tela onde rotulos e marcadores nao podem ficar (barra de cima e botoes). */
  function updateReserved() {
    reserved = [[0, 0, W, 56]];
  }

  return {
    resize,
    draw,
    zoomBy,
    fit,
    flyToMap,
    flyToPoint,
    /** Seleciona uma area (e opcionalmente um marcador) vinda de fora (busca, painel, link). */
    select(id: number | null, mark: Mark | null = null) {
      selected = id == null ? null : (data.byId.get(id) ?? null);
      selMark = mark;
      draw();
    },
    setHidden(h: Set<string>) {
      hidden = h;
      draw();
    },
    setLevels(on: boolean) {
      levelsOn = on;
      draw();
    },
    setKeyHover(k: string | null) {
      keyHover = k;
      if (k) animate();
      else draw();
    },
    setText(dict: LoreDict, portugues: boolean) {
      t = dict;
      pt = portugues;
      widths = new Map();
      draw();
    },
    /** Espaco coberto pelo painel (direita no computador, embaixo no celular). */
    setInset(right: number, bottom: number) {
      inset = { right, bottom };
      draw();
    },
    kinds: KIND_LIST,
    destroy() {
      dead = true;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKey);
    },
  };
}
export type Engine = ReturnType<typeof createEngine>;
export const PANEL_WIDTH = PANEL_W;
