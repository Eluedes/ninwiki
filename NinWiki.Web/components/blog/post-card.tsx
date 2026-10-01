'use client';

// Card de um post do blog (lista /blog e "Ultimas noticias" da Home).
// O card inteiro e' um link para /blog/[slug].

import Link from 'next/link';
import { ArrowRight, Heart, MessageSquare, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { localizedText } from '@/lib/localized';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiImage } from '@/components/wiki/wiki-image';
import type { ApiPostSummary } from '@/lib/api-client';

/** Data do post no formato do idioma (pt-BR ou en-US). */
export function formatPostDate(iso: string, locale: 'pt' | 'en'): string {
  return new Date(iso).toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Card de um post: capa, data, autor, titulo e resumo; clicavel para /blog/[slug]. */
export function PostCard({ post }: { post: ApiPostSummary }) {
  const { locale, dict } = useLanguage();

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-border bg-card p-5',
        'shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md'
      )}
    >
      <WikiImage
        src={post.coverImage}
        alt={localizedText(locale, post.title, post.titlePt)}
        fallback={<Newspaper className="h-8 w-8 text-primary" />}
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary"
        imageClassName="h-full w-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm text-muted-foreground">
          {formatPostDate(post.publishedAt ?? post.createdAt, locale)}
          {post.authorName ? ` · ${dict.blog.by} ${post.authorName}` : ''}
        </div>
        <h3 className="text-base font-bold tracking-tight text-card-foreground transition-colors group-hover:text-primary">
          {localizedText(locale, post.title, post.titlePt)}
        </h3>
        {post.excerpt && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{localizedText(locale, post.excerpt, post.excerptPt)}</p>
        )}
        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span key={tag.id} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {localizedText(locale, tag.name, tag.namePt)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            {dict.news.readMore}
            <ArrowRight className="h-3 w-3" />
          </span>
          <span className="inline-flex items-center gap-1" title={dict.blogx.public.likes}><Heart className="h-3 w-3" />{post.likeCount}</span>
          <span className="inline-flex items-center gap-1" title={dict.blogx.public.comments}><MessageSquare className="h-3 w-3" />{post.commentCount}</span>
        </div>
      </div>
    </Link>
  );
}
