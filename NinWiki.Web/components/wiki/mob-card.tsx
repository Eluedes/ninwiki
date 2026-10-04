'use client';

// Card de um MOB (bestiario) ou de uma ARMA no catalogo (kind='weapon'): sprite grande sobre um fundo com brilho, nome, nivel, selo de tipo
// (Boss/NPC/Montaria) e raridade com uma faixa colorida na lateral. O resto do wiki usa o CatalogCard mais simples.

import Link from 'next/link';
import { Skull, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';
import { rarityConfig } from '@/lib/data';
import type { ApiContentItemSummary } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiImage } from '@/components/wiki/wiki-image';

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

  return (
    <Link href={`/detail/${entry.slug}`} className="group block">
      <div
        className={cn(
          'relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 pl-4',
          'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md'
        )}
      >
        {/* faixa da raridade na lateral */}
        <span className={cn('absolute inset-y-0 left-0 w-1', rarity.barColor)} aria-hidden />
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.18),transparent_70%)] bg-secondary/40">
          <WikiImage
            src={entry.image}
            alt={`Imagem de ${name}`}
            fallback={kind === 'weapon' ? <Sword className="h-8 w-8 text-muted-foreground" /> : <Skull className="h-8 w-8 text-muted-foreground" />}
            className="h-16 w-16"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="truncate text-base font-bold leading-tight text-card-foreground transition-colors group-hover:text-primary">{name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {!(kind === 'weapon' && entry.level === 0) && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                {kind === 'weapon' ? dict.detail.levelReq : dict.detail.level} {entry.level}
              </span>
            )}
            {type && (
              <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase', type.className)}>
                {locale === 'pt' ? type.pt : type.en}
              </span>
            )}
            <span className={cn('text-[11px] font-semibold', rarity.color)}>{rarity.label}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
