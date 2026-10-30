'use client';

/**
 * Summary: nome do mapa ligado ao wiki: miniatura (imagem da entrada) + link para /detail/<slug> quando ha correspondencia publicada;
 * sem correspondencia, so' o texto. Tambem carrega o indice do wiki sob demanda (`useIndiceWiki`).
 */

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { ApiContentItemSummary } from '@/lib/api-client';
import { carregarIndiceWiki, type WikiIndice } from './wiki-index';

/** Indice do wiki (null enquanto carrega). Cache em memoria no modulo; o estado so' entra dentro do .then. */
export function useIndiceWiki() {
  const [ind, setInd] = useState<WikiIndice | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarIndiceWiki().then((i) => vivo && setInd(i));
    return () => {
      vivo = false;
    };
  }, []);
  return ind;
}

/** Miniatura quadrada da entrada (some se nao houver imagem). */
export function Miniatura({ entry, tam = 20 }: { entry?: ApiContentItemSummary; tam?: number }) {
  if (!entry?.image) return null;
  // eslint-disable-next-line @next/next/no-img-element -- miniatura pequena vinda da API do wiki
  return <img src={entry.image} alt="" loading="lazy" width={tam} height={tam} style={{ width: tam, height: tam }} className="shrink-0 rounded object-contain" />;
}

/** Nome (com miniatura) linkado ao wiki, ou texto puro. */
export function NomeWiki({ entry, children }: { entry?: ApiContentItemSummary; children: ReactNode }) {
  if (!entry) return <span>{children}</span>;
  return (
    <Link href={`/detail/${entry.slug}`} className="inline-flex min-w-0 items-center gap-1.5 text-[#ff8c61] hover:underline">
      <Miniatura entry={entry} />
      <span className="truncate">{children}</span>
    </Link>
  );
}
