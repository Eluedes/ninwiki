'use client';

/**
 * Summary: painel lateral (celular: folha embaixo) da area selecionada no mapa-mundi: faixa com a imagem, zona, numeros, faixa de nivel
 * e abas Mobs / Locais / Recursos, mais o marcador clicado, as saidas (clicaveis: levam para a area vizinha) e os botoes de link e imagem.
 * Os dados vem de `areas-info.json` (gerado pelo script do Atlas), carregado so' quando o painel abre.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Image as ImageIcon, Link2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KINDS, ZONE_COLOR, levelColor, levelText, TOP_LEVEL, type AMap, type LoreDict, type Mark } from './atlas-data';

/** Dados enxutos de uma area vindos do Atlas. Ver `gravar_info_das_areas` no script. */
type Info = {
  z: string; v: number; h: number;
  p: [string, string, string, number, number][]; e: [number, string][]; r: [string, string, number, number][];
  n: [string, string][]; m: [string, string, number][]; res: [string, string, number][];
};
export type InfoTudo = { names: Record<string, [string, string]>; areas: Record<string, Info> };
let infoPromessa: Promise<InfoTudo> | null = null;
/** Importa o json sob demanda (uma vez so'); o site nao depende do Atlas em tempo de execucao. */
export const carregarInfo = () => (infoPromessa ??= import('@/public/game-maps/areas-info.json').then((m) => m.default as unknown as InfoTudo));

const rotuloZona = (t: LoreDict, z: string) =>
  z.startsWith('Safe') ? t.mapZoneSafe : z.startsWith('Danger') ? t.mapZoneDanger : z.startsWith('War') ? t.mapZoneWar : t.mapZoneNone;
const rotuloDirecao = (t: LoreDict, d: string) =>
  ({ North: t.mapDirNorth, South: t.mapDirSouth, East: t.mapDirEast, West: t.mapDirWest })[d as 'North'] ?? t.mapDirOther;
type Aba = 'mobs' | 'places' | 'res';

