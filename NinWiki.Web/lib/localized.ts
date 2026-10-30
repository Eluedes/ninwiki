// Nome de uma entidade no idioma escolhido - a MESMA regra usada em Conteudo,
// Mastery e Jutsu: `name` e' o ingles (principal) e `namePt` a traducao; em
// portugues, se ainda nao houver traducao, cai pro ingles (nunca fica vazio).
import type { Locale } from '@/lib/types';

/** Nome no idioma atual: usa o campo em portugues quando existe, senao o ingles. */
export function localizedName(locale: Locale, name: string, namePt: string | null | undefined): string {
  return locale === 'pt' ? (namePt || name) : name;
}

// O "outro" idioma, pra usar de subtitulo (ex: "Leaf Village" com "Vila da Folha"
// embaixo). Devolve null quando nao ha traducao ou quando ela e' igual ao nome.
export function alternateName(locale: Locale, name: string, namePt: string | null | undefined): string | null {
  if (locale !== 'pt') return null;   // em ingles nunca mostra o nome em portugues como subtitulo
  const other = name;
  const main = localizedName(locale, name, namePt);
  return other && other !== main ? other : null;
}

/** Texto no idioma atual: em portugues usa a traducao quando existe e senao o ingles (nunca fica vazio). */
export function localizedText(locale: Locale, text: string, textPt: string | null | undefined): string {
  return locale === 'pt' ? (textPt || text) : text;
}

// Elementos em portugues (o campo `element` das vilas guarda o nome em ingles). Desconhecido -> o proprio valor.
const ELEMENTS_PT: Record<string, string> = {
  Fire: 'Fogo', Water: 'Água', Wind: 'Vento', Earth: 'Terra', Lightning: 'Raio',
};

/** Nome do elemento no idioma atual. */
export function elementLabel(locale: Locale, element: string): string {
  return locale === 'pt' ? (ELEMENTS_PT[element] ?? element) : element;
}
