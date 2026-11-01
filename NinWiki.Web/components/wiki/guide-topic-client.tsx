'use client';

// Pagina de um assunto do Guia (/guide/topics/[slug]): cabecalho com icone, descricao e quantidade, os guias do assunto
// nos mesmos cartoes do indice e atalhos para os outros assuntos. Idioma vem do provider.

import Link from 'next/link';
import { GUIDE_SECTIONS, type ApiGuideArticle, type GuideSection } from '@/lib/api-client';
import { PageHeader } from '@/components/lore/page-header';
import { GuideIcon } from '@/components/lore/guide-icons';
import { GuideArticleCard } from '@/components/wiki/guide-hub';
import { useLanguage } from '@/components/providers/language-provider';
import { topicHref } from '@/lib/guide-topics';

/** Pagina de um assunto: `articles` ja' vem filtrado e ordenado; `available` = assuntos com guia publicado. */
export function GuideTopicClient({ section, articles, available }: { section: GuideSection; articles: ApiGuideArticle[]; available: GuideSection[] }) {
  const { dict } = useLanguage();
  const t = dict.lore;
  const g = t.guidex;
  const others = GUIDE_SECTIONS.filter((s) => s !== section && available.includes(s));   // so' assuntos com guia publicado (os vazios dariam 404)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.guideSections[section]}
        subtitle={g.sectionDesc[section]}
        breadcrumbs={[
          { label: t.home, href: '/' },
          { label: dict.nav.guides, href: '/catalog/guides' },
          { label: t.guideSections[section] },
        ]}
        icon={<GuideIcon icon={articles[0]?.icon ?? 'book-open'} className="h-8 w-8" />}
      />
      <p className="-mt-3 mb-5 text-xs font-medium text-primary">{g.topicCount.replace('{n}', String(articles.length))}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{articles.map((a) => <GuideArticleCard key={a.id} article={a} />)}</div>

      <nav aria-label={g.allTopics} className="mt-10">
        <h2 className="mb-3 text-lg font-bold tracking-tight">{g.allTopics}</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((s) => (
            <li key={s}>
              <Link href={topicHref(s)} className="inline-block rounded-full border border-border bg-card px-3 py-1.5 text-sm text-card-foreground transition-colors hover:border-primary/50 hover:text-primary">
                {t.guideSections[s]}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/catalog/guides" className="inline-block rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">{dict.nav.guides}</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
