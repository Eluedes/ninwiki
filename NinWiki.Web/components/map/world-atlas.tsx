'use client';

/**
 * Summary: aba "Mundo" do mapa: o mapa-mundi do jogo em canvas, no estilo do mapa do Nin Atlas.
 *
 * O desenho (fundo, areas, rotulos, marcadores, rotas) fica em `atlas-engine.ts`; aqui ficam so' a interface em volta: busca global,
 * legenda que filtra tipos de marcador, botao de niveis dos mobs, zoom, tela cheia, dica ao passar o mouse, painel da area e o link
 * compartilhavel (`#map/<id da area>`). As imagens sao as do cliente do jogo (ver `NinWiki.Api/scripts/extrair_mapas_do_jogo.py`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expand, Flame, Layers, Minus, Plus, Search, Shrink, Target, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/language-provider';
import areas from '@/public/game-maps/maps.json';
import world from '@/public/game-maps/world.json';
import { AreaPanel, carregarInfo, type InfoTudo } from './area-panel';
import { PANEL_WIDTH, createEngine, type Engine, type Pick, type Tip } from './atlas-engine';
import { KEY_HIDDEN, KINDS, KIND_LIST, carregarAtlas, type AtlasData, type Mark } from './atlas-data';

const nomePorId = new Map(areas.map((a) => [a.id, [a.name, a.namePt] as [string, string]]));
/** Nome da area (EN, PT); areas sem nome no cliente viram "Map <id>". */
const nomeDe = (id: number): [string, string] => nomePorId.get(id) ?? [`Map ${id}`, `Mapa ${id}`];
const BOTAO = 'flex h-10 w-10 items-center justify-center rounded-lg border border-[#f5c759]/40 bg-[#0e1216]/90 text-[#f5c759] shadow hover:bg-[#1b232b]';

type Resultado = { key: string; label: string; sub: string; mapId: number; mark: Mark | null };

