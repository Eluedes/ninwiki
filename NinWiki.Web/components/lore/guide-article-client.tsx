'use client';

// Conteudo de UM artigo do Guia (rota /guide/[id]): cabecalho com icone, resumo e tempo de leitura, texto rico no idioma escolhido (o portugues cai para o
// ingles se ainda nao tiver traducao), sumario lateral (TOC) a partir dos titulos, navegacao anterior/proximo dentro do assunto e guias relacionados.
// A busca dos dados fica no Server Component app/(wiki)/(lore)/guide/[id]/page.tsx.

import Link from 'next/link';
import { useMemo } from 'react';
import type { ApiGuideArticle } from '@/lib/api-client';
import { PageHeader } from '@/components/lore/page-header';
import { GuideIcon } from '@/components/lore/guide-icons';
import { RichText } from '@/components/lore/rich-text';
import { PostToc } from '@/components/blog/post-toc';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName, localizedText } from '@/lib/localized';
import { prepareContent, readingMinutes } from '@/lib/blog-utils';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';

/** Versao enxuta de um artigo, usada nos links de anterior/proximo e relacionados. */
export type GuideLink = Pick<ApiGuideArticle, 'id' | 'section' | 'position' | 'title' | 'titlePt' | 'summary' | 'summaryPt' | 'icon'>;

/** Cartao de "anterior"/"proximo" no fim do artigo. */
function NavCard({ a, dir, label }: { a: GuideLink; dir: 'prev' | 'next'; label: string }) {
  const { locale } = useLanguage();
  return (
    <Link href={`/guide/${a.id}`} className={`group dossier-panel flex flex-col gap-1 p-4 transition-colors hover:border-primary/50 ${dir === 'next' ? 'items-end text-right' : ''}`}>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {dir === 'prev' && <ArrowLeft className="h-3 w-3" />}{label}{dir === 'next' && <ArrowRight className="h-3 w-3" />}
      </span>
      <span className="text-sm font-semibold group-hover:text-primary">{localizedName(locale, a.title, a.titlePt)}</span>
    </Link>
  );
}

/** Pagina de um artigo do Guia. `siblings` = todos os artigos publicados (inclui o atual), ja' na ordem do Guia. */
export function GuideArticleClient({ article, siblings }: { article: ApiGuideArticle; siblings: GuideLink[] }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const g = t.guidex;
  const title = localizedName(locale, article.title, article.titlePt);
  const summary = localizedText(locale, article.summary, article.summaryPt);
  const body = locale === 'pt' && article.bodyPt ? article.bodyPt : article.body;
  // Titulos H2/H3 ganham ancora (id) e alimentam o sumario; o tempo de leitura sai do mesmo texto.
  const prepared = useMemo(() => prepareContent(body), [body]);
  const minutes = useMemo(() => readingMinutes(body), [body]);

  const sameSection = siblings.filter((a) => a.section === article.section);
  const index = sameSection.findIndex((a) => a.id === article.id);
  const prev = index > 0 ? sameSection[index - 1] : null;
  const next = index >= 0 && index < sameSection.length - 1 ? sameSection[index + 1] : null;
  // Relacionados: o resto do assunto; se for pouco, completa com artigos de outros assuntos.
  const related = [...sameSection, ...siblings.filter((a) => a.section !== article.section)].filter((a) => a.id !== article.id && a.id !== prev?.id && a.id !== next?.id).slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={title}
        subtitle={summary || undefined}
        breadcrumbs={[
          { label: t.home, href: '/' },
          { label: dict.nav.guides, href: '/catalog/guides' },
          { label: t.guideSections[article.section], href: `/catalog/guides#${article.section}` },
          { label: title },
        ]}
        icon={<GuideIcon icon={article.icon} className="h-7 w-7" />}
      />
      <p className="-mt-3 mb-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{g.readMin.replace('{n}', String(minutes))}</p>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
        <div className="min-w-0">
          <div className="dossier-panel p-5 text-sm leading-relaxed">
            <RichText content={prepared.content} />
          </div>

          {(prev || next) && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {prev ? <NavCard a={prev} dir="prev" label={g.previous} /> : <span />}
              {next ? <NavCard a={next} dir="next" label={g.next} /> : <span />}
            </div>
          )}

          {related.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-bold tracking-tight">{g.related}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {related.map((a) => (
                  <Link key={a.id} href={`/guide/${a.id}`} className="group dossier-panel flex items-start gap-2 p-3 transition-colors hover:border-primary/50">
                    <span className="mt-0.5 text-primary"><GuideIcon icon={a.icon} className="h-4 w-4" /></span>
                    <span className="text-sm font-semibold group-hover:text-primary">{localizedName(locale, a.title, a.titlePt)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sumario: coluna lateral fixa no desktop; no celular vem antes do texto (so' aparece com 2+ titulos) */}
        <aside className="order-first mb-5 lg:order-none lg:mb-0">
          <PostToc items={prepared.toc} title={g.onThisPage} className="lg:sticky lg:top-24" />
        </aside>
      </div>

      <Link href="/catalog/guides" className="mt-8 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t.guideBackToGuide}
      </Link>
    </div>
  );
}
