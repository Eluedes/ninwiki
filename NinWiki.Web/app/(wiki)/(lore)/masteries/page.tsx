// Listagem de Masteries (rota /masteries). Server Component ASSINCRONO
// (nao precisa de 'use client') - so' busca da API real e repassa pro
// Client Component (MasteriesPageClient) que faz a renderizacao de
// verdade, consciente de idioma - mesmo padrao/motivo de
// app/(wiki)/(lore)/masteries/[id]/page.tsx.

import { listMasteries } from '@/lib/api-client';
import { MasteriesPageClient } from '@/components/lore/masteries-page-client';

export default async function MasteriesPage() {
  const masteries = await listMasteries();
  return <MasteriesPageClient masteries={masteries} />;
}
