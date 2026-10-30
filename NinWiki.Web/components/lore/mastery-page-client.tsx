'use client';

// Parte INTERATIVA da pagina de detalhe de uma Mastery (i18n via
// useLanguage) - recebe mastery/jutsus/atributos ja' buscados da API
// real como props, vindos do Server Component pai
// (app/(wiki)/(lore)/masteries/[id]/page.tsx). Precisa ser Client
// Component pra' poder escolher name/englishName e description/
// descriptionPt conforme o idioma (useLanguage e' um hook de React,
// nao funciona num Server Component async).

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { JutsuCard } from '@/components/lore/jutsu-card';
import { Infobox } from '@/components/lore/infobox';
import { ReportButton } from '@/components/report/report-button';
import { PageHeader } from '@/components/lore/page-header';
import { MasteryVisual } from '@/components/lore/mastery-visual';
import { RichText } from '@/components/lore/rich-text';
import { Zap, Brain } from 'lucide-react';
import type { ApiMastery, ApiJutsu, ApiAttribute } from '@/lib/api-client';

/** Pagina de uma mastery: caminhos, jutsus e ficha. */
export function MasteryPageClient({
  mastery,
  masteryJutsus,
  attributes,
}: {
  mastery: ApiMastery;
  masteryJutsus: ApiJutsu[];
  attributes: ApiAttribute[];
}) {
  const { dict, locale } = useLanguage();
  const t = dict.masteryDetail;
  const isPt = locale === 'pt';
  const name = isPt ? (mastery.namePt ?? mastery.name) : mastery.name;
  const altName = isPt ? mastery.name : null;   // em EN nao mostra o nome em portugues
  // Fallback nos DOIS sentidos - ver mesmo comentario em mastery-card.tsx
  // (o texto ja existente e' portugues de verdade, so' vira ingles
  // depois do backfill ou de alguem escrever a mao).
  const longDescription = isPt
    ? (mastery.longDescriptionPt || mastery.longDescription)
    : (mastery.longDescription || mastery.longDescriptionPt);

  const attributeMap = new Map(attributes.map((a) => [a.id, a]));
  const jutsusByPath = (pathId: string): ApiJutsu[] => masteryJutsus.filter((j) => j.pathId === pathId);
  // jutsus sem caminho (ou com caminho que nao existe mais) NAO podem sumir da pagina: vao para a secao "Outros jutsus" abaixo dos caminhos
  const pathIds = new Set(mastery.paths.map((p) => p.id));
  const unpathedJutsus = masteryJutsus.filter((j) => !j.pathId || !pathIds.has(j.pathId));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={name}
        subtitle={
          altName
            ? `${altName} · ${mastery.type === 'elemental' ? t.elemental : t.nonElemental}`
            : mastery.type === 'elemental' ? t.elemental : t.nonElemental
        }
        breadcrumbs={[
          { label: t.home, href: '/' },
          { label: 'Masteries', href: '/masteries' },
          { label: name },
        ]}
        icon={
          <MasteryVisual
            image={mastery.image}
            icon={mastery.icon}
            alt={name}
            className="h-12 w-12 rounded-lg"
          />
        }
        accentColor={mastery.color}
        action={<ReportButton targetType="mastery" targetId={mastery.id} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="dossier-panel p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.aboutMastery}</h2>
            <RichText content={longDescription ?? ''} />
          </div>

          {mastery.paths.length > 0 ? (
            <div className="space-y-6">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5" style={{ color: mastery.color }} />
                <h2 className="font-display text-lg font-bold text-ink-100">
                  {t.masteryPaths}
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {mastery.paths.map((path) => {
                  const pathJutsus = jutsusByPath(path.id);
                  return (
                    <section
                      key={path.id}
                      className="dossier-panel overflow-hidden"
                      style={{ borderTopColor: mastery.color, borderTopWidth: '2px' }}
                    >
                      <div className="border-b border-ink-700/70 bg-ink-850/40 p-4">
                        <h3 className="font-display text-base font-bold text-ink-100">{path.label}</h3>
                        <p className="mt-1 text-sm text-ink-300">{path.description}</p>
                        {path.requirement && (
                          <p className="mt-3 border-l-2 pl-3 text-xs font-semibold text-gold-300" style={{ borderColor: mastery.color }}>
                            {path.requirement}
                          </p>
                        )}
                      </div>
                      <div className="p-4">
                        {pathJutsus.length > 0 ? (
                          <div className="space-y-3">
                            {pathJutsus.map((jutsu) => <JutsuCard key={jutsu.id} jutsu={jutsu} mastery={mastery} />)}
                          </div>
                        ) : (
                          <p className="rounded-md border border-dashed border-ink-700 px-3 py-4 text-sm text-ink-400">
                            {t.noJutsusInPath}
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>

              {unpathedJutsus.length > 0 && (
                <div>
                  <h3 className="mb-3 font-display text-base font-bold text-ink-100">{t.otherJutsus} ({unpathedJutsus.length})</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {unpathedJutsus.map((j) => <JutsuCard key={j.id} jutsu={j} mastery={mastery} />)}
                  </div>
                </div>
              )}
            </div>
          ) : (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: mastery.color }} />
              <h2 className="font-display text-lg font-bold text-ink-100">
                {t.jutsusOfMastery} ({masteryJutsus.length})
              </h2>
            </div>
            {masteryJutsus.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {masteryJutsus.map((j) => (
                  <JutsuCard key={j.id} jutsu={j} mastery={mastery} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-400">{t.noJutsusYet}</p>
            )}
          </div>
          )}
        </div>

        <div className="space-y-4">
          <Infobox
            title={t.masterySheet}
            image={mastery.gif}
            icon={
              <MasteryVisual
                image={mastery.image}
                icon={mastery.icon}
                alt={name}
                className="h-7 w-7 rounded"
              />
            }
            accentColor={mastery.color}
            entries={[
              { label: t.nameLabel, value: name },
              { label: t.typeLabel, value: mastery.type === 'elemental' ? t.elemental : t.nonElemental },
              // So' mostra a linha "Elemento" quando a mastery E' elemental -
              // pra "Nao-elemental" (Arma, Taijutsu, Medical...) nao faz
              // sentido nenhum mostrar um elemento, mesmo que o campo
              // `element` do banco tenha algum valor tecnico la' dentro
              // (ex: "Weapon") - isso nunca foi pensado pra aparecer pro
              // usuario nesse caso.
              ...(mastery.type === 'elemental' ? [{ label: t.elementLabel, value: mastery.element }] : []),
              { label: t.jutsusLabel, value: masteryJutsus.length.toString() },
            ]}
          />

          <div className="dossier-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-chakra-400" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink-100">
                {t.relatedAttributes}
              </h3>
            </div>
            <div className="space-y-2">
              {mastery.attributeIds.length === 0 && (
                <p className="text-sm text-ink-400">
                  {t.noAttributesConfirmed}
                </p>
              )}
              {mastery.attributeIds.map((attrId) => {
                const attr = attributeMap.get(attrId);
                if (!attr) return null;
                return (
                  <div key={attrId} className="rounded-md border border-ink-700 bg-ink-850/50 p-3">
                    <p className="text-sm font-semibold text-ink-100">{isPt ? (attr.namePt ?? attr.name) : attr.name}</p>
                    <p className="text-xs text-ink-400">{isPt ? (attr.descriptionPt || attr.description) : attr.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
