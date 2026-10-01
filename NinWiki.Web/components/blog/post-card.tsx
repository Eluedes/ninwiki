'use client';

// Card de um post do blog (lista /blog e "Ultimas noticias" da Home).
// O card inteiro e' um link para /blog/[slug].

import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        alt={post.title}
        fallback={<Newspaper className="h-8 w-8 text-primary" />}
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary"
        imageClassName="h-full w-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-sm text-muted-foreground">
          {formatPostDate(post.createdAt, locale)}
          {post.authorName ? ` · ${dict.blog.by} ${post.authorName}` : ''}
        </div>
        <h3 className="text-base font-bold tracking-tight text-card-foreground transition-colors group-hover:text-primary">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
        )}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
          {dict.news.readMore}
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}
