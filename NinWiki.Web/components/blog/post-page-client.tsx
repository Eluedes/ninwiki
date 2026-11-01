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
  const title = localizedText(locale, post.title, post.titlePt);
  const banner = post.bannerImage || post.coverImage;   // banner do topo: largura maxima = a da arte padrao (960px) e proporcao dela (960x311), senao a imagem e' esticada e fica borrada (posts da Steam usam a arte padrao do jogo); sem ele, a capa
  const tocItems = usePt && tocPt ? tocPt : toc;
  const meta = [
    formatPostDate(published, locale),
    post.authorName ? `${dict.blog.by} ${post.authorName}` : null,
    edited ? `${dict.blog.updated} ${formatPostDate(post.updatedAt, locale)}` : null,
    `${minutes} ${dict.blogx.public.minRead}`,
  ].filter(Boolean).join(' · ');

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <Link href="/blog" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        {dict.blog.back}
      </Link>
      {/* Capa grande no topo (estilo noticia da Steam): imagem larga com o titulo por cima de um degrade escuro */}
      {banner ? (
        <header className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-black">
          {/* Fundo: a mesma arte esticada e desfocada, so' para preencher as laterais (a arte em si NAO e' esticada nem cortada). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
          {/* Frente: a arte INTEIRA, no tamanho real (ate' 960px) e centralizada; titulo por cima no desktop e embaixo no celular. */}
          <div className="relative mx-auto max-w-[960px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt={title} className="block h-auto w-full" />
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/85 via-black/20 to-transparent sm:block" />
            <div className="bg-black/60 p-4 sm:absolute sm:inset-x-0 sm:bottom-0 sm:bg-transparent sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
              <div className="mt-2 text-sm text-white/80">{meta}</div>
            </div>
          </div>
        </header>
      ) : (
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{meta}</div>
        </header>
      )}
      {post.tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Link key={tag.id} href={`/blog?tag=${encodeURIComponent(tag.id)}`} className="rounded-full border border-border px-3 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
              {localizedText(locale, tag.name, tag.namePt)}
            </Link>
          ))}
        </div>
      )}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10">
        <div className="min-w-0">
          {/* Portugues quando existe a traducao; senao o ingles (nunca fica vazio) */}
          <div className="prose-shinobi-lg max-w-3xl">{usePt ? childrenPt : children}</div>
          <div className="max-w-3xl"><PostEngagement slug={post.slug} /></div>
        </div>
        {/* Indice: coluna lateral fixa no desktop (acompanha a rolagem); no celular vai antes do texto */}
        <aside className="order-first mb-6 lg:order-none lg:mb-0">
          <PostToc items={tocItems} className="lg:sticky lg:top-24" />
        </aside>
      </div>
    </article>
  );
}
