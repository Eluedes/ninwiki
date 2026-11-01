'use client';

// Enfeites das epocas festivas (Natal, Ano Novo, Valentine's Day, Pascoa, Halloween) do site PUBLICO. Nao tem nada a ver com as cores do site.
// O tema ativo vem da API (GET /seasonal-theme; so' o S.Adm troca). Mostra: (1) particulas leves caindo/subindo por cima da pagina (sem tocar em cliques) e
// (2) uma saudacao pequena no rodape que some sozinha e nao volta na mesma sessao. Quem pede menos movimento ao aparelho (prefers-reduced-motion) nao ve as
// particulas, so' a saudacao. O atributo data-season no <html> fica disponivel para o CSS (ex.: fundos de epoca no futuro).

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { getSeasonalTheme, type SeasonalTheme } from '@/lib/api-client';

type Season = Exclude<SeasonalTheme, 'none'>;

/** Emojis de cada epoca (as particulas sorteiam entre eles). */
const PARTICLES: Record<Season, string[]> = {
  christmas: ['❄️', '❄️', '❄️', '⛄', '🎄'],
  newyear: ['🎆', '✨', '🎉', '🥂', '✨'],
  valentine: ['💖', '💕', '🌹', '💘', '💖'],
  easter: ['🥚', '🐣', '🌷', '🐰', '🥚'],
  halloween: ['🎃', '🦇', '👻', '🎃', '🕸️'],
};
/** Valentine e Ano Novo SOBEM (coracoes e fogos); as demais caem. */
const RISING: ReadonlySet<Season> = new Set<Season>(['valentine', 'newyear']);
const COUNT = 22;   // poucas particulas: e' enfeite, nao pode pesar nem atrapalhar a leitura

/** Particulas de uma epoca: posicao, tamanho e tempo saem do indice (deterministico: nao muda entre renders). */
function Particles({ season }: { season: Season }) {
  const items = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    emoji: PARTICLES[season][(i * 7) % PARTICLES[season].length],
    left: (i * 37 + 11) % 100,
    size: 14 + ((i * 13) % 14),
    duration: 14 + ((i * 11) % 14),
    delay: -((i * 17) % 24),
    sway: ((i * 29) % 80) - 40,
  })), [season]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {items.map((p, i) => (
        <span key={i} className={`season-particle${RISING.has(season) ? ' season-rise' : ''}`}
          style={{ left: `${p.left}%`, fontSize: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`, ['--sway' as string]: `${p.sway}px` }}>{p.emoji}</span>
      ))}
    </div>
  );
}

/** Saudacao pequena no rodape da tela: aparece depois de um instante, some em 12 s e nao volta na mesma sessao. */
function Greeting({ season }: { season: Season }) {
  const { dict } = useLanguage();
  const s = dict.seasonal;
  const [visible, setVisible] = useState(false);
  const text: Record<Season, string> = {
    christmas: s.greetingChristmas, newyear: s.greetingNewyear, valentine: s.greetingValentine, easter: s.greetingEaster, halloween: s.greetingHalloween,
  };

  useEffect(() => {
    const key = `ninwiki-season-${season}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // sessionStorage indisponivel: mostra a saudacao mesmo assim
    }
    const show = setTimeout(() => setVisible(true), 700);
    const hide = setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem(key, '1'); } catch { /* sem armazenamento: so' nao lembra */ }
    }, 12700);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [season]);

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(`ninwiki-season-${season}`, '1'); } catch { /* sem armazenamento */ }
  }

  if (!visible) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-border bg-card/95 py-2 pl-4 pr-2 text-sm font-medium shadow-lg backdrop-blur">
        <span>{PARTICLES[season][0]} {text[season]}</span>
        <button type="button" onClick={dismiss} aria-label={s.dismiss} className="rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Tema festivo do site: le o tema da API, marca data-season no <html> e mostra os enfeites. Sem tema (ou API fora) = nao mostra nada. */
export function SeasonalDecor() {
  const [season, setSeason] = useState<SeasonalTheme>('none');

  useEffect(() => {
    let alive = true;
    getSeasonalTheme().then((s) => { if (alive) setSeason(s.theme); }).catch(() => { /* API fora: site normal */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (season === 'none') delete root.dataset.season;
    else root.dataset.season = season;
    return () => { delete root.dataset.season; };
  }, [season]);

  if (season === 'none') return null;
  return (
    <>
      <Particles season={season} />
      <Greeting season={season} />
    </>
  );
}
