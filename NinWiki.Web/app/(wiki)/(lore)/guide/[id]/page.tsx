// Pagina de um artigo do Guia (rota /guide/[id]): Zonas, Crime, Equipes, Controles...
// Server Component assincrono, busca da API real; o visual (idioma) fica em components/lore/guide-article-client.tsx.
// Rascunho responde 404 para o visitante (so' a equipe ve, no painel).

import { getGuideArticle, listGuideArticles, ApiError } from '@/lib/api-client';
import { GuideArticleClient } from '@/components/lore/guide-article-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Titulo da aba: o titulo do artigo. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: (await getGuideArticle(id)).title };
  } catch {
    return { title: 'Guides' };
  }
}

/** Pagina publica de um artigo do Guia (Server Component: busca na API). */
export default async function GuideArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let article;
  try {
    article = await getGuideArticle(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  // Todos os artigos publicados (na ordem do Guia): servem para anterior/proximo e relacionados. Se falhar, a pagina abre sem eles.
  const siblings = await listGuideArticles().catch(() => []);
  return <GuideArticleClient article={article} siblings={siblings} />;
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
