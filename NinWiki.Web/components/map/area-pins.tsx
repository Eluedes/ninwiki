'use client';

/**
 * Summary: imagem de uma area do jogo com PINOS por cima (lugares, predios, portas para outras areas, mobs, NPCs e recursos).
 *
 * Os pinos vem de `area-pins.json` (gerado de `world-atlas`, ver `gravar_atlas_do_mundo` no script do mapa); x/y em BLOCOS da area
 * e a imagem tem 4 px por bloco, entao a posicao do pino e' (bloco + 0,5) * 4 * zoom. Cada tipo liga/desliga; as portas levam a outra area.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { KINDS, type LoreDict } from './atlas-data';

type Pinos = {
  npcs: [string, string, number, number][]; res: [string, string][];
  areas: Record<string, { p: [string, string, string, number, number][]; r: [string, string, number, number][]; d: [number, number, number][];
    m: [number, number, number][]; n: [number, number, number][]; c: [number, number, number, number][] }>;
};
let promessa: Promise<Pinos> | null = null;
/** Importa o json sob demanda (uma vez so'). */
const carregar = () => (promessa ??= import('@/public/game-maps/area-pins.json').then((m) => m.default as unknown as Pinos));

/** Camadas de pinos: simbolo e cor (as de lugares usam o estilo de cada tipo de marcador). */
const CAMADAS = {
  places: { glyph: '$', color: '#ffc74d' },
  rooms: { glyph: '⌂', color: '#f3ead2' },
  doors: { glyph: '➜', color: '#ff8c61' },
  mobs: { glyph: '☠', color: '#f24d47' },
  npcs: { glyph: '☺', color: '#80b8ff' },
  res: { glyph: '✿', color: '#8feba8' },
} as const;
type Camada = keyof typeof CAMADAS;

export function AreaPins({ id, width, height, zoom, alt, t, pt, nomeDaArea, podeIr, onGo }: {
  id: number; width: number; height: number; zoom: number; alt: string; t: LoreDict; pt: boolean;
  nomeDaArea: (id: number) => string; podeIr: (id: number) => boolean; onGo: (id: number) => void;
}) {
  const [pinos, setPinos] = useState<Pinos | null>(null);
  const [ligadas, setLigadas] = useState<Set<Camada>>(() => new Set<Camada>(['places', 'rooms', 'doors', 'mobs', 'npcs']));
  useEffect(() => {
    let vivo = true;
    carregar().then((p) => vivo && setPinos(p));
    return () => {
      vivo = false;
    };
  }, []);
  const a = pinos?.areas[String(id)];
  const rotulos: Record<Camada, string> = { places: t.mapPlaces, rooms: t.mapRooms, doors: t.mapDoors, mobs: t.mapMobs, npcs: t.mapNpcs, res: t.mapResources };
  const contagem: Record<Camada, number> = { places: a?.p.length ?? 0, rooms: a?.r.length ?? 0, doors: a?.d.length ?? 0, mobs: a?.m.length ?? 0, npcs: a?.n.length ?? 0, res: a?.c.length ?? 0 };
  const px = (b: number) => (b + 0.5) * 4 * zoom;
  const nome = (par: [string, string]) => (pt ? par[1] : par[0]);

  /** Um pino: circulo pequeno na posicao do bloco; `titulo` aparece ao passar o mouse e vai para leitores de tela. */
  const pino = (key: string, cam: Camada, x: number, y: number, titulo: string, cor: string, glifo: string, ir?: number) => {
    const estilo = { left: px(x), top: px(y), borderColor: cor, color: cor };
    const cls = 'absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-[#0e1216]/90 text-xs font-bold shadow';
    return ir != null && podeIr(ir) ? (
      <button key={key} title={titulo} aria-label={titulo} onClick={() => onGo(ir)} style={estilo} className={cn(cls, 'hover:scale-125')} data-camada={cam}>{glifo}</button>
    ) : (
      <span key={key} title={titulo} aria-label={titulo} role="img" style={estilo} className={cls} data-camada={cam}>{glifo}</span>
    );
  };

  return (
    <div>
      <div role="group" aria-label={t.mapPinsTitle} className="mb-2 flex flex-wrap gap-1.5">
        {(Object.keys(CAMADAS) as Camada[]).map((c) => (
          <button
            key={c}
            aria-pressed={ligadas.has(c)}
            disabled={!pinos}
            onClick={() => setLigadas((s) => { const n = new Set(s); if (!n.delete(c)) n.add(c); return n; })}
            className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-xs', ligadas.has(c) ? 'border-primary bg-primary/10' : 'border-border opacity-60')}
          >
            <span style={{ color: CAMADAS[c].color }} className="font-bold">{CAMADAS[c].glyph}</span>
            {rotulos[c]} ({contagem[c]})
          </button>
        ))}
      </div>
      <div className="relative mx-auto" style={{ width: width * zoom, height: height * zoom }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem estatica do jogo; o zoom e' so' a largura em pixels inteiros */}
        <img src={`/game-maps/${id}.webp`} alt={alt} width={width * zoom} height={height * zoom} style={{ width: width * zoom, maxWidth: 'none' }} className="[image-rendering:pixelated]" />
        {a && pinos && (
          <>
            {ligadas.has('places') && a.p.map((p, i) => pino(`p${i}`, 'places', p[3], p[4], `${pt ? p[2] : p[1]} · ${KINDS[p[0]] ? (t[KINDS[p[0]].label] as string) : p[0]}`, KINDS[p[0]]?.color ?? '#fff', KINDS[p[0]]?.glyph ?? '•'))}
            {ligadas.has('rooms') && a.r.map((r, i) => pino(`r${i}`, 'rooms', r[2], r[3], nome([r[0], r[1]]), CAMADAS.rooms.color, CAMADAS.rooms.glyph))}
            {ligadas.has('doors') && a.d.map((d, i) => pino(`d${i}`, 'doors', d[0], d[1], `${t.mapGoTo} ${nomeDaArea(d[2])}`, CAMADAS.doors.color, CAMADAS.doors.glyph, d[2]))}
            {ligadas.has('mobs') && a.m.map((m, i) => { const n = pinos.npcs[m[2]]; return pino(`m${i}`, 'mobs', m[0], m[1], `${nome([n[0], n[1]])} · ${t.mapLevelRange.replace('{lv}', String(n[2]))}${n[3] ? ` · ${t.mapChief}` : ''}`, CAMADAS.mobs.color, CAMADAS.mobs.glyph); })}
            {ligadas.has('npcs') && a.n.map((m, i) => { const n = pinos.npcs[m[2]]; return pino(`n${i}`, 'npcs', m[0], m[1], nome([n[0], n[1]]), CAMADAS.npcs.color, CAMADAS.npcs.glyph); })}
            {ligadas.has('res') && a.c.map((c, i) => pino(`c${i}`, 'res', c[0], c[1], `${nome(pinos.res[c[2]] as [string, string])} ×${c[3]}`, CAMADAS.res.color, CAMADAS.res.glyph))}
          </>
        )}
      </div>
    </div>
  );
}
