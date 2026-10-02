// Listagem publica do blog (rota /blog, com filtro opcional ?tag=slug). Server Component: busca so' os posts
// PUBLICADOS e ja' no ar (rascunho e agendado nunca aparecem) e as tags, e repassa pro Client Component.

import { listPosts, listTags, type ApiPostSummary, type ApiTagWithCount } from '@/lib/api-client';
import { BlogPageClient } from '@/components/blog/blog-page-client';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Blog' };


/** Listagem publica do blog (so' posts publicados), filtrada pela tag da URL quando houver. */
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const activeTag = typeof tag === 'string' && /^[a-z0-9-]{1,50}$/.test(tag) ? tag : undefined;
  let posts: ApiPostSummary[] = [];
  let tags: ApiTagWithCount[] = [];
  let failed = false;
  try {
    [posts, tags] = await Promise.all([listPosts('published', activeTag), listTags().catch(() => [])]);
  } catch {
    failed = true;
  }
  return <BlogPageClient posts={posts} failed={failed} tags={tags} activeTag={activeTag} />;
}

// Busca da API a cada acesso (ver comentario nas outras paginas publicas).
export const dynamic = 'force-dynamic';
