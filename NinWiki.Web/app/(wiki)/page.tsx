// Pagina inicial (rota "/"): busca os 3 posts publicados mais recentes do blog
// e repassa pro Client Component (HomeClient). Se a API estiver fora do ar a
// Home continua abrindo, so' sem noticias.

import { listPosts, type ApiPostSummary } from '@/lib/api-client';
import { HomeClient } from '@/components/wiki/home-client';

/** Pagina inicial: busca os ultimos posts e entrega para o HomeClient. */
export default async function HomePage() {
  let posts: ApiPostSummary[] = [];
  try {
    posts = (await listPosts('published')).slice(0, 3);
  } catch {
    // Home nunca deve quebrar por causa das noticias
  }
  return <HomeClient posts={posts} />;
}

export const dynamic = 'force-dynamic';
