'use client';

// Parte INTERATIVA da pagina de detalhe de um Jutsu (i18n via
// useLanguage) - recebe jutsu/mastery/path ja' resolvidos como props,
// vindos do Server Component pai (app/(wiki)/(lore)/jutsus/[id]/page.tsx).
// Precisa ser Client Component pra' poder escolher name/englishName e
// description/descriptionPt conforme o idioma, mesmo motivo/padrao de
// mastery-page-client.tsx.

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { Infobox } from '@/components/lore/infobox';
import { PageHeader } from '@/components/lore/page-header';
import { MasteryIcon } from '@/components/lore/mastery-icon';
import { JutsuGif } from '@/components/lore/jutsu-gif';
import { RichText } from '@/components/lore/rich-text';
import { Zap, Target, Clock, Timer, Gauge } from 'lucide-react';
import type { ApiJutsu, ApiMastery, ApiMasteryPath } from '@/lib/api-client';

// Cor do numero do tier - mesma logica de cores do JutsuCard, mas em
// hex direto (usado via style inline) em vez de classes Tailwind.
const tierColors: Record<number, string> = {
  1: '#9a9ab5',
  2: '#c5c5d8',
  3: '#0ea5e9',
  4: '#dc2626',
  5: '#fbbf24',
};

export function JutsuPageClient({
  jutsu,
  mastery,
  path,
}: {
  jutsu: ApiJutsu;
  mastery?: ApiMastery;
  path?: ApiMasteryPath;
}) {
  const { dict, locale } = useLanguage();
  const t = dict.jutsuDetail;
  const isPt = locale === 'pt';
  const name = isPt ? (jutsu.namePt ?? jutsu.name) : jutsu.name;
  const altName = isPt ? jutsu.name : jutsu.namePt;
  // Fallback nos DOIS sentidos - mesmo motivo de mastery-page-client.tsx
  // (o texto ja existente e' portugues de verdade ate' alguem rodar
  // uma traducao ou editar a mao).
  const longDescription = isPt
    ? (jutsu.longDescriptionPt || jutsu.longDescription)
    : (jutsu.longDescription || jutsu.longDescriptionPt);
  const masteryName = mastery ? (isPt ? (mastery.namePt ?? mastery.name) : mastery.name) : undefined;

  const tierLabels: Record<number, string> = {
    1: t.tier1, 2: t.tier2, 3: t.tier3, 4: t.tier4, 5: t.tier5,
  };
  const tierColor = tierColors[jutsu.tier];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={name}
        subtitle={altName ?? undefined}
        breadcrumbs={[
          { label: t.home, href: '/' },
          { label: 'Masteries', href: '/masteries' },
          ...(mastery ? [{ label: masteryName!, href: `/masteries/${mastery.id}` }] : []),
          { label: name },
        ]}
        icon={<MasteryIcon icon={jutsu.icon} className="h-7 w-7" />}
        accentColor={mastery?.color}
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="dossier-panel p-4">
              <div className="flex items-center gap-2 text-ink-400">
                <Gauge className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t.chakraCostLabel}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-chakra-300">{jutsu.chakraCost}</p>
            </div>
            <div className="dossier-panel p-4">
              <div className="flex items-center gap-2 text-ink-400">
                <Target className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t.rangeLabel}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-100">{jutsu.range}</p>
            </div>
            <div className="dossier-panel p-4">
              <div className="flex items-center gap-2 text-ink-400">
                <Clock className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t.castTimeLabel}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-100">{jutsu.castTime}</p>
            </div>
            <div className="dossier-panel p-4">
              <div className="flex items-center gap-2 text-ink-400">
                <Timer className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t.cooldownLabel}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-100">{jutsu.cooldown}</p>
            </div>
            <div className="dossier-panel p-4">
              <div className="flex items-center gap-2 text-ink-400">
                <Zap className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">{t.effectLabel}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-100">{jutsu.effect}</p>
            </div>
            <div className="dossier-panel p-4">
              <div className="flex items-center gap-2 text-ink-400">
                <span className="text-xs uppercase tracking-wide">{t.tierLabel}</span>
              </div>
              <p className="mt-1 text-2xl font-bold" style={{ color: tierColor }}>
                T{jutsu.tier}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Infobox
            title={t.jutsuSheet}
            icon={<MasteryIcon icon={jutsu.icon} className="h-4 w-4" />}
            accentColor={mastery?.color}
            entries={[
              { label: dict.masteryDetail.nameLabel, value: name },
              {
                label: t.masteryLabel,
                value: mastery ? (
                  <Link href={`/masteries/${mastery.id}`} className="text-chakra-400 hover:underline">
                    {masteryName}
                  </Link>
                ) : '—',
              },
              { label: t.pathLabel, value: path ? path.label : t.noPath },
              { label: t.tierLabel, value: `T${jutsu.tier} · ${tierLabels[jutsu.tier]}` },
              { label: t.chakraCostLabel, value: `${jutsu.chakraCost}` },
              { label: t.rangeLabel, value: jutsu.range },
              { label: t.castTimeLabel, value: jutsu.castTime },
              { label: t.cooldownLabel, value: jutsu.cooldown },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
