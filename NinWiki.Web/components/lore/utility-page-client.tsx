'use client';

// Parte interativa da area Utility (/utility): lista as tecnicas utilitarias (jutsus sem mastery) com o texto "todos podem aprender".
// Fica fora das masteries de proposito: Utility nao e' uma mastery. Reaproveita JutsuCard com a mastery "virtual" so' para a cor.

import { useLanguage } from '@/components/providers/language-provider';
import { JutsuCard } from '@/components/lore/jutsu-card';
import { PageHeader } from '@/components/lore/page-header';
import { MasteryIcon } from '@/components/lore/mastery-icon';
import { UTILITY_MASTERY } from '@/lib/utility-category';
import type { ApiJutsu } from '@/lib/api-client';

/** Lista das tecnicas utilitarias. */
export function UtilityPageClient({ jutsus }: { jutsus: ApiJutsu[] }) {
  const { dict } = useLanguage();
  const t = dict.masteryDetail;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.utilityTitle}
        subtitle={t.utilitySubtitle}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: 'Masteries', href: '/masteries' }, { label: t.utilityTitle }]}
        icon={<MasteryIcon icon={UTILITY_MASTERY.icon} className="h-7 w-7" />}
        accentColor={UTILITY_MASTERY.color}
      />
      <p className="mb-6 max-w-3xl text-sm text-ink-300">{t.utilityIntro}</p>
      {jutsus.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jutsus.map((j) => (
            <JutsuCard key={j.id} jutsu={j} mastery={UTILITY_MASTERY} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-400">{t.utilityEmpty}</p>
      )}
    </div>
  );
}
