'use client';

// Parte INTERATIVA da pagina de detalhe (botao de copiar atributos,
// i18n via useLanguage) - recebe a entry e as relacionadas ja'
// buscadas da API real como prop, vindas do Server Component pai
// (app/(wiki)/detail/[id]/page.tsx).

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { DetailSidebar } from '@/components/wiki/detail-sidebar';
import { CatalogCard } from '@/components/wiki/catalog-card';
import { WikiImage } from '@/components/wiki/wiki-image';
import { RichText } from '@/components/lore/rich-text';
import { shouldShowLevel } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import type { ApiContentItem, ApiContentItemSummary } from '@/lib/api-client';

/** Pagina de detalhe de uma entry (mob, item, arma...): ficha, drops, atributos. */
export function DetailPageClient({ entry, related }: { entry: ApiContentItem; related: ApiContentItemSummary[] }) {
  const { dict, locale } = useLanguage();

  // Escolhe o campo traduzido quando o idioma e' portugues - com
  // fallback pro ingles se a traducao ainda nao existir (entry criada
  // antes da chave da DeepL estar configurada, por exemplo). Em
  // ingles, sempre mostra o campo original direto (e' a lingua
  // "principal" de escrita agora), nunca precisa de fallback.
  const isPt = locale === 'pt';
  const name = isPt ? (entry.namePt ?? entry.name) : entry.name;
  const description = isPt ? (entry.descriptionPt ?? entry.description) : entry.description;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href={`/catalog/${entry.category}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {dict.detail.back}
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
            {shouldShowLevel(entry.category, entry.itemType) && (
              <p className="mt-1 text-sm italic text-muted-foreground">
                {dict.detail.level} {entry.level}
              </p>
            )}
          </div>

          <div className="flex justify-center rounded-xl border border-border bg-muted/20 py-12">
            <WikiImage
              src={entry.image}
              alt={`Imagem de ${name}`}
              fallback={entry.icon}
              className="h-40 w-40 rounded-xl"
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <RichText content={description} className="text-card-foreground leading-relaxed" />
          </div>

          {/* Lore/Synergy: REMOVIDOS DE VEZ do site (decisao final do
              Rafael, 27/09 - nao usamos isso em nenhuma categoria).
              As variaveis lore/synergy (definidas mais acima, com o
              fallback de idioma) ficaram sem uso aqui de proposito -
              nao apagadas do arquivo pra' nao interromper o resto do
              componente, so' os blocos de renderizacao que sumiram. */}

          {related.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold">{dict.detail.relatedEntries}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {related.map((rel) => (
                  <CatalogCard key={rel.id} entry={rel} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <div className="sticky top-20">
            <DetailSidebar entry={entry} />
          </div>
        </div>
      </div>
    </div>
  );
}
