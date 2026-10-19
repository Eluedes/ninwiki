'use client';

// Conteudo de UM artigo do Guia (rota /guide/[id]): cabecalho com icone, resumo e o texto rico no idioma escolhido (o portugues cai para o ingles se ainda
// nao tiver traducao). A busca dos dados fica no Server Component app/(wiki)/(lore)/guide/[id]/page.tsx.

import Link from 'next/link';
import type { ApiGuideArticle } from '@/lib/api-client';
import { PageHeader } from '@/components/lore/page-header';
import { GuideIcon } from '@/components/lore/guide-icons';
import { RichText } from '@/components/lore/rich-text';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName, localizedText } from '@/lib/localized';
import { ArrowLeft } from 'lucide-react';

/** Pagina de um artigo do Guia. */
export function GuideArticleClient({ article }: { article: ApiGuideArticle }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const title = localizedName(locale, article.title, article.titlePt);
  const summary = localizedText(locale, article.summary, article.summaryPt);
  const body = locale === 'pt' && article.bodyPt ? article.bodyPt : article.body;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={title}
        subtitle={summary || undefined}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: dict.nav.guides, href: '/catalog/guides' }, { label: t.guideSections[article.section] }, { label: title }]}
        icon={<GuideIcon icon={article.icon} className="h-7 w-7" />}
      />

      <div className="dossier-panel p-5 text-sm leading-relaxed">
        <RichText content={body} />
      </div>

      <Link href="/catalog/guides" className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t.guideBackToGuide}
      </Link>
    </div>
  );
}
