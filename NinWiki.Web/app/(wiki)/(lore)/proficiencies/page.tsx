// Pagina inicial de Proficiencias (rota /proficiencies): como funcionam e a lista das profissoes de coleta e criacao.
// Server Component assincrono, busca da API real; o visual (idioma) fica em components/lore/proficiencies-page-client.tsx.

import { listProfessions } from '@/lib/api-client';
import { ProficienciesPageClient } from '@/components/lore/proficiencies-page-client';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Proficiencies' };

/** Pagina publica das proficiencias (Server Component: busca na API). */
export default async function ProficienciesPage() {
  const professions = await listProfessions();
  return <ProficienciesPageClient professions={professions} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
