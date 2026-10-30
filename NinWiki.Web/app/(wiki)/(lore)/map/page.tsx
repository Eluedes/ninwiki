'use client';

/**
 * Summary: mapas do jogo, com as imagens do proprio cliente.
 *
 * O mapa-mundi (canvas no estilo do Nin Atlas: `components/map/world-atlas.tsx`); a imagem pronta de cada area (com zoom e pinos por cima) abre num dialogo. As imagens e os dados (`maps.json`, `world.json`, `world-atlas.json`, `area-pins.json`, `areas-info.json`)
 * sao gerados por `NinWiki.Api/scripts/extrair_mapas_do_jogo.py` e ficam em `public/game-maps`.
 */

import { useState } from 'react';
import { MapPin, Minus, Plus } from 'lucide-react';
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

/** Pagina do mapa: so' o mapa-mundi; as areas abrem pelo mapa, pela busca e pelo painel (hash `#map/<id>` no world-atlas). */
export default function MapPage() {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const [aberta, setAberta] = useState<Area | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.mapTitle}
        subtitle={t.mapSubtitle}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: t.mapCrumb }]}
        icon={<MapPin className="h-7 w-7" />}
      />

      <WorldAtlas onOpenArea={(id) => { const a = areaPorId.get(id); if (a) setAberta(a); }} />

      <p className="mt-6 text-xs text-muted-foreground">{t.mapSource}</p>

      <Dialog open={aberta !== null} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl">
          {aberta && <AreaConteudo key={aberta.id} area={aberta} t={t} pt={locale === 'pt'} onGo={(id) => { const a = areaPorId.get(id); if (a) setAberta(a); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
