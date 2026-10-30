'use client';

// Parte INTERATIVA da listagem de Masteries (i18n via useLanguage) -
// recebe as masteries ja' buscadas da API real como prop, vindas do
// Server Component pai (app/(wiki)/(lore)/masteries/page.tsx). Mesmo
// padrao/motivo de mastery-page-client.tsx (useLanguage e' hook de
// React, nao funciona num Server Component async).

import { useLanguage } from '@/components/providers/language-provider';
import Link from 'next/link';
import { MasteryCard } from '@/components/lore/mastery-card';
import { MasteryIcon } from '@/components/lore/mastery-icon';
import { PageHeader } from '@/components/lore/page-header';
import type { ApiMastery } from '@/lib/api-client';

/** Listagem das masteries (elementais e nao elementais). */
export function MasteriesPageClient({ masteries, utility }: { masteries: ApiMastery[]; utility?: ApiMastery }) {
  const { dict } = useLanguage();
  const t = dict.masteryDetail;
  const elementalCount = masteries.filter((m) => m.type === 'elemental').length;
  const nonElementalCount = masteries.length - elementalCount;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title="Masteries"
        subtitle={t.listSubtitle}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: 'Masteries' }]}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="chip border-ink-600 bg-ink-850/50 text-ink-300">
          {t.elemental} ({elementalCount})
        </span>
        <span className="chip border-ink-600 bg-ink-850/50 text-ink-300">
          {t.nonElemental} ({nonElementalCount})
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {masteries.map((m) => (
          <MasteryCard key={m.id} mastery={m} />
        ))}
      </div>

      {/* Utility NAO e' mastery (qualquer pessoa pode usar): area propria /utility, separada do grid acima */}
      {utility && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.utilityTitle}</h2>
          <Link href="/utility" className="dossier-panel dossier-panel-hover flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${utility.color}15`, color: utility.color }}>
              <MasteryIcon icon={utility.icon} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-ink-100">{t.utilityCta}</p>
              <p className="text-sm text-ink-300">{t.utilityIntro}</p>
            </div>
          </Link>
        </section>
      )}
    </div>
  );
}
