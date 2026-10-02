// Listagem de Masteries (rota /masteries). Server Component ASSINCRONO
// (nao precisa de 'use client') - so' busca da API real e repassa pro
// Client Component (MasteriesPageClient) que faz a renderizacao de
// verdade, consciente de idioma - mesmo padrao/motivo de
// app/(wiki)/(lore)/masteries/[id]/page.tsx.

import { listMasteries } from '@/lib/api-client';
import { MasteriesPageClient } from '@/components/lore/masteries-page-client';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Masteries' };


/** Listagem publica de masteries (Server Component: busca na API). */
export default async function MasteriesPage() {
  const masteries = await listMasteries();
  return <MasteriesPageClient masteries={masteries} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
