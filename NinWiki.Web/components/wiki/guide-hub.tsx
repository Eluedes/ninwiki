'use client';

// Indice do Guia (rota /catalog/guides): busca, "Comece por aqui" (passos numerados para quem acabou de chegar), os assuntos em cartoes que levam
// a pagina propria, um resumo (3 guias + 'Ver todos') de cada assunto e o atalho para o sistema de Proficiencias. Artigos vem de Admin > Artigos do Guia; assunto sem artigo
// publicado nao aparece. (Missoes sairam daqui: tem secao propria em /missions.)

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Hammer, Search, ArrowRight } from 'lucide-react';
import { GUIDE_SECTIONS, type ApiGuideArticle, type GuideSection } from '@/lib/api-client';
import { GuideIcon } from '@/components/lore/guide-icons';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName, localizedText } from '@/lib/localized';
import { topicHref } from '@/lib/guide-topics';

const CARD = 'group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40';
const ICON_BOX = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary';

/** Cartao de um artigo do Guia (usado no hub, nos resultados da busca e nas paginas de assunto). */
export function GuideArticleCard({ article: a }: { article: ApiGuideArticle }) {
  const { locale } = useLanguage();
  return (
    <Link href={`/guide/${a.id}`} className={CARD}>
      <span className={ICON_BOX}><GuideIcon icon={a.icon} className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{localizedName(locale, a.title, a.titlePt)}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{localizedText(locale, a.summary, a.summaryPt)}</span>
      </span>
    </Link>
  );
}

/** Artigos do Guia: busca, comece por aqui, assuntos e atalhos dos sistemas com pagina propria. */
export function GuideHub({ articles }: { articles: ApiGuideArticle[] }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const g = t.guidex;
  const [q, setQ] = useState('');

  // Artigos de cada assunto, na ordem definida no painel (position); a API ja' ordena, mas nao custa garantir.
  const bySection = useMemo(() => {
    const map = new Map<GuideSection, ApiGuideArticle[]>();
    for (const s of GUIDE_SECTIONS) map.set(s, articles.filter((a) => a.section === s).sort((a, b) => a.position - b.position));
    return map;
  }, [articles]);

  const needle = q.trim().toLowerCase();
  const found = useMemo(() => {
    if (!needle) return [];
    return articles.filter((a) => [a.title, a.titlePt, a.summary, a.summaryPt].some((x) => x?.toLowerCase().includes(needle)));
  }, [articles, needle]);

  const sections = GUIDE_SECTIONS.filter((s) => (bySection.get(s) ?? []).length > 0);
  const start = bySection.get('new-player') ?? [];

  const articleCard = (a: ApiGuideArticle) => <GuideArticleCard key={a.id} article={a} />;

  return (
    <div className="mb-10 space-y-8">
      {articles.length > 0 && (
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={g.searchPlaceholder} aria-label={g.searchPlaceholder} className="pl-9" />
        </div>
      )}

      {needle ? (
        <section aria-live="polite">
          <h2 className="mb-3 text-lg font-bold tracking-tight">{g.results.replace('{n}', String(found.length))}</h2>
          {found.length === 0 ? <p className="text-sm text-muted-foreground">{g.noResults}</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{found.map(articleCard)}</div>}
        </section>
      ) : (
        <>
          {/* Comece por aqui: passos numerados, em destaque, para quem acabou de chegar */}
          {start.length > 0 && (
            <section id="start" className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
              <h2 className="text-lg font-bold tracking-tight">{g.startHere}</h2>
              <p className="mb-3 text-sm text-muted-foreground">{g.startHereDesc}</p>
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {start.map((a, i) => (
                  <li key={a.id}>
                    <Link href={`/guide/${a.id}`} className={`${CARD} h-full`}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-label={g.step.replace('{n}', String(i + 1))}>{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{localizedName(locale, a.title, a.titlePt)}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{localizedText(locale, a.summary, a.summaryPt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Assuntos: cartoes grandes que levam para a pagina propria de cada assunto */}
          {sections.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold tracking-tight">{g.browse}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((s) => {
                  const list = bySection.get(s) ?? [];
                  return (
                    <Link key={s} href={topicHref(s)} className={CARD} aria-label={`${t.guideSections[s]} - ${g.openSection}`}>
                      <span className={ICON_BOX}><GuideIcon icon={list[0]?.icon ?? 'book-open'} className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{t.guideSections[s]}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{g.sectionDesc[s]}</span>
                        <span className="mt-1 block text-[11px] font-medium text-primary">{g.topicCount.replace('{n}', String(list.length))}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Os guias de cada topico ficam na PAGINA do topico (cartoes acima): repetir a lista aqui duplicava tudo. */}

          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight">{t.guideSections.systems}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/proficiencies" className={CARD}>
                <span className={ICON_BOX}><Hammer className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{dict.nav.proficiencies}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t.guideSystemsProficiencies}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
