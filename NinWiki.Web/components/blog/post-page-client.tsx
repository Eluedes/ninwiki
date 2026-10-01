'use client';

// Pagina de um post (rota /blog/[slug]). O conteudo rico chega ja' convertido
// em HTML pelo Server Component pai (via <RichText />): `children` = ingles, `childrenPt` = traducao.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { formatPostDate } from '@/components/blog/post-card';
import { localizedText } from '@/lib/localized';
import type { ApiPost } from '@/lib/api-client';

/** Pagina de um post: titulo, capa, autor, datas e o conteudo rico. */
export function PostPageClient({ post, children, childrenPt }: { post: ApiPost; children: ReactNode; childrenPt?: ReactNode }) {
  const { locale, dict } = useLanguage();
  const edited = post.updatedAt.slice(0, 10) !== post.createdAt.slice(0, 10);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
      <Link href="/blog" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        {dict.blog.back}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{localizedText(locale, post.title, post.titlePt)}</h1>
      <div className="mt-2 text-sm text-muted-foreground">
        {formatPostDate(post.createdAt, locale)}
        {post.authorName ? ` · ${dict.blog.by} ${post.authorName}` : ''}
        {edited ? ` · ${dict.blog.updated} ${formatPostDate(post.updatedAt, locale)}` : ''}
      </div>
      {post.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImage} alt={localizedText(locale, post.title, post.titlePt)} className="mt-6 w-full rounded-xl border border-border object-cover" />
      )}
      {/* Portugues quando existe a traducao; senao o ingles (nunca fica vazio) */}
      <div className="mt-6">{locale === 'pt' && childrenPt ? childrenPt : children}</div>
    </article>
  );
}
