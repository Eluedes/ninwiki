'use client';

// Card de uma Mastery na listagem (/masteries). Usa a cor propria da
// mastery (mastery.color) para tingir o chip do elemento e a
// linha de destaque na lateral esquerda do card.

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiMastery } from '@/lib/api-client';
import { MasteryVisual } from '@/components/lore/mastery-visual';
import { extractPlainText } from '@/components/lore/rich-text';

export function MasteryCard({ mastery }: { mastery: ApiMastery }) {
  const { dict, locale } = useLanguage();
  const isPt = locale === 'pt';
  const name = isPt ? (mastery.namePt ?? mastery.name) : mastery.name;
  // Fallback nos DOIS sentidos (nao so' pt->en como em content_items):
  // o texto que ja' existia nessas duas colunas, de anos atras, e'
  // portugues de verdade - description_pt so' comeca a ter conteudo
  // depois que alguem rodar o backfill (ver
  // NinWiki.Api/scripts/backfill_mastery_jutsu_english.py) ou editar a
  // mao. Ate' la', "|| mastery.description" garante que o card nunca
  // fica em branco em nenhum dos dois idiomas.
  const description = isPt ? (mastery.descriptionPt || mastery.description) : (mastery.description || mastery.descriptionPt);

  return (
    <Link
      href={`/masteries/${mastery.id}`}
      className="group relative flex items-start gap-4 rounded-xl border border-ink-700/60 bg-ink-850/80 p-5 shadow-sm transition-all duration-300 hover:border-chakra-600/60 hover:shadow-[0_0_20px_rgba(14,165,233,0.08)]"
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${mastery.color}18`, color: mastery.color }}
      >
        <MasteryVisual
          image={mastery.image}
          icon={mastery.icon}
          alt={`Imagem da mastery ${name}`}
          className="h-14 w-14 rounded-lg"
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold text-ink-100">{name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-300">{extractPlainText(description ?? '')}</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="chip border font-mono text-xs"
            style={{
              borderColor: `${mastery.color}40`,
              color: mastery.color,
              backgroundColor: `${mastery.color}10`,
            }}
          >
            {mastery.element}
          </span>
          {mastery.paths.length > 0 && (
            <span className="text-xs text-ink-400">{mastery.paths.length} {dict.masteryDetail.paths}</span>
          )}
        </div>
      </div>

      {/* Linha de destaque na lateral, na cor da mastery - engrossa
          suavemente no hover (efeito controlado por "group" no <Link> pai). */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: mastery.color }}
      />
    </Link>
  );
}
