'use client';

// Card de uma Vila na listagem (/village). Mesmo padrao visual do
// MasteryCard (icone + linha de destaque lateral na cor da vila).

import Link from 'next/link';
import type { ApiVillage } from '@/lib/api-client';
import { WikiImage } from '@/components/wiki/wiki-image';
import { MapPin } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName } from '@/lib/localized';

/** Card de uma vila na listagem. */
export function VillageCard({ village }: { village: ApiVillage }) {
  const { locale } = useLanguage();
  const name = localizedName(locale, village.name, village.namePt);
  return (
    <Link
      href={`/village/${village.id}`}
      className="group relative flex items-start gap-4 rounded-xl border border-ink-700/60 bg-ink-850/80 p-5 shadow-sm transition-all duration-300 hover:border-chakra-600/60 hover:shadow-[0_0_20px_rgba(14,165,233,0.08)]"
    >
      <WikiImage
        src={village.image}
        alt={`Emblema da ${name}`}
        fallback={village.emblem}
        className="h-14 w-14 shrink-0 rounded-lg"
        imageClassName="object-contain p-1"
      />

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold text-ink-100">{name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-300">{village.description}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
          <MapPin className="h-3.5 w-3.5" />
          <span>{village.element}</span>
          <span className="text-ink-600">·</span>
          <span className="italic">&quot;{village.motto}&quot;</span>
        </div>
      </div>

      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: village.accentColor }}
      />
    </Link>
  );
}
