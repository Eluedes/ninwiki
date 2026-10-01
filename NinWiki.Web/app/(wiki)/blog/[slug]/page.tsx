// Pagina publica de um post (rota /blog/[slug]). Rascunho e post agendado (data no futuro) respondem 404 na API,
// entao nunca vazam pro visitante. Monta o indice (TOC) a partir dos titulos H2/H3 e o SEO (titulo/descricao do Google,
// Open Graph para redes sociais, canonical).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug, ApiError, type ApiPost } from '@/lib/api-client';
import { PostPageClient } from '@/components/blog/post-page-client';
import { RichText, extractPlainText } from '@/components/lore/rich-text';
import { prepareContent } from '@/lib/blog-utils';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Busca o post pelo slug; rascunho, agendado ou inexistente vira null (404). */
async function fetchPost(slug: string): Promise<ApiPost | null> {
  try {
    const post = await getPostBySlug(slug);
    return post.status === 'published' && !post.isScheduled ? post : null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** Titulo, descricao, Open Graph e canonical da pagina (SEO) a partir do post (campos de SEO ou titulo/resumo). */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await fetchPost(slug);
    if (!post) return {};
    const title = post.metaTitle || post.title;
    const description = post.metaDescription || post.excerpt || extractPlainText(post.content).slice(0, 160);
    return {
      title,
      description,
      alternates: { canonical: `${SITE}/blog/${post.slug}` },
      openGraph: {
        type: 'article',
        title,
        description,
        url: `${SITE}/blog/${post.slug}`,
        publishedTime: post.publishedAt ?? post.createdAt,
        modifiedTime: post.updatedAt,
        tags: post.tags.map((t) => t.name),
        images: post.coverImage ? [{ url: post.coverImage }] : undefined,
      },
      twitter: { card: post.coverImage ? 'summary_large_image' : 'summary', title, description },
    };
  } catch {
    // sem metadata especifica se a API estiver fora do ar
  }
  return {};
}

/** Pagina publica de um post do blog. */
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) notFound();

  // Ingles (principal) e portugues (traducao): cada um com o seu indice, porque os titulos mudam de texto.
  const en = prepareContent(post.content);
  const pt = post.contentPt ? prepareContent(post.contentPt) : null;

  return (
    <PostPageClient
      post={post}
      toc={en.toc}
      tocPt={pt?.toc}
      childrenPt={pt ? <RichText content={pt.content} /> : undefined}
    >
      <RichText content={en.content} />
    </PostPageClient>
  );
}

export const dynamic = 'force-dynamic';