export function WorldAtlas({ onOpenArea }: { onOpenArea: (id: number) => void }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const pt = locale === 'pt';
  const [data, setData] = useState<AtlasData | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [selMark, setSelMark] = useState<Mark | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [levels, setLevels] = useState(false);
  const [legend, setLegend] = useState(false);
  const [cheia, setCheia] = useState(false);
  const [busca, setBusca] = useState('');
  const [info, setInfo] = useState<InfoTudo | null>(null);
  const [copiado, setCopiado] = useState(false);
  const caixa = useRef<HTMLDivElement | null>(null);
  const tela = useRef<HTMLCanvasElement | null>(null);
  const dica = useRef<HTMLDivElement | null>(null);
  const eng = useRef<Engine | null>(null);
  const hashInicial = useRef<number | null>(null);
  const escolherRef = useRef<(id: number | null, mark: Mark | null, voar: boolean) => void>(() => {});

  /** Carrega os dados do mundo (e a hash inicial) sob demanda; os dados so' entram no estado dentro do .then. */
  useEffect(() => {
    let vivo = true;
    carregarAtlas().then((d) => {
      if (!vivo) return;
      const m = /^#map\/(\d+)$/.exec(window.location.hash);
      hashInicial.current = m ? Number(m[1]) : null;
      setData(d);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Esc sai da tela cheia (so' escuta enquanto ela esta' ligada). */
  useEffect(() => {
    if (!cheia) return;
    const sair = (e: KeyboardEvent) => e.key === 'Escape' && setCheia(false);
    window.addEventListener('keydown', sair);
    return () => window.removeEventListener('keydown', sair);
  }, [cheia]);

  /** Cria o motor do canvas quando os dados chegam; acompanha o tamanho da caixa (tela cheia, celular girando...). */
  useEffect(() => {
    if (!data || !tela.current || !caixa.current) return;
    const canvas = tela.current, box = caixa.current;
    const e = createEngine(canvas, data, world, {
      nameOf: nomeDe,
      onPick: (p: Pick) => escolherRef.current(p ? p.mapId : null, p ? p.mark : null, true),
      onTip: (tip: Tip) => {
        const el = dica.current;
        if (!el) return;
        if (!tip) {
          el.hidden = true;
          return;
        }
        el.replaceChildren();
        const h = document.createElement('div');
        h.textContent = tip.title;
        h.className = 'font-bold';
        if (tip.color) h.style.color = tip.color;
        el.append(h);
        for (const l of tip.lines) {
          const d = document.createElement('div');
          d.textContent = l;
          d.className = 'text-xs opacity-80';
          el.append(d);
        }
        el.hidden = false;
        const w = box.clientWidth;
        el.style.left = `${Math.min(tip.x + 14, w - el.offsetWidth - 6)}px`;
        el.style.top = `${tip.y + 14}px`;
      },
    });
    eng.current = e;
    const medir = () => e.resize(box.clientWidth, box.clientHeight, window.devicePixelRatio || 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(box);
    e.setText(t, pt);
    const id = hashInicial.current;
    // o setState so' acontece no proximo quadro (fora do corpo do efeito)
    if (id != null) requestAnimationFrame(() => escolherRef.current(id, null, true));
    return () => {
      ro.disconnect();
      e.destroy();
      eng.current = null;
    };
    // O motor so' e' recriado quando os dados chegam; idioma e filtros chegam por efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    eng.current?.setText(t, pt);
  }, [t, pt, data]);

  /** Seleciona uma area (e marcador): atualiza painel, canvas, hash do link e, se pedido, voa ate' ela. */
  const escolher = useCallback(
    (id: number | null, mark: Mark | null, voar: boolean) => {
      const e = eng.current;
      if (!e || !data) return;
      const m = id == null ? null : data.byId.get(id);
      const aberto = Boolean(m);
      const celular = (caixa.current?.clientWidth ?? 1000) < 768;
      e.setInset(aberto && !celular ? PANEL_WIDTH + 16 : 0, aberto && celular ? (caixa.current?.clientHeight ?? 0) * 0.58 : 0);
      setSelId(m ? m.id : null);
      setSelMark(m ? mark : null);
      setCopiado(false);
      e.select(m ? m.id : null, m ? mark : null);
      try {
        window.history.replaceState(null, '', m ? `#map/${m.id}` : window.location.pathname + window.location.search);
      } catch {
        /* sem historico (iframe/privado): o link so' nao muda */
      }
      if (m && voar) e.flyToMap(m);
    },
    [data],
  );
  useEffect(() => {
    escolherRef.current = escolher;
  }, [escolher]);

  /** Liga/desliga um tipo de marcador pela legenda. */
  const alternar = (k: string) => {
    const novo = new Set(hidden);
    if (!novo.delete(k)) novo.add(k);
    setHidden(novo);
    eng.current?.setHidden(novo);
  };
  const limparFiltro = () => {
    setHidden(new Set());
    eng.current?.setHidden(new Set());
  };

  // ---- busca: areas e marcadores desde o inicio; mobs e recursos quando o indice das areas carrega (no primeiro foco da busca)
  const candidatos = useMemo<Resultado[]>(() => {
    if (!data) return [];
    const lista: Resultado[] = data.maps.map((m) => ({ key: `a${m.id}`, label: nomeDe(m.id)[pt ? 1 : 0], sub: t.mapArea, mapId: m.id, mark: null }));
    data.marks.forEach((g, i) => {
      const nomes = new Set(g.e.map((x) => (pt ? x[2] : x[1])));
      for (const n of nomes) lista.push({ key: `m${i}${n}`, label: n, sub: t[KINDS[g.k].label] as string, mapId: g.m, mark: g });
      if (g.t) lista.push({ key: `t${i}`, label: pt ? g.t[1] : g.t[0], sub: t.mapRooms, mapId: g.m, mark: g });
    });
    if (info) {
      const visto = new Set<string>();
      for (const [id, a] of Object.entries(info.areas)) {
        if (!data.byId.has(Number(id))) continue;
        for (const m of a.m) {
          const n = pt ? m[1] : m[0];
          if (!visto.has(`m${n}`)) {
            visto.add(`m${n}`);
            lista.push({ key: `mob${id}${n}`, label: n, sub: `${t.mapMobs} · ${t.mapLevelRange.replace('{lv}', String(m[2]))}`, mapId: Number(id), mark: null });
          }
        }
        for (const r of a.res) {
          const n = pt ? r[1] : r[0];
          if (!visto.has(`r${n}`)) {
            visto.add(`r${n}`);
            lista.push({ key: `res${id}${n}`, label: n, sub: t.mapResources, mapId: Number(id), mark: null });
          }
        }
      }
    }
    return lista;
  }, [data, info, pt, t]);
  const q = busca.trim().toLowerCase();
  const resultados = useMemo(() => (q ? candidatos.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 8) : []), [candidatos, q]);

  const copiar = () => {
    navigator.clipboard
      ?.writeText(`${window.location.origin}${window.location.pathname}#map/${selId}`)
      .then(() => setCopiado(true))
      .catch(() => undefined);
  };

  const mapa = selId != null ? data?.byId.get(selId) : null;
  const vila = mapa ? world.villages.find((v) => v.id === mapa.v) : undefined;
  const aberto = Boolean(mapa);

  return (
    <div className={cn('overflow-hidden rounded-lg border border-black/60 bg-[#0b1317]', cheia && 'fixed inset-0 z-50 rounded-none')}>
      <div ref={caixa} className={cn('relative w-full select-none', cheia ? 'h-screen' : 'h-[75vh] min-h-[420px]')}>
        {/* o canvas nao e' role=img: assim o clique chega normalmente; o nome vem do aria-label */}
        <canvas ref={tela} tabIndex={0} aria-label={t.mapAria} className="absolute inset-0 h-full w-full cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-[#f5c759]/60" />
        {!data && <p className="absolute inset-0 flex items-center justify-center text-sm text-[#f3ead2]">{t.mapInfoLoading}</p>}

        {/* barra de cima: busca + niveis */}
        <div className="absolute left-2 top-2 z-30 flex w-[calc(100%-1rem)] max-w-md items-start gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f3ead2]/60" />
            <input
              value={busca}
              onChange={(ev) => setBusca(ev.target.value)}
              onFocus={() => carregarInfo().then(setInfo)}
              placeholder={t.mapFind}
              aria-label={t.mapFind}
              className="h-10 w-full rounded-lg border border-white/15 bg-[#0e1216]/90 pl-9 pr-8 text-sm text-[#f3ead2] placeholder:text-[#f3ead2]/50 focus:border-[#f5c759]/60 focus:outline-none"
            />
            {busca && (
              <button onClick={() => setBusca('')} aria-label={t.mapClose} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#f3ead2]/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
            {q && (
              <ul className="absolute left-0 top-full z-40 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-white/15 bg-[#0e1216]/95 text-[#f3ead2] shadow-lg">
                {resultados.length === 0 && <li className="px-3 py-2 text-sm">{t.mapNoResult}</li>}
                {resultados.map((r) => (
                  <li key={r.key}>
                    <button
                      onClick={() => {
                        escolher(r.mapId, r.mark, true);
                        setBusca('');
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-white/10"
                    >
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 text-xs opacity-60">{r.sub}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            aria-pressed={levels}
            title={t.mapLevels}
            onClick={() => {
              setLevels(!levels);
              eng.current?.setLevels(!levels);
            }}
            className={cn('flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold shadow', levels ? 'border-[#f5c759] bg-[#f5c759] text-[#0e1216]' : 'border-white/15 bg-[#0e1216]/90 text-[#f3ead2] hover:bg-[#1b232b]')}
          >
            <Flame className="h-4 w-4" />
            <span className="hidden sm:inline">{t.mapLevels}</span>
          </button>
        </div>

        {/* legenda: cada tipo liga/desliga; passar o mouse pisca os marcadores do tipo */}
        <div className={cn('absolute bottom-3 left-3 z-30', aberto && 'max-md:bottom-[calc(58%+12px)]')}>
          {legend && (
            <div role="group" aria-label={t.mapKey} className="mb-2 max-h-[55vh] w-60 overflow-auto rounded-lg border border-white/15 bg-[#0e1216]/95 p-2 text-sm text-[#f3ead2] shadow-lg">
              <ul className="space-y-0.5">
                {KIND_LIST.filter((k) => !KEY_HIDDEN.has(k) && data?.marks.some((g) => g.k === k)).map((k) => {
                  const st = KINDS[k];
                  const n = data?.marks.filter((g) => g.k === k).length ?? 0;
                  return (
                    <li key={k}>
                      <button
                        aria-pressed={!hidden.has(k)}
                        onClick={() => alternar(k)}
                        onMouseEnter={() => eng.current?.setKeyHover(k)}
                        onMouseLeave={() => eng.current?.setKeyHover(null)}
                        className={cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/10', hidden.has(k) && 'opacity-40')}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold" style={{ borderColor: st.color, color: st.color }}>{st.glyph}</span>
                        <span className="flex-1">{t[st.label] as string}</span>
                        <span className="text-xs opacity-60">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {hidden.size > 0 && (
                <button onClick={limparFiltro} className="mt-1 w-full rounded border border-[#f5c759]/40 px-2 py-1 text-xs font-semibold text-[#f5c759] hover:bg-white/10">
                  {t.mapShowAll}
                </button>
              )}
            </div>
          )}
          <button onClick={() => setLegend(!legend)} aria-expanded={legend} title={t.mapShowMarkers} className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-[#0e1216]/90 px-3 text-sm font-semibold text-[#f3ead2] shadow hover:bg-[#1b232b]">
            <Layers className="h-4 w-4 text-[#f5c759]" /> {t.mapKey}
          </button>
        </div>

        {/* zoom, ver tudo e tela cheia (saem da frente do painel) */}
        <div className={cn('absolute z-30 flex flex-col gap-2', aberto ? 'bottom-3 right-3 max-md:bottom-[calc(58%+12px)] md:right-[364px]' : 'bottom-3 right-3')}>
          <button aria-label={t.mapZoomIn} onClick={() => eng.current?.zoomBy(1.6)} className={BOTAO}><Plus className="h-5 w-5" /></button>
          <button aria-label={t.mapZoomOut} onClick={() => eng.current?.zoomBy(1 / 1.6)} className={BOTAO}><Minus className="h-5 w-5" /></button>
          <button aria-label={t.mapFit} title={t.mapFit} onClick={() => { escolher(null, null, false); eng.current?.fit(); }} className={BOTAO}><Target className="h-5 w-5" /></button>
          <button aria-label={cheia ? t.mapExitFullscreen : t.mapFullscreen} title={cheia ? t.mapExitFullscreen : t.mapFullscreen} onClick={() => setCheia(!cheia)} className={BOTAO}>
            {cheia ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
          </button>
        </div>

        {!aberto && data && <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden w-max max-w-[60%] -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-center text-sm text-[#f3ead2] md:block">{t.mapMyHint}</p>}

        {/* dica ao passar o mouse: preenchida pelo motor, sem renderizar o React de novo */}
        <div ref={dica} hidden className="pointer-events-none absolute z-30 max-w-xs rounded border border-white/70 bg-[#0e1216]/95 px-2.5 py-1.5 text-sm text-[#f3ead2] shadow-lg" />

        {mapa && (
          <AreaPanel
            key={mapa.id}
            map={mapa}
            mark={selMark}
            t={t}
            pt={pt}
            name={nomeDe(mapa.id)[pt ? 1 : 0]}
            villageName={vila ? (pt ? vila.namePt : vila.name) : undefined}
            canGo={(id) => Boolean(data?.byId.has(id))}
            onGo={(id) => escolher(id, null, true)}
            onClose={() => escolher(null, null, false)}
            onImage={() => onOpenArea(mapa.id)}
            onCopy={copiar}
            copied={copiado}
          />
        )}
      </div>
    </div>
  );
}
