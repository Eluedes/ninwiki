'use client';

// Listagem publica do blog (rota /blog). Recebe os posts ja' buscados pelo
// Server Component pai (app/(wiki)/blog/page.tsx).

import { useLanguage } from '@/components/providers/language-provider';
import { PageHeader } from '@/components/lore/page-header';
import { PostCard } from '@/components/blog/post-card';
import type { ApiPostSummary } from '@/lib/api-client';

export function BlogPageClient({ posts, failed }: { posts: ApiPostSummary[]; failed: boolean }) {
  const { dict } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={dict.blog.title}
        subtitle={dict.blog.subtitle}
        breadcrumbs={[{ label: dict.nav.home, href: '/' }, { label: dict.blog.title }]}
      />
      {failed ? (
        <p className="text-muted-foreground">{dict.blog.loadError}</p>
      ) : posts.length === 0 ? (
        <p className="text-muted-foreground">{dict.blog.empty}</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
