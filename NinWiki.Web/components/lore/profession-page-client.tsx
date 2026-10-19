'use client';

// Conteudo da pagina de uma Profissao (rota /profession/[id]): descricao e tudo que o jogo tem dela - o que se coleta e o que cai, as receitas de criacao e as
// ferramentas. Client Component so' pra escolher os NOMES pelo idioma. A busca dos dados fica no Server Component app/(wiki)/(lore)/profession/[id]/page.tsx.

import Link from 'next/link';
import type { ApiProfession, ItemRef } from '@/lib/api-client';
import { PageHeader } from '@/components/lore/page-header';
import { useLanguage } from '@/components/providers/language-provider';
import { alternateName, localizedName, localizedText } from '@/lib/localized';
import { ArrowLeft, Hammer, Pickaxe } from 'lucide-react';

/** Nome de um item no idioma escolhido; vira link para a pagina dele quando ela existe e esta' publicada. */
function ItemLink({ item }: { item: ItemRef }) {
  const { locale } = useLanguage();
  const name = localizedName(locale, item.name, item.namePt);
  return item.slug ? <Link href={`/detail/${item.slug}`} className="text-primary hover:underline">{name}</Link> : <span>{name}</span>;
}

/** Pagina de uma profissao: descricao + recursos, receitas e ferramentas (so' as secoes que tem dados). */
export function ProfessionPageClient({ profession }: { profession: ApiProfession }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const name = localizedName(locale, profession.name, profession.namePt);
  const altName = alternateName(locale, profession.name, profession.namePt);
  const details = profession.details ?? {};
  const resources = details.resources ?? [];
  const recipes = details.recipes ?? [];
  const tools = details.tools ?? [];
  const GroupIcon = profession.group === 'gathering' ? Pickaxe : Hammer;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={name}
        subtitle={altName ?? undefined}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: dict.nav.guides, href: '/catalog/guides' }, { label: name }]}
        icon={<span className="text-3xl leading-none">{profession.icon}</span>}
      />

      <div className="space-y-6">
        <div className="dossier-panel p-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <GroupIcon className="h-3.5 w-3.5" /> {profession.group === 'gathering' ? t.guideGathering : t.guideCrafting}
          </p>
          <p className="text-sm leading-relaxed text-card-foreground">{localizedText(locale, profession.description, profession.descriptionPt)}</p>
        </div>

        {/* O que se coleta e o que cai (arvores, depositos de minerio, ervas...) */}
        {resources.length > 0 && (
          <section className="dossier-panel p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.professionResources}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {resources.map((r) => (
                <div key={r.name} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-sm font-semibold text-card-foreground">{r.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.professionYields}:{' '}
                    {r.loot.map((l, i) => (
                      <span key={l.name}>
                        {i > 0 && ', '}
                        {l.min === l.max ? l.min : `${l.min}–${l.max}`}× <ItemLink item={l} />
                      </span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Receitas de criacao */}
        {recipes.length > 0 && (
          <section className="dossier-panel p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.professionRecipes}</h2>
            <ul className="divide-y divide-border">
              {recipes.map((rec, i) => (
                <li key={i} className="py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-card-foreground"><ItemLink item={rec.result} /></span>
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">{t.professionLevel} {rec.level}</span>
                    {rec.workbench && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{t.professionWorkbench}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.professionNeeds}:{' '}
                    {rec.needs.map((n, k) => (
                      <span key={n.name}>
                        {k > 0 && ', '}
                        {n.qty}× <ItemLink item={n} />
                      </span>
                    ))}
                    {rec.learnedFrom && (
                      <span className="ml-2">· {t.professionLearnedFrom}: <ItemLink item={rec.learnedFrom} /></span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ferramentas (ex.: varas de pescar) */}
        {tools.length > 0 && (
          <section className="dossier-panel p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.professionTools}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {tools.map((tool) => (
                <li key={tool.name} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
                  <span className="font-medium text-card-foreground"><ItemLink item={tool} /></span>
                  {tool.level ? <span className="shrink-0 text-xs text-muted-foreground">{t.professionLevel} {tool.level}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {resources.length === 0 && recipes.length === 0 && tools.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.professionNoDetails}</p>
        )}

        <Link href="/catalog/guides" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> {t.professionBack}
        </Link>
      </div>
    </div>
  );
}
