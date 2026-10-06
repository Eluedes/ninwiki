// Pagina de detalhe de uma Vila (rota /village/[id]): descricao, ficha
// da vila, e as secoes de Clas e Organizacoes que pertencem a ela.
// Server Component assincrono, busca da API real; o visual fica em
// components/lore/village-page-client.tsx (precisa saber o idioma).

import { getVillage, listVillages, ApiError } from '@/lib/api-client';
import { VillagePageClient } from '@/components/lore/village-page-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Titulo da aba: o nome da vila. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: (await getVillage(id)).name };
  } catch {
    return { title: 'Villages' };
  }
}


/** Pagina publica de uma vila (Server Component: busca na API). */
export default async function VillagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let village;
  try {
    village = await getVillage(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  // "Outras vilas" na sidebar - busca a lista inteira so' pra montar
  // esses links, ja' que sao poucas (3 hoje, no maximo umas 5-6 no
  // jogo real) - nao compensa criar um endpoint so' pra isso.
  const allVillages = await listVillages();

  return <VillagePageClient village={village} allVillages={allVillages} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
