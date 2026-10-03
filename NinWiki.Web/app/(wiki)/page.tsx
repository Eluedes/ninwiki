// Pagina inicial (rota "/"): busca os 3 posts publicados mais recentes do blog
// e repassa pro Client Component (HomeClient). Se a API estiver fora do ar a
// Home continua abrindo, so' sem noticias.

import { getAnnouncement, listPosts, type ApiAnnouncement, type ApiPostSummary } from '@/lib/api-client';
import { HomeClient } from '@/components/wiki/home-client';

/** Pagina inicial: busca os ultimos posts e entrega para o HomeClient. */
export default async function HomePage() {
  let posts: ApiPostSummary[] = [];
  try {
    posts = (await listPosts('published')).slice(0, 3);
  } catch {
    // Home nunca deve quebrar por causa das noticias
  }
  // Anuncio da Home (editado no painel). Se a API falhar ou nao houver mensagem, nada aparece.
  let announcement: ApiAnnouncement | null = null;
  try {
    announcement = await getAnnouncement();
  } catch {
    // sem anuncio
  }
  return <HomeClient posts={posts} announcement={announcement} />;
}

export const dynamic = 'force-dynamic';
