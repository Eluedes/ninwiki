'use client';

// "Comece por aqui" do Guia (rota /catalog/guides), inspirado na pagina de Guias do Nin Online Wiki (Fandom): os ARTIGOS do Guia agrupados por secao
// (Comece por aqui, Combate e PvP, Progressao, Controles, Dinheiro) - editados em Admin > Artigos do Guia - e um bloco com os sistemas que tem pagina
// propria (Proficiencias e Missoes). Secao sem artigo publicado nao aparece.

import Link from 'next/link';
import { Hammer, ScrollText } from 'lucide-react';
import { GUIDE_SECTIONS, type ApiGuideArticle } from '@/lib/api-client';
import { GuideIcon } from '@/components/lore/guide-icons';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName, localizedText } from '@/lib/localized';

const CARD = 'group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40';
const ICON_BOX = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary';

/** Artigos do Guia por secao + atalhos dos sistemas com pagina propria, no topo do Guia. */
export function GuideHub({ articles }: { articles: ApiGuideArticle[] }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  return (
    <div className="mb-10 space-y-6">
      {GUIDE_SECTIONS.map((section) => {
        const list = articles.filter((a) => a.section === section);
        if (list.length === 0) return null;
        return (
          <section key={section}>
            <h2 className="mb-3 text-lg font-bold tracking-tight">{t.guideSections[section]}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => (
                <Link key={a.id} href={`/guide/${a.id}`} className={CARD}>
                  <span className={ICON_BOX}><GuideIcon icon={a.icon} className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{localizedName(locale, a.title, a.titlePt)}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{localizedText(locale, a.summary, a.summaryPt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight">{t.guideSections.systems}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/proficiencies" className={CARD}>
            <span className={ICON_BOX}><Hammer className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{dict.nav.proficiencies}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t.guideSystemsProficiencies}</span>
            </span>
          </Link>
          <Link href="/catalog/missions" className={CARD}>
            <span className={ICON_BOX}><ScrollText className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{dict.nav.missions}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t.guideSystemsMissions}</span>
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
