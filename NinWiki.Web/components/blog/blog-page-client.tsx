'use client';

// Listagem publica do blog (rota /blog). Recebe os posts ja' buscados pelo
// Server Component pai (app/(wiki)/blog/page.tsx).

import { useLanguage } from '@/components/providers/language-provider';
import { PageHeader } from '@/components/lore/page-header';
import { PostCardLarge } from '@/components/blog/post-card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { localizedText } from '@/lib/localized';
import type { ApiPostSummary, ApiTagWithCount } from '@/lib/api-client';

/** Listagem publica do blog. */
export function BlogPageClient({
  posts, failed, tags = [], activeTag,
}: {
  posts: ApiPostSummary[]; failed: boolean; tags?: ApiTagWithCount[]; activeTag?: string;
}) {
  const { dict, locale } = useLanguage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={dict.blog.title}
        subtitle={dict.blog.subtitle}
        breadcrumbs={[{ label: dict.nav.home, href: '/' }, { label: dict.blog.title }]}
      />
      {tags.length > 0 && (
        <nav aria-label={dict.blogx.public.filterByTag} className="mb-5 flex flex-wrap gap-2">
          {[{ id: '', label: dict.blogx.public.allPosts }, ...tags.filter((t) => t.postCount > 0 || t.id === activeTag).map((t) => ({ id: t.id, label: `${localizedText(locale, t.name, t.namePt)} (${t.postCount})` }))].map((t) => (
            <Link
              key={t.id || 'all'}
              href={t.id ? `/blog?tag=${encodeURIComponent(t.id)}` : '/blog'}
              aria-current={(activeTag ?? '') === t.id ? 'page' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                (activeTag ?? '') === t.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {failed ? (
        <p className="text-muted-foreground">{dict.blog.loadError}</p>
      ) : posts.length === 0 ? (
        <p className="text-muted-foreground">{dict.blog.empty}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map((post, i) => (
            <PostCardLarge key={post.id} post={post} featured={i === 0 && !activeTag} />
          ))}
        </div>
      )}
    </div>
  );
}
