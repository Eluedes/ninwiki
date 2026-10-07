'use client';

// Secao "Dropado por" da ficha de item/arma: lista os mobs que dropam a entry. A lista vem pronta da API (calculada a partir das
// paginas de mob que ligam o item nos drops) - ninguem cadastra isso a mao. Cada mob e' um link para a pagina dele.

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiImage } from '@/components/wiki/wiki-image';
import type { ApiDroppedBy } from '@/lib/api-client';

/** Lista de mobs que dropam a entry (nao renderiza nada se ninguem dropa). */
export function DroppedBy({ mobs }: { mobs: ApiDroppedBy[] }) {
  const { locale } = useLanguage();
  if (mobs.length === 0) return null;
  return (
    <div className="divide-y divide-border">
      {mobs.map((mob) => {
        // Mesmo texto de chance do DropRow: "Over 10%" / "Below 1%" / "25%"
        const chance = mob.chanceQualifier === 'over' ? `Over ${mob.chance}%` : mob.chanceQualifier === 'below' ? `Below ${mob.chance}%` : `${mob.chance}%`;
        return (
          <Link key={mob.slug} href={`/detail/${mob.slug}`} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-secondary/50">
            <WikiImage src={mob.image} alt="" fallback={mob.icon} className="h-8 w-8 shrink-0 rounded" />
            <span className="min-w-0 flex-1 truncate text-sm text-card-foreground">{locale === 'pt' ? (mob.namePt ?? mob.name) : mob.name}</span>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{chance}</span>
          </Link>
        );
      })}
    </div>
  );
}
