// Pagina de um assunto do Guia (rota /guide/topics/[slug]): lista todos os guias publicados do assunto.
// Server Component: busca da API; o visual (idioma) fica em components/wiki/guide-topic-client.tsx.
// Slug desconhecido ou assunto sem guia publicado responde 404 (o hub tambem esconde assunto vazio).

import { listGuideArticles } from '@/lib/api-client';
import { GuideTopicClient } from '@/components/wiki/guide-topic-client';
import { sectionFromSlug } from '@/lib/guide-topics';
import { dictionaries } from '@/lib/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Titulo e descricao da aba (SEO) em ingles, o idioma padrao do site. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const section = sectionFromSlug((await params).slug);
  if (!section) return { title: 'Guides' };
  const en = dictionaries.en.lore;
  return { title: en.guideSections[section], description: en.guidex.sectionDesc[section] };
}

/** Pagina publica de um assunto do Guia. */
export default async function GuideTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const section = sectionFromSlug((await params).slug);
  if (!section) notFound();
  const all = await listGuideArticles();
  const articles = all.filter((a) => a.section === section).sort((a, b) => a.position - b.position);
  if (articles.length === 0) notFound();
  return <GuideTopicClient section={section} articles={articles} available={[...new Set(all.map((a) => a.section))]} />;
}

// Busca da API a cada acesso (mesma razao da pagina do artigo).
export const dynamic = 'force-dynamic';
