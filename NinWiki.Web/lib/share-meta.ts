// Metadata de COMPARTILHAMENTO (Open Graph / Twitter) das paginas publicas: e' o que o Discord, o WhatsApp e o Google leem para
// montar o cartao do link (titulo, resumo e imagem). A imagem e' a da propria pagina quando existe; senao a imagem padrao do Nin Codex (1200x630).
// Enderecos relativos viram absolutos pelo `metadataBase` do layout raiz (NEXT_PUBLIC_SITE_URL).

import type { Metadata } from 'next';
import { extractPlainText } from '@/components/lore/rich-text';

const FALLBACK_IMAGE = '/images/logo/og-nin-codex.png';

/** Monta title/description/openGraph/twitter para uma pagina. `html` e' o texto rico (descricao) de onde sai o resumo. */
export function shareMetadata(opts: { title: string; html?: string | null; path: string; image?: string | null }): Metadata {
  // O campo pode ser JSON do Tiptap ou HTML: extractPlainText resolve o JSON; o resto tira as tags e decodifica as entidades comuns.
  const plain = opts.html
    ? extractPlainText(opts.html).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    : '';
  const description = plain.replace(/\s+/g, ' ').trim().slice(0, 200) || undefined;
  const image = opts.image || FALLBACK_IMAGE;
  return {
    title: opts.title,
    description,
    alternates: { canonical: opts.path },
    openGraph: { type: 'website', title: opts.title, description, url: opts.path, siteName: 'Nin Codex', images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title: opts.title, description, images: [image] },
  };
}
