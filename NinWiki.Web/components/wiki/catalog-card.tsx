'use client';

// Card compacto que representa UMA entry do wiki dentro de uma lista
// (usado no catalogo e na secao "entradas relacionadas" do detalhe).

import Link from 'next/link';
import { cn, shouldShowLevel } from '@/lib/utils';
import { rarityConfig } from '@/lib/data';
import type { ApiContentItemSummary } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiImage } from '@/components/wiki/wiki-image';

// Rotulo + cor do selo de subtipo de mob. 'monster' fica de fora de
// proposito - e' o tipo mais comum, mostrar um selo nele seria ruido
// visual em quase todo card do catalogo de mobs.
const mobTypeBadge: Record<string, { label: string; className: string }> = {
  boss: { label: 'Boss', className: 'bg-red-500/15 text-red-500' },
  npc: { label: 'NPC', className: 'bg-sky-500/15 text-sky-500' },
  mount: { label: 'Montaria', className: 'bg-amber-500/15 text-amber-500' },
};

// Mesma ideia, para o subtipo de item. 'general'/'consumable'/'material'
// ficam de fora - 'ring' e' o unico que precisa se destacar visualmente
// por enquanto (categoria nova, ainda pouco povoada).
const itemTypeBadge: Record<string, { label: string; className: string }> = {
  ring: { label: 'Ring', className: 'bg-violet-500/15 text-violet-400' },
  authority: { label: 'Authority', className: 'bg-cyan-400/15 text-cyan-300' },
};

interface CatalogCardProps {
  entry: ApiContentItemSummary;
}

/** Card de uma entry na listagem do catalogo. */
export function CatalogCard({ entry }: CatalogCardProps) {
  const { dict, locale } = useLanguage();
  const name = locale === 'pt' ? (entry.namePt ?? entry.name) : entry.name;
  const rarity = rarityConfig[entry.rarity];
  const badge =
    (entry.mobType && mobTypeBadge[entry.mobType]) ||
    (entry.itemType && itemTypeBadge[entry.itemType]) ||
    undefined;

  return (
    // Roteia pelo SLUG (ex: /detail/larva), nao pelo uuid interno -
    // URL legivel pro visitante do wiki.
    <Link href={`/detail/${entry.slug}`} className="group block">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border bg-card p-2.5',
          'transition-all duration-200',
          'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md'
        )}
      >
        {/* Brilho atras da imagem na cor da raridade (da' "vida" ao card) */}
        <WikiImage
          src={entry.image}
          alt={`Imagem de ${name}`}
          fallback={entry.icon}
          className="h-16 w-16 shrink-0 rounded-md border border-border/60"
          imageClassName="p-1"
          style={{ backgroundImage: `radial-gradient(circle at 50% 45%, rgba(${rarity.glow},0.28), transparent 75%)` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">
              {name}
            </p>
            {badge && (
              <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', badge.className)}>
                {badge.label}
              </span>
            )}
          </div>
          {shouldShowLevel(entry.category, entry.itemType) && (
            <p className="text-xs italic text-muted-foreground">
              {dict.detail.level} {entry.level}
            </p>
          )}
        </div>
        <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold', rarity.chip)}>
          {rarity.label}
        </span>
      </div>
    </Link>
  );
}
