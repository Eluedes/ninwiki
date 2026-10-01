// Pagina publica de um post (rota /blog/[slug]). Rascunho responde 404 na API,
// entao nunca vaza pro visitante.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug, ApiError, type ApiPost } from '@/lib/api-client';
import { PostPageClient } from '@/components/blog/post-page-client';
import { RichText } from '@/components/lore/rich-text';

async function fetchPost(slug: string): Promise<ApiPost | null> {
  try {
    const post = await getPostBySlug(slug);
    return post.status === 'published' ? post : null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await fetchPost(slug);
    if (post) return { title: post.title, description: post.excerpt };
  } catch {
    // sem metadata especifica se a API estiver fora do ar
  }
  return {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  return (
    <PostPageClient post={post}>
      <RichText content={post.content} />
    </PostPageClient>
  );
}

export const dynamic = 'force-dynamic';
