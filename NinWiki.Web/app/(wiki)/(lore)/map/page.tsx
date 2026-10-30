'use client';

/**
 * Summary: mapas do jogo, com as imagens do proprio cliente.
 *
 * Duas abas: o mapa-mundi (canvas no estilo do Nin Atlas: `components/map/world-atlas.tsx`) e o atlas de areas (a imagem pronta de cada mapa,
 * com busca, zoom e pinos por cima). As imagens e os dados (`maps.json`, `world.json`, `world-atlas.json`, `area-pins.json`, `areas-info.json`)
 * sao gerados por `NinWiki.Api/scripts/extrair_mapas_do_jogo.py` e ficam em `public/game-maps`.
 */

import { useMemo, useState } from 'react';
import { MapPin, Minus, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/components/providers/language-provider';
import { AreaPins } from '@/components/map/area-pins';
import { WorldAtlas } from '@/components/map/world-atlas';
import type { LoreDict } from '@/components/map/atlas-data';
import { cn } from '@/lib/utils';
import areas from '@/public/game-maps/maps.json';

type Area = (typeof areas)[number];

const ZOOMS = [1, 2, 3, 4];
/** Areas que o jogo desenhou como mapa em PERGAMINHO (arquivo `scroll-<id>.webp`): Sand Village e Mist Village. */
const PERGAMINHOS = new Set([51, 100]);
/** Cores do jogo: papel do pergaminho e o azul/laranja do rolo (botoes de modo do dialogo). */
const BOTAO_PAPEL = 'border-[#c9a463] bg-[#f8eed6] hover:bg-[#fff6e0]';

const areaPorId = new Map(areas.map((a) => [a.id, a]));

/** Conteudo do dialogo de uma area: imagem (pergaminho do jogo ou render, com zoom) e, no render, pinos clicaveis por cima. Remontado a cada area (key). */
function AreaConteudo({ area, t, pt, onGo }: { area: Area; t: LoreDict; pt: boolean; onGo: (id: number) => void }) {
  const temPergaminho = PERGAMINHOS.has(area.id);
  const [modo, setModo] = useState<'scroll' | 'render'>(temPergaminho ? 'scroll' : 'render');
  const [zoom, setZoom] = useState(2);
  const nome = pt ? area.namePt : area.name;
  return (
    <>
      <DialogTitle>{nome}</DialogTitle>
      <DialogDescription className="sr-only">{nome}</DialogDescription>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {temPergaminho && (
            <div role="group" className="flex overflow-hidden rounded-md border border-[#c9a463]">
              {(['scroll', 'render'] as const).map((m) => (
                <button key={m} aria-pressed={modo === m} onClick={() => setModo(m)} className={cn('px-3 py-1 text-sm', modo === m ? 'bg-[#2f6f86] text-white' : cn(BOTAO_PAPEL, 'text-[#3b2a14]'))}>
                  {m === 'scroll' ? t.mapScroll : t.mapRender}
                </button>
              ))}
            </div>
          )}
          {modo === 'render' && (
            <>
              <button onClick={() => setZoom((z) => Math.max(ZOOMS[0], z - 1))} disabled={zoom === ZOOMS[0]} aria-label={t.mapZoomOut} className="rounded-md border border-border p-1.5 disabled:opacity-40">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-sm tabular-nums">{zoom}x</span>
              <button onClick={() => setZoom((z) => Math.min(ZOOMS[ZOOMS.length - 1], z + 1))} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label={t.mapZoomIn} className="rounded-md border border-border p-1.5 disabled:opacity-40">
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <div className="max-h-[70vh] overflow-auto rounded-md bg-muted/40">
          {modo === 'scroll' ? (
            // eslint-disable-next-line @next/next/no-img-element -- pergaminho estatico extraido do cliente do jogo
            <img src={`/game-maps/scroll-${area.id}.webp`} alt={nome} width={544} height={544} className="mx-auto h-auto max-w-full" />
          ) : (
            <AreaPins
              id={area.id}
              width={area.width}
              height={area.height}
              zoom={zoom}
              alt={nome}
              t={t}
              pt={pt}
              nomeDaArea={(id) => { const a = areaPorId.get(id); return a ? (pt ? a.namePt : a.name) : `#${id}`; }}
              podeIr={(id) => areaPorId.has(id)}
              onGo={onGo}
            />
          )}
        </div>
      </div>
    </>
  );
}

/** Pagina do mapa: mundo + atlas de areas. */
export default function MapPage() {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const [tab, setTab] = useState<'world' | 'areas'>('world');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<Area | null>(null);

  const nomeDe = (a: Area) => (locale === 'pt' ? a.namePt : a.name);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? areas.filter((a) => a.name.toLowerCase().includes(q) || a.namePt.toLowerCase().includes(q)) : areas;
  }, [busca]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.mapTitle}
        subtitle={t.mapSubtitle}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: t.mapCrumb }]}
        icon={<MapPin className="h-7 w-7" />}
      />

      <div role="tablist" className="mb-4 flex gap-2">
        {(['world', 'areas'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-md border px-4 py-2 text-sm font-semibold transition-colors',
              tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted',
            )}
          >
            {id === 'world' ? t.mapWorld : `${t.mapAreas} (${areas.length})`}
          </button>
        ))}
      </div>

      {tab === 'world' ? (
        <WorldAtlas onOpenArea={(id) => { const a = areaPorId.get(id); if (a) setAberta(a); }} />
      ) : (
        <>
          <label className="relative mb-4 block max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t.mapSearch}
              aria-label={t.mapSearch}
              className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <p className="mb-3 text-sm text-muted-foreground">{t.mapCount.replace('{n}', String(filtradas.length))}</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtradas.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setAberta(a)}
                  className="dossier-panel group w-full overflow-hidden text-left transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted/40 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatura estatica carregada sob demanda */}
                    <img
                      src={`/game-maps/${a.id}.webp`}
                      alt=""
                      loading="lazy"
                      width={a.width}
                      height={a.height}
                      className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                    />
                  </div>
                  <p className="truncate px-2 py-1.5 text-sm font-semibold">{nomeDe(a)}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 text-xs text-muted-foreground">{t.mapSource}</p>

      <Dialog open={aberta !== null} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl">
          {aberta && <AreaConteudo key={aberta.id} area={aberta} t={t} pt={locale === 'pt'} onGo={(id) => { const a = areaPorId.get(id); if (a) setAberta(a); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
