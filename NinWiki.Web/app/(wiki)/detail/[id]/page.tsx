// Pagina de detalhe de uma entry do wiki (rota /detail/[id], onde
// [id] agora e' o SLUG, ex: "larva" - nao o uuid). Server Component
// assincrono, busca da API real; a parte interativa (botao de copiar,
// i18n) fica em components/wiki/detail-page-client.tsx.

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getContentItemBySlug, listContentItems, ApiError } from '@/lib/api-client';
import { DetailPageClient } from '@/components/wiki/detail-page-client';
import type { Metadata } from 'next';
import { shareMetadata } from '@/lib/share-meta';
import { notFound } from 'next/navigation';

/** Titulo da aba: o nome da entry (mob, item, arma...). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const entry = await getContentItemBySlug(id);
    // cartao do link (Discord, WhatsApp, Google): nome, resumo e a imagem da entry (ou o logo)
    return shareMetadata({ title: entry.name, html: entry.description, path: `/detail/${entry.slug}`, image: entry.image });
  } catch {
    return { title: 'Wiki' };
  }
}


/** Pagina publica de uma entry (Server Component: busca na API). */
export default async function DetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = await params;

  let entry;
  try {
    entry = await getContentItemBySlug(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  // "Relacionadas": ate' 4 outras entries PUBLICADAS da mesma
  // categoria, excluindo a atual. Sem logica de relevancia (mesmo
  // aviso que ja existia no mock antigo) - so' as primeiras 4 que
  // vierem, ordenadas por mais recente (e' como listContentItems ja
  // ordena por padrao).
  const sameCategory = await listContentItems(entry.category, 'published');
  const related = sameCategory.filter((e) => e.id !== entry.id).slice(0, 4);

  return <DetailPageClient entry={entry} related={related} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
