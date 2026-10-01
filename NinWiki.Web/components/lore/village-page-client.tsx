'use client';

// Conteudo da pagina de detalhe de uma Vila (rota /village/[id]). Client Component
// so' pra escolher o NOME pelo idioma (name = ingles, namePt = traducao - mesma regra
// de Mastery/Jutsu). A busca dos dados continua no Server Component em
// app/(wiki)/(lore)/village/[id]/page.tsx.

import Link from 'next/link';
import type { ApiVillage } from '@/lib/api-client';
import { Infobox } from '@/components/lore/infobox';
import { PageHeader } from '@/components/lore/page-header';
import { WikiImage } from '@/components/wiki/wiki-image';
import { RichText } from '@/components/lore/rich-text';
import { useLanguage } from '@/components/providers/language-provider';
import { alternateName, localizedName } from '@/lib/localized';
import { MapPin, Users, ShieldCheck } from 'lucide-react';

/** Pagina de uma vila: descricao, cla's (com imagem) e organizacoes. */
export function VillagePageClient({ village, allVillages }: { village: ApiVillage; allVillages: ApiVillage[] }) {
  const { locale } = useLanguage();
  const name = localizedName(locale, village.name, village.namePt);
  const altName = alternateName(locale, village.name, village.namePt);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={name}
        subtitle={altName ?? undefined}
        breadcrumbs={[
          { label: 'Início', href: '/' },
          { label: 'Vilas', href: '/village' },
          { label: name },
        ]}
        icon={
          <WikiImage
            src={village.image}
            alt={`Emblema da ${name}`}
            fallback={village.emblem}
            className="h-12 w-12 rounded-lg"
            imageClassName="object-contain p-1"
          />
        }
        accentColor={village.accentColor}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="dossier-panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <WikiImage
                src={village.image}
                alt={`Emblema da ${name}`}
                fallback={village.emblem}
                className="h-12 w-12 shrink-0 rounded-lg"
                imageClassName="object-contain p-1"
              />
              <div>
                <h2 className="font-display text-lg font-bold text-ink-100">Sobre a Vila</h2>
                <p className="text-xs text-ink-400 italic">&quot;{village.motto}&quot;</p>
              </div>
            </div>
            <RichText content={village.longDescription} />
          </div>

          {/* Cla: escolhido na criacao do personagem. So' renderiza a
              secao se existir pelo menos um cla cadastrado pra vila. */}
          {village.clans.length > 0 && (
            <div className="dossier-panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: village.accentColor }} />
                <h2 className="font-display text-lg font-bold text-ink-100">
                  Clãs ({village.clans.length})
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {village.clans.map((clan) => (
                  <div key={clan.id} className="rounded-md border border-ink-700 bg-ink-850/50 p-3">
                    {clan.image && (
                      // Logo + roupa do cla' numa imagem so': object-contain pra nao cortar nada.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={clan.image}
                        alt={clan.name}
                        className="mb-3 h-44 w-full rounded bg-ink-900/60 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    )}
                    <p className="text-sm font-semibold text-ink-100">{clan.name}</p>
                    <p className="mt-1 text-xs text-ink-400">{clan.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Organizacao: corpo especializado que se ingressa depois
              (ANBU, Hunter Nin, etc.) - diferente de cla e de rank. */}
          {village.organizations.length > 0 && (
            <div className="dossier-panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" style={{ color: village.accentColor }} />
                <h2 className="font-display text-lg font-bold text-ink-100">
                  Organizações ({village.organizations.length})
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {village.organizations.map((org) => (
                  <div key={org.id} className="rounded-md border border-ink-700 bg-ink-850/50 p-3">
                    <p className="text-sm font-semibold text-ink-100">{org.name}</p>
                    <p className="mt-1 text-xs text-ink-400">{org.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Infobox
            title="Ficha da Vila"
            icon={<MapPin className="h-4 w-4" />}
            accentColor={village.accentColor}
            entries={[
              { label: 'Nome', value: name },
              ...(altName ? [{ label: locale === 'pt' ? 'Inglês' : 'Português', value: altName }] : []),
              { label: 'Elemento', value: village.element },
              { label: 'Lema', value: village.motto },
              { label: 'Clima', value: village.climate },
              { label: 'Líder', value: village.leader },
            ]}
          />

          <div className="dossier-panel p-4">
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-ink-100">
              Outras Vilas
            </h3>
            <div className="space-y-2">
              {allVillages
                .filter((v) => v.id !== village.id)
                .map((v) => (
                  <Link
                    key={v.id}
                    href={`/village/${v.id}`}
                    className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-ink-800"
                  >
                    <WikiImage
                      src={v.image}
                      alt={`Emblema da ${localizedName(locale, v.name, v.namePt)}`}
                      fallback={v.emblem}
                      className="h-9 w-9 shrink-0 rounded-md"
                      imageClassName="object-contain p-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-ink-100">{localizedName(locale, v.name, v.namePt)}</p>
                      <p className="text-xs text-ink-400">{alternateName(locale, v.name, v.namePt)}</p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
