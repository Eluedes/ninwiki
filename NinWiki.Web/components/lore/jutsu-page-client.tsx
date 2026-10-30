'use client';

// Parte INTERATIVA da pagina de detalhe de um Jutsu (i18n via
// useLanguage) - recebe jutsu/mastery/path ja' resolvidos como props,
// vindos do Server Component pai (app/(wiki)/(lore)/jutsus/[id]/page.tsx).
// Precisa ser Client Component pra' poder escolher name/englishName e
// description/descriptionPt conforme o idioma, mesmo motivo/padrao de
// mastery-page-client.tsx.

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { JutsuSheet } from '@/components/lore/jutsu-sheet';
import { ReportButton } from '@/components/report/report-button';
import { PageHeader } from '@/components/lore/page-header';
import { MasteryIcon } from '@/components/lore/mastery-icon';
import { JutsuGif } from '@/components/lore/jutsu-gif';
import { RichText } from '@/components/lore/rich-text';
import { Zap } from 'lucide-react';
import type { ApiJutsu, ApiMastery } from '@/lib/api-client';
import { masteryHref } from '@/lib/utility-category';

/** Pagina de um jutsu. */
export function JutsuPageClient({
  jutsu,
  mastery,
}: {
  jutsu: ApiJutsu;
  mastery?: ApiMastery;
}) {
  const { dict, locale } = useLanguage();
  const t = dict.jutsuDetail;
  const isPt = locale === 'pt';
  const name = isPt ? (jutsu.namePt ?? jutsu.name) : jutsu.name;
  const altName = isPt ? jutsu.name : null;   // em EN nao mostra o nome em portugues
  // Fallback nos DOIS sentidos - mesmo motivo de mastery-page-client.tsx
  // (o texto ja existente e' portugues de verdade ate' alguem rodar
  // uma traducao ou editar a mao).
  const longDescription = isPt
    ? (jutsu.longDescriptionPt || jutsu.longDescription)
    : (jutsu.longDescription || jutsu.longDescriptionPt);
  const masteryName = mastery ? (isPt ? (mastery.namePt ?? mastery.name) : mastery.name) : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={name}
        subtitle={altName ?? undefined}
        breadcrumbs={[
          { label: t.home, href: '/' },
          { label: 'Masteries', href: '/masteries' },
          ...(mastery ? [{ label: masteryName!, href: masteryHref(mastery) }] : []),
          { label: name },
        ]}
        icon={<MasteryIcon icon={jutsu.icon} className="h-7 w-7" />}
        accentColor={mastery?.color}
        action={<ReportButton targetType="jutsu" targetId={jutsu.id} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="dossier-panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: mastery?.color }} />
              <h2 className="font-display text-lg font-bold text-ink-100">{t.aboutJutsu}</h2>
            </div>
            <RichText content={longDescription ?? ''} />
          </div>

          {jutsu.gif && (
            <JutsuGif src={jutsu.gif as string} alt={name} />
          )}
        </div>

        <div className="space-y-4">
          <JutsuSheet jutsu={jutsu} mastery={mastery} masteryName={masteryName} />
        </div>
      </div>
    </div>
  );
}
