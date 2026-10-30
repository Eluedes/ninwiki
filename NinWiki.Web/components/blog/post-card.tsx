'use client';

// Card de um post do blog (lista /blog e "Ultimas noticias" da Home).
// O card inteiro e' um link para /blog/[slug].

import Link from 'next/link';
import { ArrowRight, Heart, MessageSquare, Newspaper } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { localizedText } from '@/lib/localized';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiImage } from '@/components/wiki/wiki-image';
import type { ApiPostSummary } from '@/lib/api-client';

/** Data do post no formato do idioma (pt-BR ou en-US). */
export function formatPostDate(iso: string, locale: 'pt' | 'en'): string {
  // UTC: servidor e navegador geram o mesmo texto (sem erro de hidratacao)
  return formatDate(iso, locale, { day: '2-digit', month: 'short', year: 'numeric', utc: true });
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

/**
 * Card GRANDE de um post (lista /blog, estilo noticias da Steam): capa larga em cima e texto embaixo.
 * `featured` = o post mais recente, que ocupa a linha inteira com a capa maior.
 */
export function PostCardLarge({ post, featured = false }: { post: ApiPostSummary; featured?: boolean }) {
  const { locale, dict } = useLanguage();
  const title = localizedText(locale, post.title, post.titlePt);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-lg',
        featured && 'sm:col-span-2 lg:flex-row'
      )}
    >
      <WikiImage
        src={post.coverImage}
        alt={title}
        fallback={<Newspaper className="h-10 w-10 text-primary" />}
        className={cn('flex shrink-0 items-center justify-center overflow-hidden bg-secondary', featured ? 'aspect-[16/9] lg:aspect-auto lg:w-3/5' : 'aspect-[16/9]')}
        imageClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="mb-1 text-xs text-muted-foreground">
          {formatPostDate(post.publishedAt ?? post.createdAt, locale)}
          {post.authorName ? ` · ${dict.blog.by} ${post.authorName}` : ''}
        </div>
        <h3 className={cn('font-bold tracking-tight text-card-foreground transition-colors group-hover:text-primary', featured ? 'text-xl sm:text-2xl' : 'text-lg')}>{title}</h3>
        {post.excerpt && (
          <p className={cn('mt-2 text-sm leading-relaxed text-muted-foreground', featured ? 'line-clamp-5' : 'line-clamp-3')}>{localizedText(locale, post.excerpt, post.excerptPt)}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-muted-foreground">
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag.id} className="rounded-full border border-border px-2 py-0.5 text-[11px]">{localizedText(locale, tag.name, tag.namePt)}</span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1" title={dict.blogx.public.likes}><Heart className="h-3 w-3" />{post.likeCount}</span>
          <span className="inline-flex items-center gap-1" title={dict.blogx.public.comments}><MessageSquare className="h-3 w-3" />{post.commentCount}</span>
        </div>
      </div>
    </Link>
  );
}
