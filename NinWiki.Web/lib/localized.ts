// Nome de uma entidade no idioma escolhido - a MESMA regra usada em Conteudo,
// Mastery e Jutsu: `name` e' o ingles (principal) e `namePt` a traducao; em
// portugues, se ainda nao houver traducao, cai pro ingles (nunca fica vazio).
import type { Locale } from '@/lib/types';

export function localizedName(locale: Locale, name: string, namePt: string | null | undefined): string {
  return locale === 'pt' ? (namePt || name) : name;
}

// O "outro" idioma, pra usar de subtitulo (ex: "Leaf Village" com "Vila da Folha"
// embaixo). Devolve null quando nao ha traducao ou quando ela e' igual ao nome.
export function alternateName(locale: Locale, name: string, namePt: string | null | undefined): string | null {
  const other = locale === 'pt' ? name : namePt;
  const main = localizedName(locale, name, namePt);
  return other && other !== main ? other : null;
}
