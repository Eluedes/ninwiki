'use client';

// Pagina de um post (rota /blog/[slug]). O conteudo rico chega ja' convertido
// em HTML pelo Server Component pai (via <RichText />): `children` = ingles, `childrenPt` = traducao.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { formatPostDate } from '@/components/blog/post-card';
import { PostToc } from '@/components/blog/post-toc';
import { PostEngagement } from '@/components/blog/post-engagement';
import { readingMinutes, type TocItem } from '@/lib/blog-utils';
import { localizedText } from '@/lib/localized';
import type { ApiPost } from '@/lib/api-client';

/** Pagina de um post: titulo, capa, autor, datas e o conteudo rico. */
export function PostPageClient({
  post, toc, tocPt, children, childrenPt,
}: {
  post: ApiPost; toc: TocItem[]; tocPt?: TocItem[]; children: ReactNode; childrenPt?: ReactNode;
}) {
  const { locale, dict } = useLanguage();
  const published = post.publishedAt ?? post.createdAt;
  const edited = post.updatedAt.slice(0, 10) !== published.slice(0, 10);
  const usePt = locale === 'pt' && Boolean(childrenPt);
  const minutes = readingMinutes(usePt && post.contentPt ? post.contentPt : post.content);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
      <Link href="/blog" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        {dict.blog.back}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{localizedText(locale, post.title, post.titlePt)}</h1>
      <div className="mt-2 text-sm text-muted-foreground">
        {formatPostDate(published, locale)}
        {post.authorName ? ` · ${dict.blog.by} ${post.authorName}` : ''}
        {edited ? ` · ${dict.blog.updated} ${formatPostDate(post.updatedAt, locale)}` : ''}
        {` · ${minutes} ${dict.blogx.public.minRead}`}
      </div>
      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Link key={tag.id} href={`/blog?tag=${encodeURIComponent(tag.id)}`} className="rounded-full border border-border px-3 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
              {localizedText(locale, tag.name, tag.namePt)}
            </Link>
          ))}
        </div>
      )}
      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImage} alt={localizedText(locale, post.title, post.titlePt)} className="mt-6 w-full rounded-xl border border-border object-cover" />
      )}
      {/* Portugues quando existe a traducao; senao o ingles (nunca fica vazio) */}
      <PostToc items={usePt && tocPt ? tocPt : toc} />
      <div className="mt-6">{usePt ? childrenPt : children}</div>
      <PostEngagement slug={post.slug} />
    </article>
  );
}
