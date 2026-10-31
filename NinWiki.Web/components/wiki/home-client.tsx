'use client';

// Pagina inicial (rota "/"): hero de boas-vindas, grade de categorias
// e os posts mais recentes do blog (vindos da API via app/(wiki)/page.tsx).

import { NinLogo } from '@/components/icons/nin-logo';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiButton } from '@/components/wiki/wiki-button';
import { PostCard } from '@/components/blog/post-card';
import { categories } from '@/lib/data';
import type { ApiAnnouncement, ApiPostSummary } from '@/lib/api-client';
import { AnnouncementBanner } from '@/components/wiki/announcement-banner';
import { BotInviteCard } from '@/components/wiki/bot-invite-button';
import Link from 'next/link';
import { Slash, Newspaper } from 'lucide-react';

/** Pagina inicial: boas-vindas, categorias e os ultimos posts do blog. */
export function HomeClient({ posts, announcement = null }: { posts: ApiPostSummary[]; announcement?: ApiAnnouncement | null }) {
  const { locale, dict } = useLanguage();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Anuncio (editado no painel): sem mensagem nao aparece nada */}
      <AnnouncementBanner announcement={announcement} />

      {/* Hero: bloco de destaque no topo com o slogan do site.
          O <div> com blur-3xl e' so' um efeito decorativo de "brilho"
          no canto, nao tem funcao alem de visual. */}
      <section className="relative mb-12 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        {/* Livro grande como elemento visual: a direita no desktop, pequeno acima do titulo no celular */}
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
          <NinLogo className="h-20 w-16 md:order-2 md:h-40 md:w-32 md:shrink-0 drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]" />
          <div className="md:order-1">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Slash className="h-4 w-4" />
            {dict.siteTagline}
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {dict.home.welcome} <span className="text-primary">{dict.siteName}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {dict.home.subtitle}
          </p>
          </div>
        </div>
      </section>

      {/* Grade de categorias (Mobs, Itens, Guias, etc.) - vem direto
          de lib/data.ts, nao ha filtro nem busca aqui. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {categories.map((cat) => (
          <WikiButton key={cat.key} category={cat} locale={locale} />
        ))}
      </div>

      <section className="mt-12">
        <div className="mb-5 flex items-center gap-3">
          <Newspaper className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold tracking-tight">{dict.news.title}</h2>
            <p className="text-sm text-muted-foreground">{dict.news.subtitle}</p>
          </div>
        </div>

        <div className="space-y-3">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.news.empty}</p>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
        {posts.length > 0 && (
          <Link href="/blog" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            {dict.news.viewAll}
          </Link>
        )}
      </section>

      <BotInviteCard />
    </div>
  );
}
