// Pagina de detalhe de um Jutsu (rota /jutsus/[id]) - Server Component
// assincrono, so' busca da API real e repassa pro Client Component
// (JutsuPageClient) que faz a renderizacao de verdade, consciente de
// idioma (mesmo padrao de app/(wiki)/(lore)/masteries/[id]/page.tsx -
// useLanguage e' um hook de React, nao funciona aqui).

import { getJutsu, getMastery, ApiError } from '@/lib/api-client';
import { LoreNotFound } from '@/components/lore/lore-not-found';
import { JutsuPageClient } from '@/components/lore/jutsu-page-client';

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
      return <LoreNotFound kind="jutsu" />;
    }
    throw err;
  }

  // mastery e' opcional aqui de proposito (mesmo motivo de antes: se
  // por algum motivo a mastery do jutsu nao carregar, a pagina ainda
  // mostra o jutsu em si, so' sem a cor de destaque/link da mastery).
  const mastery = await getMastery(jutsu.masteryId).catch(() => undefined);
  const path = mastery?.paths.find((p) => p.id === jutsu.pathId);

  return <JutsuPageClient jutsu={jutsu} mastery={mastery} path={path} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
