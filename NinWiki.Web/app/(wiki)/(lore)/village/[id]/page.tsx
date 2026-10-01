// Pagina de detalhe de uma Vila (rota /village/[id]): descricao, ficha
// da vila, e as secoes de Clas e Organizacoes que pertencem a ela.
// Server Component assincrono, busca da API real; o visual fica em
// components/lore/village-page-client.tsx (precisa saber o idioma).

import { getVillage, listVillages, ApiError } from '@/lib/api-client';
import { LoreNotFound } from '@/components/lore/lore-not-found';
import { VillagePageClient } from '@/components/lore/village-page-client';

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
      return <LoreNotFound kind="village" />;
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