export function AreaPanel({ map, mark, t, pt, name, canGo, onGo, onClose, onImage, onCopy, copied, villageName }: {
  map: AMap; mark: Mark | null; t: LoreDict; pt: boolean; name: string; canGo: (id: number) => boolean; onGo: (id: number) => void;
  onClose: () => void; onImage: () => void; onCopy: () => void; copied: boolean; villageName?: string;
}) {
  const [tudo, setTudo] = useState<InfoTudo | null>(null);
  const [aba, setAba] = useState<Aba>('mobs');
  useEffect(() => {
    let vivo = true;
    carregarInfo().then((d) => vivo && setTudo(d));
    return () => {
      vivo = false;
    };
  }, []);
  const info = tudo?.areas[String(map.id)];
  const nm = (par: [string, string]) => (pt ? par[1] : par[0]);
  const lojas = info ? info.p.filter((p) => p[0] === 'shop').length : 0;
  const zona = info?.z || map.z;
  const abas: [Aba, string, number][] = [
    ['mobs', t.mapMobs, info?.m.length ?? 0],
    ['places', t.mapPlaces, (info?.p.length ?? 0) + (info?.r.length ?? 0) + (info?.e.length ?? 0)],
    ['res', t.mapResources, info?.res.length ?? 0],
  ];

  return (
    <aside
      aria-label={t.mapInfoTitle}
      className="absolute inset-x-0 bottom-0 z-20 flex h-[58%] flex-col overflow-hidden rounded-t-xl border border-[#f5c759]/30 bg-[#0e1216]/95 text-[#f3ead2] shadow-2xl backdrop-blur md:inset-y-2 md:left-auto md:right-2 md:h-auto md:w-[340px] md:rounded-xl"
    >
      <div
        className="relative h-24 shrink-0 border-b border-black/60 bg-cover bg-center [image-rendering:pixelated]"
        style={{ backgroundImage: `linear-gradient(to bottom, rgba(14,18,22,.1), rgba(14,18,22,.95)), url(/game-maps/${map.id}.webp)` }}
      >
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button onClick={onCopy} aria-label={t.mapCopyLink} title={copied ? t.mapLinkCopied : t.mapCopyLink} className="rounded-full bg-black/60 p-1.5 hover:bg-black/80">
            <Link2 className={cn('h-4 w-4', copied && 'text-[#8feba8]')} />
          </button>
          <button onClick={onClose} aria-label={t.mapClose} className="rounded-full bg-black/60 p-1.5 hover:bg-black/80">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="absolute bottom-1 left-3 right-3 text-xl font-bold leading-tight drop-shadow">{name}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border px-2 py-0.5 font-semibold" style={{ borderColor: ZONE_COLOR[zona] ?? '#bbb', color: ZONE_COLOR[zona] ?? '#bbb' }}>
            {rotuloZona(t, zona)}
          </span>
          {villageName && <span className="opacity-80">{t.mapVillage}: {villageName}</span>}
          {map.hs > 0 && <span className="opacity-80">{t.mapHousesN.replace('{n}', String(map.hs))}</span>}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          {[[info?.m.length ?? 0, t.mapMobs], [lojas, t.mapStatShops], [info?.res.length ?? 0, t.mapResources]].map(([n, l]) => (
            <div key={String(l)} className="rounded-lg bg-white/5 px-1 py-2">
              <div className="text-lg font-bold">{n}</div>
              <div className="text-[11px] opacity-70">{l}</div>
            </div>
          ))}
        </div>
        {map.lv && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="shrink-0 font-semibold">{t.mapLevelRange.replace('{lv}', levelText(map.lv))}</span>
            <div className="relative h-1.5 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${levelColor(0, 0.9)}, ${levelColor(40, 0.9)}, ${levelColor(TOP_LEVEL, 0.9)})` }}>
              <span
                className="absolute top-[-2px] h-2.5 rounded-full border border-white"
                style={{ left: `${(map.lv[0] / TOP_LEVEL) * 100}%`, width: `${Math.max(3, ((map.lv[1] - map.lv[0]) / TOP_LEVEL) * 100)}%`, background: levelColor((map.lv[0] + map.lv[1]) / 2, 1) }}
              />
            </div>
          </div>
        )}
        {mark && (
          <section className="mt-3 rounded-lg border p-2 text-sm" style={{ borderColor: `${KINDS[mark.k].color}88` }}>
            <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: KINDS[mark.k].color }}>
              {mark.t ? (pt ? mark.t[1] : mark.t[0]) : (t[KINDS[mark.k].label] as string)}
            </h4>
            <ul className="mt-1 space-y-0.5">
              {mark.e.map((e, i) => (
                <li key={i}>
                  {pt ? e[2] : e[1]}
                  {e[3] ? <span className="opacity-70"> · {t.mapLevelRange.replace('{lv}', String(e[3]))}</span> : null}
                </li>
              ))}
            </ul>
            {mark.to > 0 && canGo(mark.to) && (
              <button onClick={() => onGo(mark.to)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#ff8c61] hover:underline">
                {t.mapGoTo} <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </section>
        )}
        <button onClick={onImage} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#f5c759]/50 bg-[#f5c759]/10 px-3 py-2 text-sm font-semibold text-[#f5c759] hover:bg-[#f5c759]/20">
          <ImageIcon className="h-4 w-4" /> {t.mapViewImage}
        </button>
        <div role="tablist" className="mt-3 flex border-b border-white/10 text-sm">
          {abas.map(([id, label, n]) => (
            <button
              key={id}
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={cn('flex-1 border-b-2 px-1 py-1.5 font-semibold', aba === id ? 'border-[#f5c759] text-[#f5c759]' : 'border-transparent opacity-70 hover:opacity-100')}
            >
              {label} ({n})
            </button>
          ))}
        </div>
        {!tudo && <p className="mt-3 text-sm opacity-70">{t.mapInfoLoading}</p>}
        {tudo && !info && <p className="mt-3 text-sm opacity-70">{t.mapNoResult}</p>}
        {info && aba === 'mobs' && (
          <ul className="mt-2 space-y-1 text-sm">
            {info.m.map((m, i) => (
              <li key={i} className="flex justify-between gap-2 rounded bg-white/5 px-2 py-1">
                <span>{pt ? m[1] : m[0]}</span>
                <span className="shrink-0 font-semibold" style={{ color: levelColor(m[2], 1) }}>{t.mapLevelRange.replace('{lv}', String(m[2]))}</span>
              </li>
            ))}
            {info.n.length > 0 && <li className="pt-2 text-xs font-bold uppercase tracking-wide opacity-70">{t.mapNpcs} ({info.n.length})</li>}
            {info.n.map((n, i) => <li key={`n${i}`} className="px-2">{nm(n)}</li>)}
          </ul>
        )}
        {info && aba === 'places' && (
          <ul className="mt-2 space-y-1 text-sm">
            {info.p.map((p, i) => (
              <li key={i} className="flex justify-between gap-2 rounded bg-white/5 px-2 py-1">
                <span>{pt ? p[2] : p[1]}</span>
                <span className="shrink-0" style={{ color: KINDS[p[0]]?.color }}>{KINDS[p[0]] ? (t[KINDS[p[0]].label] as string) : p[0]}</span>
              </li>
            ))}
            {info.r.length > 0 && <li className="pt-2 text-xs font-bold uppercase tracking-wide opacity-70">{t.mapRooms} ({info.r.length})</li>}
            {info.r.map((r, i) => <li key={`r${i}`} className="px-2">{pt ? r[1] : r[0]}</li>)}
            {info.e.length > 0 && <li className="pt-2 text-xs font-bold uppercase tracking-wide opacity-70">{t.mapExits} ({info.e.length})</li>}
            {info.e.map(([to, dir], i) => {
              const alvo = tudo?.names[String(to)];
              if (!alvo) return null;
              return (
                <li key={`e${i}`} className="px-2">
                  {canGo(to) ? (
                    <button onClick={() => onGo(to)} className="inline-flex items-center gap-1 text-left text-[#ff8c61] hover:underline">
                      {nm(alvo)} <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : (
                    nm(alvo)
                  )}
                  <span className="opacity-70"> · {rotuloDirecao(t, dir)}</span>
                </li>
              );
            })}
          </ul>
        )}
        {info && aba === 'res' && (
          <ul className="mt-2 space-y-1 text-sm">
            {info.res.map((r, i) => (
              <li key={i} className="flex justify-between gap-2 rounded bg-white/5 px-2 py-1">
                <span>{pt ? r[1] : r[0]}</span>
                <span className="shrink-0 opacity-70">{r[2]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
