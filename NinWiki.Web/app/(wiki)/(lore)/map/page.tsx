'use client';

/**
 * Summary: mapas do jogo, com as imagens do proprio cliente.
 *
 * Duas abas: o mapa-mundi (a arte desenhada do jogo) e o atlas de areas (a imagem pronta de cada mapa, com busca e zoom).
 * As imagens e o indice (`maps.json`) sao gerados por `NinWiki.Api/scripts/extrair_mapas_do_jogo.py` e ficam em `public/game-maps`.
 */

import { useMemo, useRef, useState } from 'react';
import { MapPin, Maximize2, Minus, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import areas from '@/public/game-maps/maps.json';
import world from '@/public/game-maps/world.json';

type Area = (typeof areas)[number];

const ZOOMS = [1, 2, 3, 4];

const areaPorId = new Map(areas.map((a) => [a.id, a]));
const ESCALA_MIN = 0.1;
const ESCALA_MAX = 8;
const BOTAO_MAPA = 'rounded-md border border-border bg-card/90 p-2 hover:bg-muted';

/**
 * Mapa-mundi do jogo: as areas coladas lado a lado (1 pixel por bloco) sobre o papel do jogo.
 * Arrastar move, a roda do mouse (ou os botoes) da' zoom em volta do cursor; clicar numa area abre a imagem detalhada dela.
 */
function WorldViewer({ label, hint, nameOf, onOpen }: { label: string; hint: string; nameOf: (id: number) => string; onOpen: (id: number) => void }) {
  const [vista, setVista] = useState({ x: 0, y: 0, s: 0.3 });
  const caixa = useRef<HTMLDivElement | null>(null);
  const arraste = useRef<{ px: number; py: number; moveu: boolean } | null>(null);
  const iniciado = useRef(false);

  /** Escala e posicao que mostram o mundo inteiro dentro da caixa. */
  const encaixar = (el: HTMLElement) => {
    const s = Math.min(el.clientWidth / world.width, el.clientHeight / world.height);
    return { s, x: (el.clientWidth - world.width * s) / 2, y: (el.clientHeight - world.height * s) / 2 };
  };
  /** Muda o zoom mantendo fixo o ponto (cx, cy) da caixa. */
  const zoomEm = (fator: number, cx: number, cy: number) =>
    setVista((v) => {
      const s = Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, v.s * fator));
      return { s, x: cx - ((cx - v.x) / v.s) * s, y: cy - ((cy - v.y) / v.s) * s };
    });
  const zoomCentro = (fator: number) => caixa.current && zoomEm(fator, caixa.current.clientWidth / 2, caixa.current.clientHeight / 2);

  return (
    <div className="dossier-panel overflow-hidden">
      <div
        ref={(el) => {
          caixa.current = el;
          if (el && !iniciado.current) {
            iniciado.current = true;
            setVista(encaixar(el));
          }
        }}
        role="img"
        aria-label={label}
        className="relative h-[70vh] cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        style={{ backgroundColor: '#d6b07d' /* cor media do papel do mapa do jogo */ }}
        onWheel={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
        }}
        onPointerDown={(e) => {
          arraste.current = { px: e.clientX, py: e.clientY, moveu: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const a = arraste.current;
          if (!a) return;
          const dx = e.clientX - a.px;
          const dy = e.clientY - a.py;
          if (Math.abs(dx) + Math.abs(dy) > 3) a.moveu = true;
          a.px = e.clientX;
          a.py = e.clientY;
          setVista((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
        }}
        onPointerUp={() => setTimeout(() => (arraste.current = null), 0)}
      >
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: world.width, height: world.height, transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- mosaico estatico gerado do cliente do jogo */}
          <img src="/game-maps/world-map.webp" alt="" draggable={false} width={world.width} height={world.height} className="max-w-none [image-rendering:pixelated]" />
          {world.maps.map((m) =>
            areaPorId.has(m.id) ? (
              <button
                key={m.id}
                title={nameOf(m.id)}
                aria-label={nameOf(m.id)}
                onClick={() => !arraste.current?.moveu && onOpen(m.id)}
                className="absolute border border-transparent hover:border-primary hover:bg-primary/20"
                style={{ left: m.x, top: m.y, width: m.w, height: m.h }}
              />
            ) : null,
          )}
        </div>
        <div className="absolute right-3 top-3 flex flex-col gap-1">
          <button onClick={() => zoomCentro(1.4)} onPointerDown={(e) => e.stopPropagation()} className={BOTAO_MAPA}>
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={() => zoomCentro(1 / 1.4)} onPointerDown={(e) => e.stopPropagation()} className={BOTAO_MAPA}>
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => caixa.current && setVista(encaixar(caixa.current))} onPointerDown={(e) => e.stopPropagation()} className={BOTAO_MAPA}>
            <Maximize2 className="h-4 w-4" />
          </button>

        </div>
      </div>
      <p className="px-3 py-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

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
        <WorldViewer label={t.mapAria} hint={t.mapHint} nameOf={(id) => { const a = areaPorId.get(id); return a ? nomeDe(a) : ''; }} onOpen={(id) => { const a = areaPorId.get(id); if (a) setAberta(a); }} />
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
