// Listagem de Vilas Ocultas (rota /village). Server Component
// assincrono, busca da API real; o visual (idioma) fica em components/lore/villages-page-client.tsx.

import { listVillages } from '@/lib/api-client';
import { VillagesPageClient } from '@/components/lore/villages-page-client';

/** Listagem publica de vilas (Server Component: busca na API). */
export default async function VillagesPage() {
  const villages = await listVillages();
  return <VillagesPageClient villages={villages} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
