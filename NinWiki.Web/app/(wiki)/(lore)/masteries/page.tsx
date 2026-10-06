// Listagem de Masteries (rota /masteries). Server Component ASSINCRONO
// (nao precisa de 'use client') - so' busca da API real e repassa pro
// Client Component (MasteriesPageClient) que faz a renderizacao de
// verdade, consciente de idioma - mesmo padrao/motivo de
// app/(wiki)/(lore)/masteries/[id]/page.tsx.

import { listMasteries, listUtilityJutsus } from '@/lib/api-client';
import { UTILITY_MASTERY } from '@/lib/utility-category';
import { MasteriesPageClient } from '@/components/lore/masteries-page-client';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Masteries' };


/** Listagem publica de masteries (Server Component: busca na API). */
export default async function MasteriesPage() {
  const [masteries, utilityJutsus] = await Promise.all([listMasteries(), listUtilityJutsus().catch(() => [])]);
  // Os Jutsus NPC NAO aparecem aqui (nem como card): so' pelo link direto /masteries/npc e pelo link do proprio jutsu.
  // a categoria Utility (jutsus sem mastery) aparece como um card a mais, SO' se houver pelo menos um jutsu dela
  return <MasteriesPageClient masteries={masteries} utility={utilityJutsus.length > 0 ? UTILITY_MASTERY : undefined} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
