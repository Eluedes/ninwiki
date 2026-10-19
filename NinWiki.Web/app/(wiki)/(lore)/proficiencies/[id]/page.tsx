// Pagina de detalhe de uma Profissao (rota /profession/[id]): descricao e tudo que o jogo tem dela (recursos, receitas, ferramentas).
// Server Component assincrono, busca da API real; o visual fica em components/lore/profession-page-client.tsx (precisa saber o idioma).

import { getProfession, ApiError } from '@/lib/api-client';
import { ProfessionPageClient } from '@/components/lore/profession-page-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Titulo da aba: o nome da profissao. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: (await getProfession(id)).name };
  } catch {
    return { title: 'Guides' };
  }
}

/** Pagina publica de uma profissao (Server Component: busca na API). */
export default async function ProfessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let profession;
  try {
    profession = await getProfession(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return <ProfessionPageClient profession={profession} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
