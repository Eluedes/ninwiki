// Listagem de Vilas Ocultas (rota /village). Server Component
// assincrono, busca da API real.

import { listVillages } from '@/lib/api-client';
import { VillageCard } from '@/components/lore/village-card';
import { PageHeader } from '@/components/lore/page-header';

/** Listagem publica de vilas (Server Component: busca na API). */
export default async function VillagesPage() {
  const villages = await listVillages();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title="Vilas Ocultas"
        subtitle="As grandes potências shinobi — cada uma com sua cultura e elemento."
        breadcrumbs={[{ label: 'Início', href: '/' }, { label: 'Vilas' }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {villages.map((v) => (
          <VillageCard key={v.id} village={v} />
        ))}
      </div>
    </div>
  );
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
