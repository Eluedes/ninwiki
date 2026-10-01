'use client';

// Card de um Jutsu, usado na grade de jutsus dentro da pagina de uma
// Mastery. Mostra o selo de "Tier" (T1 a T5) com cor propria por nivel.
//
// `mastery` vem como prop opcional (nao busca mais sozinho de um mock)
// - quem chama esse card (a pagina da Mastery, ou a pagina do proprio
// Jutsu) ja' tem a mastery carregada da API real, e' so' repassar.

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiJutsu, ApiMastery } from '@/lib/api-client';
import { MasteryIcon } from '@/components/lore/mastery-icon';
import { extractPlainText } from '@/components/lore/rich-text';

// Cor/estilo do selo de tier - do mais fraco (cinza) ao mais forte
// (dourado), passando por azul (chakra) e vermelho (blood) nos tiers
// intermediarios/altos.
const tierColors: Record<number, string> = {
  1: 'text-ink-300 border-ink-600 bg-ink-800/50',
  2: 'text-ink-200 border-ink-500 bg-ink-700/50',
  3: 'text-chakra-300 border-chakra-600/40 bg-chakra-600/10',
  4: 'text-blood-500 border-blood-500/40 bg-blood-500/10',
  5: 'text-gold-300 border-gold-400/50 bg-gold-400/10',
};

/** Card de um jutsu. */
export function JutsuCard({ jutsu, mastery }: { jutsu: ApiJutsu; mastery?: ApiMastery }) {
  const { locale, dict } = useLanguage();
  const isPt = locale === 'pt';
  const name = isPt ? (jutsu.namePt ?? jutsu.name) : jutsu.name;
  // Subtitulo mostra o OUTRO idioma (mesmo padrao de antes, so' que
  // agora escolhido pelo locale em vez de sempre name+englishName
  // juntos na mesma ordem fixa) - pode ser null se essa entry ainda
  // nao passou pela traducao automatica (ou pelo backfill, pra' as
  // que ja existiam antes - ver scripts/backfill_mastery_jutsu_english.py),
  // component decide la' embaixo se mostra ou nao.
  const altName = isPt ? jutsu.name : jutsu.namePt;
  const description = isPt ? (jutsu.descriptionPt || jutsu.description) : (jutsu.description || jutsu.descriptionPt);

  return (
    <Link
      href={`/jutsus/${jutsu.id}`}
      className="dossier-panel dossier-panel-hover group block p-4"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: mastery ? `${mastery.color}15` : undefined,
            color: mastery?.color,
          }}
        >
          <MasteryIcon icon={jutsu.icon} className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-bold text-ink-100 group-hover:text-chakra-300 transition-colors">
            {name}
          </h3>
          {altName && <p className="text-xs text-ink-400">{altName}</p>}
        </div>

        <span
          className={`chip shrink-0 border font-bold ${tierColors[jutsu.tier] ?? tierColors[1]}`}
        >
          T{jutsu.tier}
        </span>
      </div>

      {jutsu.gif && (
        <div className="relative mt-4 aspect-video overflow-hidden rounded-md border border-ink-700 bg-ink-950">
          <Image
            src={jutsu.gif}
            alt={dict.lore.jutsuDemoAlt.replace('{name}', name)}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      )}

      <p className="mt-2 text-sm text-ink-300 line-clamp-2">{extractPlainText(description ?? '')}</p>

    </Link>
  );
}
