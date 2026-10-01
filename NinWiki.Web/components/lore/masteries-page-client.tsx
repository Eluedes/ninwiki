'use client';

// Parte INTERATIVA da listagem de Masteries (i18n via useLanguage) -
// recebe as masteries ja' buscadas da API real como prop, vindas do
// Server Component pai (app/(wiki)/(lore)/masteries/page.tsx). Mesmo
// padrao/motivo de mastery-page-client.tsx (useLanguage e' hook de
// React, nao funciona num Server Component async).

import { useLanguage } from '@/components/providers/language-provider';
import { MasteryCard } from '@/components/lore/mastery-card';
import { PageHeader } from '@/components/lore/page-header';
import type { ApiMastery } from '@/lib/api-client';

export function MasteriesPageClient({ masteries }: { masteries: ApiMastery[] }) {
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
    </div>
  );
}
