// Pagina de detalhe de um Jutsu (rota /jutsus/[id]) - Server Component
// assincrono, so' busca da API real e repassa pro Client Component
// (JutsuPageClient) que faz a renderizacao de verdade, consciente de
// idioma (mesmo padrao de app/(wiki)/(lore)/masteries/[id]/page.tsx -
// useLanguage e' um hook de React, nao funciona aqui).

import { getJutsu, getMastery, ApiError } from '@/lib/api-client';
import { UTILITY_MASTERY } from '@/lib/utility-category';
import { JutsuPageClient } from '@/components/lore/jutsu-page-client';
import type { Metadata } from 'next';
import { shareMetadata } from '@/lib/share-meta';
import { notFound } from 'next/navigation';

/** Titulo da aba: o nome do jutsu (em ingles, o idioma principal do site). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const jutsu = await getJutsu(id);
    return shareMetadata({ title: jutsu.name, html: jutsu.description, path: `/jutsus/${jutsu.id}` });
  } catch {
    return { title: 'Jutsu' };
  }
}


/** Pagina publica de um jutsu (Server Component: busca na API). */
export default async function JutsuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let jutsu;
  try {
    jutsu = await getJutsu(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  // mastery e' opcional aqui de proposito (mesmo motivo de antes: se
  // por algum motivo a mastery do jutsu nao carregar, a pagina ainda
  // mostra o jutsu em si, so' sem a cor de destaque/link da mastery).
  // sem mastery = categoria Utility (usa a mastery "virtual" de lib/utility-category.ts para mostrar a cor e o link)
  const mastery = jutsu.masteryId ? await getMastery(jutsu.masteryId).catch(() => undefined) : UTILITY_MASTERY;

  return <JutsuPageClient jutsu={jutsu} mastery={mastery} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
