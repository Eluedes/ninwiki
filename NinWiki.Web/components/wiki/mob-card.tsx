'use client';

// Card de um MOB (bestiario) ou de uma ARMA no catalogo (kind='weapon'): sprite grande sobre um fundo com brilho, nome, nivel, selo de tipo
// (Boss/NPC/Montaria) e raridade com uma faixa colorida na lateral. O resto do wiki usa o CatalogCard mais simples.

import { levelText } from '@/lib/utils';
import Link from 'next/link';
import { MapPin, Skull, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rarityConfig } from '@/lib/data';
import type { ApiContentItemSummary } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiImage } from '@/components/wiki/wiki-image';
import { ZONE_DOT } from '@/components/wiki/detail-sidebar';

/** Quantos lugares o card mostra antes de resumir o resto em "+N" (a ficha completa lista todos). */
const MAX_PLACES = 3;

// Selo do subtipo ('monster' fica sem selo: e' o tipo comum). Chaves iguais as do CatalogCard.
const MOB_TYPE_LABEL: Record<string, { en: string; pt: string; className: string }> = {
  boss: { en: 'Boss', pt: 'Chefe', className: 'bg-red-500/15 text-red-400' },
  npc: { en: 'NPC', pt: 'NPC', className: 'bg-sky-500/15 text-sky-400' },
  mount: { en: 'Mount', pt: 'Montaria', className: 'bg-amber-500/15 text-amber-400' },
};

/** Card de um mob no bestiario (ou de uma arma, com kind="weapon"). */
export function MobCard({ entry, kind = 'mob' }: { entry: ApiContentItemSummary; kind?: 'mob' | 'weapon' }) {
  const { dict, locale } = useLanguage();
  const name = locale === 'pt' ? (entry.namePt ?? entry.name) : entry.name;
  const rarity = rarityConfig[entry.rarity];
  const type = kind === 'mob' && entry.mobType ? MOB_TYPE_LABEL[entry.mobType] : undefined;
  // Onde o mob aparece (bestiario): a lista com zona vale; sem lista, o texto livre antigo e' quebrado por virgula (sem zona), como na ficha.
  const spawnText = locale === 'pt' ? (entry.spawnLocationPt ?? entry.spawnLocation) : entry.spawnLocation;
  const places: { name: string; zone: string | null }[] = kind !== 'mob' ? [] : (entry.spawnLocations ?? []).length > 0
    ? (entry.spawnLocations ?? []).map((l) => ({ name: locale === 'pt' ? (l.namePt ?? l.name) : l.name, zone: l.zone ?? null }))
    : (spawnText ?? '').split(/[,;]/).map((p) => p.trim().replace(/\.$/, '')).filter(Boolean).map((n) => ({ name: n, zone: null }));

  return (
    <Link href={`/detail/${entry.slug}`} className="group block">
      <div
        className={cn(
          'relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 pl-4',
          'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md'
        )}
      >
        {/* faixa da raridade na lateral */}
        <span className={cn('absolute inset-y-0 left-0 w-1', kind === 'mob' ? 'bg-primary/40' : rarity.barColor)} aria-hidden />
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.18),transparent_70%)] bg-secondary/40">
          <WikiImage
            src={entry.image}
            alt={name}
            fallback={kind === 'weapon' ? <Sword className="h-8 w-8 text-muted-foreground" /> : <Skull className="h-8 w-8 text-muted-foreground" />}
            className="h-16 w-16"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-base font-bold leading-tight text-card-foreground transition-colors group-hover:text-primary">{name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {!(kind === 'weapon' && entry.level === 0 && !entry.levelUnknown) && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                {kind === 'weapon' ? dict.detail.levelReq : dict.detail.level} {levelText(entry)}
              </span>
            )}
            {type && (
              <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase', type.className)}>
                {locale === 'pt' ? type.pt : type.en}
              </span>
            )}
            {kind === 'weapon' && <span className={cn('text-[11px] font-semibold', rarity.color)}>{dict.detail.rarities[entry.rarity]}</span>}   {/* mobs nao tem raridade */}
          </div>
          {places.length > 0 && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground" title={places.map((p) => p.name).join(', ')}>
              <MapPin className="h-3 w-3 shrink-0" aria-label={dict.detail.spawnLocation} />
              {places.slice(0, MAX_PLACES).map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ZONE_DOT[p.zone ?? 'none'])} aria-hidden />
                  {p.name}
                </span>
              ))}
              {places.length > MAX_PLACES && <span className="font-semibold">+{places.length - MAX_PLACES}</span>}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
