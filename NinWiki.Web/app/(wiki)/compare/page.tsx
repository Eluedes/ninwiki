// Comparador de itens/armas lado a lado (rota /compare?a=<slug>&b=<slug>). Server Component: busca as duas entries na API
// (as que nao existem/nao estao no ar viram "vazio" e o visitante escolhe outra); a parte interativa fica no CompareClient.

import type { Metadata } from 'next';
import { ApiError, getContentItemBySlug, type ApiContentItem } from '@/lib/api-client';
import { CompareClient } from '@/components/wiki/compare-client';

export const metadata: Metadata = { title: 'Compare' };
export const dynamic = 'force-dynamic';   // sempre busca da API (mesmo motivo da pagina de detalhe)

/** Busca uma entry pelo slug; qualquer falha de "nao achei" vira null (a API fora do ar continua estourando). */
async function load(slug?: string): Promise<ApiContentItem | null> {
  if (!slug) return null;
  try {
    return await getContentItemBySlug(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Pagina publica de comparacao. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const [first, second] = await Promise.all([load(a), load(b)]);
  return <CompareClient a={first} b={second} />;
}
