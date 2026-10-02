// Pagina de detalhe de uma Mastery (rota /masteries/[id]) - Server
// Component assincrono, so' busca da API real e repassa pro Client
// Component (MasteryPageClient) que faz a renderizacao de verdade,
// consciente de idioma (ver comentario la' pro motivo completo de
// precisar ser Client Component).

import { getMastery, listJutsus, listAttributes, ApiError } from '@/lib/api-client';
import { LoreNotFound } from '@/components/lore/lore-not-found';
import { MasteryPageClient } from '@/components/lore/mastery-page-client';
import type { Metadata } from 'next';

/** Titulo da aba: o nome da mastery. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: `${(await getMastery(id)).name} Mastery` };
  } catch {
    return { title: 'Masteries' };
  }
}


/** Pagina publica de uma mastery (Server Component: busca na API). */
export default async function MasteryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // getMastery devolve 404 (via ApiError) quando o id da URL nao
  // existe no banco - trata isso como "nao encontrada", igual o mock
  // fazia antes quando masteryById() devolvia undefined.
  let mastery;
  try {
    mastery = await getMastery(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return <LoreNotFound kind="mastery" />;
    }
    throw err;
  }

  const [masteryJutsus, attributes] = await Promise.all([
    listJutsus(mastery.id),
    listAttributes(),
  ]);

  return <MasteryPageClient mastery={mastery} masteryJutsus={masteryJutsus} attributes={attributes} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
