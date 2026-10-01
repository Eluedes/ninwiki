// Listagem publica do blog (rota /blog). Server Component: busca so' os
// posts PUBLICADOS (rascunho nunca aparece) e repassa pro Client Component.

import { listPosts, type ApiPostSummary } from '@/lib/api-client';
import { BlogPageClient } from '@/components/blog/blog-page-client';

/** Listagem publica do blog (so' posts publicados). */
export default async function BlogPage() {
  let posts: ApiPostSummary[] = [];
  let failed = false;
  try {
    posts = await listPosts('published');
  } catch {
    failed = true;
  }
  return <BlogPageClient posts={posts} failed={failed} />;
}

// Busca da API a cada acesso (ver comentario nas outras paginas publicas).
export const dynamic = 'force-dynamic';
