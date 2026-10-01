'use client';

// Listagem de vilas (rota /village): cabecalho + cards, no idioma do visitante. A busca dos dados
// fica no Server Component app/(wiki)/(lore)/village/page.tsx.

import { PageHeader } from '@/components/lore/page-header';
import { VillageCard } from '@/components/lore/village-card';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiVillage } from '@/lib/api-client';

/** Listagem das vilas com cabecalho traduzido. */
export function VillagesPageClient({ villages }: { villages: ApiVillage[] }) {
  const { dict } = useLanguage();
  const t = dict.lore;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.villagesTitle}
        subtitle={t.villagesSubtitle}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: t.villagesCrumb }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {villages.map((v) => (
          <VillageCard key={v.id} village={v} />
        ))}
      </div>
    </div>
  );
}
