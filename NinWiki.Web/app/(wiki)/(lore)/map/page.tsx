'use client';

/**
 * Summary: mapas do jogo, com as imagens do proprio cliente.
 *
 * Duas abas: o mapa-mundi (a arte desenhada do jogo) e o atlas de areas (a imagem pronta de cada mapa, com busca e zoom).
 * As imagens e o indice (`maps.json`) sao gerados por `NinWiki.Api/scripts/extrair_mapas_do_jogo.py` e ficam em `public/game-maps`.
 */

import { useMemo, useState } from 'react';
import { MapPin, Minus, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import areas from '@/public/game-maps/maps.json';

type Area = (typeof areas)[number];

const ZOOMS = [1, 2, 3, 4];

/** Pagina do mapa: mundo + atlas de areas. */
export default function MapPage() {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const [tab, setTab] = useState<'world' | 'areas'>('world');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<Area | null>(null);
  const [zoom, setZoom] = useState(2);

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
        <div className="dossier-panel overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- arte estatica do jogo, ja otimizada (webp) */}
          <img src="/game-maps/world.webp" alt={t.mapAria} width={1314} height={826} className="h-auto w-full" />
        </div>
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
          <DialogTitle>{aberta ? nomeDe(aberta) : ''}</DialogTitle>
          <DialogDescription className="sr-only">{aberta ? nomeDe(aberta) : ''}</DialogDescription>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(ZOOMS[0], z - 1))}
              disabled={zoom === ZOOMS[0]}
              aria-label={t.mapZoomOut}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-sm tabular-nums">{zoom}x</span>
            <button
              onClick={() => setZoom((z) => Math.min(ZOOMS[ZOOMS.length - 1], z + 1))}
              disabled={zoom === ZOOMS[ZOOMS.length - 1]}
              aria-label={t.mapZoomIn}
              className="rounded-md border border-border p-1.5 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-auto rounded-md bg-muted/40">
            {aberta && (
              // eslint-disable-next-line @next/next/no-img-element -- imagem estatica do jogo; o zoom e' so' a largura em pixels inteiros
              <img
                src={`/game-maps/${aberta.id}.webp`}
                alt={nomeDe(aberta)}
                width={aberta.width * zoom}
                height={aberta.height * zoom}
                style={{ width: aberta.width * zoom, maxWidth: 'none' }}
                className="mx-auto [image-rendering:pixelated]"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
