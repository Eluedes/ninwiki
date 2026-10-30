'use client';

// Uma linha de drop dentro da DetailSidebar: nome do item, quantidade,
// raridade e uma barra visual representando a chance de drop.

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { rarityConfig } from '@/lib/data';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiDropEntry } from '@/lib/api-client';

interface DropRowProps {
  drop: ApiDropEntry;
}

/** Linha de um drop: item, quantidade e chance (vira link se o item estiver publicado). */
export function DropRow({ drop }: DropRowProps) {
  const { dict } = useLanguage();
  const rarity = rarityConfig[drop.rarity];

  // Monta o texto de quantidade (" ×1" ou " ×1-3"), so' se min/max
  // estiverem definidos. `!= null` (com dois iguais, de proposito)
  // cobre tanto `undefined` quanto `null` de uma vez - a API devolve
  // `null` quando o campo nao foi preenchido, nao `undefined`.
  const qtyLabel =
    drop.minQty != null && drop.maxQty != null
      ? drop.minQty === drop.maxQty
        ? ` ×${drop.minQty}`
        : ` ×${drop.minQty}-${drop.maxQty}`
      : '';

  // Texto da porcentagem: "Over 10%"/"Below 1%" quando alguem escolheu
  // isso no editor (espelha a ficha do proprio jogo, que nunca mostra
  // o numero exato pro jogador) - senao, mostra o numero cru como
  // sempre foi.
  const chanceLabel =
    drop.chanceQualifier === 'over' ? `Over ${drop.chance}%` :
    drop.chanceQualifier === 'below' ? `Below ${drop.chance}%` :
    `${drop.chance}%`;

  const content = (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-card-foreground">
          {drop.itemName}
          <span className="text-muted-foreground">{qtyLabel}</span>
        </span>
        {/* Raridade = a do ITEM ligado (nao e' mais escolhida no drop). Drop so' com texto nao tem raridade para mostrar. */}
        {drop.droppedItemId && (
          <span className={cn('shrink-0 text-xs font-semibold', rarity.color)}>
            {dict.detail.rarities[drop.rarity]}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {/* Barra de progresso simples: a largura em % representa
            visualmente a chance de drop. Math.min(..., 100) protege
            contra um valor de `chance` maior que 100 quebrar o layout. */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', (drop.droppedItemId ? rarity.barColor : 'bg-slate-400'))}
            style={{ width: `${Math.min(drop.chance, 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {chanceLabel}
        </span>
      </div>
    </div>
  );

  // droppedItemSlug so' vem preenchido quando o item ligado esta'
  // PUBLICADO (a API ja' decide isso - ver model_validator em
  // app/schemas/content.py::DropEntryRead) - sem slug, mostra so' o
  // texto normal, sem virar link nenhum.
  if (drop.droppedItemSlug) {
    return (
      <Link
        href={`/detail/${drop.droppedItemSlug}`}
        className="flex items-center gap-3 rounded-md py-1.5 transition-colors hover:bg-secondary/50"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-3 py-1.5">{content}</div>;
}
