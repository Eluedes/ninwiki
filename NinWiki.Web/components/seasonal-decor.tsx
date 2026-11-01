'use client';

// Enfeites das epocas festivas (Natal, Ano Novo, Valentine's Day, Pascoa, Halloween) do site PUBLICO. Nao tem nada a ver com as cores do site.
// O tema ativo vem da API (GET /seasonal-theme; so' o S.Adm troca). Mostra: (1) o fundo animado da epoca (components/seasonal-background.tsx; nada cai nem sobe
// na tela) e (2) uma saudacao pequena no rodape que some sozinha e nao volta na mesma sessao. O atributo data-season no <html> fica disponivel para o CSS.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { getSeasonalTheme, type SeasonalTheme } from '@/lib/api-client';
import { SeasonalBackground } from '@/components/seasonal-background';

type Season = Exclude<SeasonalTheme, 'none'>;

/** Emoji da saudacao de cada epoca. */
const EMOJI: Record<Season, string> = { christmas: '🎄', newyear: '🎆', valentine: '💖', easter: '🐣', halloween: '🎃' };

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
        <span>{EMOJI[season]} {text[season]}</span>
        <button type="button" onClick={dismiss} aria-label={s.dismiss} className="rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Tema festivo do site: le o tema da API, marca data-season no <html> e mostra os enfeites. Sem tema (ou API fora) = nao mostra nada. */
export function SeasonalDecor() {
  // null = ainda perguntando a API (nao desenha nada, para o fundo padrao nao piscar antes do fundo da epoca)
  const [season, setSeason] = useState<SeasonalTheme | null>(null);

  useEffect(() => {
    let alive = true;
    getSeasonalTheme().then((s) => { if (alive) setSeason(s.theme); }).catch(() => { if (alive) setSeason('none'); });   // API fora: fundo padrao
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!season || season === 'none') delete root.dataset.season;
    else root.dataset.season = season;
    return () => { delete root.dataset.season; };
  }, [season]);

  if (!season) return null;
  return (
    <>
      <SeasonalBackground season={season} />
      {season !== 'none' && <Greeting season={season} />}
    </>
  );
}
