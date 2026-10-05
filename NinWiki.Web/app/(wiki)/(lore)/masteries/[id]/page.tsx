// Pagina de detalhe de uma Mastery (rota /masteries/[id]) - Server
// Component assincrono, so' busca da API real e repassa pro Client
// Component (MasteryPageClient) que faz a renderizacao de verdade,
// consciente de idioma (ver comentario la' pro motivo completo de
// precisar ser Client Component).

import { getMastery, listJutsus, listUtilityJutsus, listNpcJutsus, listAttributes, ApiError } from '@/lib/api-client';
import { NPC_ID, NPC_MASTERY, UTILITY_ID, UTILITY_MASTERY } from '@/lib/utility-category';
import { MasteryPageClient } from '@/components/lore/mastery-page-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Titulo da aba: o nome da mastery. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (id === UTILITY_ID) return { title: 'Utility' };
  if (id === NPC_ID) return { title: 'NPC Jutsu' };
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

  // /masteries/utility: categoria Utility (jutsus sem mastery) - nao existe como mastery no banco, usa a "virtual"
  if (id === UTILITY_ID) {
    const [utilityJutsus, attributes] = await Promise.all([listUtilityJutsus(), listAttributes()]);
    return <MasteryPageClient mastery={UTILITY_MASTERY} masteryJutsus={utilityJutsus} attributes={attributes} />;
  }

  // /masteries/npc: secao dos Jutsus NPC (de qualquer mastery ou de Utilidade)
  if (id === NPC_ID) {
    const [npcJutsus, attributes] = await Promise.all([listNpcJutsus(), listAttributes()]);
    return <MasteryPageClient mastery={NPC_MASTERY} masteryJutsus={npcJutsus} attributes={attributes} />;
  }

  // getMastery devolve 404 (via ApiError) quando o id da URL nao
  // existe no banco - trata isso como "nao encontrada", igual o mock
  // fazia antes quando masteryById() devolvia undefined.
  let mastery;
  try {
    mastery = await getMastery(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [masteryJutsus, attributes] = await Promise.all([
    listJutsus(mastery.id, true),   // sem os jutsus de NPC (eles tem a secao propria /masteries/npc)
    listAttributes(),
  ]);

  return <MasteryPageClient mastery={mastery} masteryJutsus={masteryJutsus} attributes={attributes} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
