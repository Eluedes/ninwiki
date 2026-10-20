'use client';

// Pagina de UMA Proficiencia (rota /proficiencies/[id]): descricao, bonus de habilidade, dicas e tudo que o jogo tem dela - o que se coleta e o que cai,
// as receitas de criacao (com busca), as ferramentas e seus precos. Client Component so' pra escolher os NOMES pelo idioma e filtrar as receitas.
// A busca dos dados fica no Server Component app/(wiki)/(lore)/proficiencies/[id]/page.tsx.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ApiProfession } from '@/lib/api-client';
import { PageHeader } from '@/components/lore/page-header';
import { ItemRefChip, itemImageUrl } from '@/components/lore/item-ref-chip';
import { WikiImage } from '@/components/wiki/wiki-image';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { alternateName, localizedName, localizedText } from '@/lib/localized';
import { ArrowLeft, Hammer, Lightbulb, Pickaxe, Search } from 'lucide-react';

/** Dicas por proficiencia (valores registrados pela comunidade; o jogo pode mudar). */
const TIPS: Record<string, { en: string[]; pt: string[] }> = {
  fishing: {
    en: ['Any stretch of water of roughly 2×2 tiles or more works as a fishing spot, so most rivers, lakes and coastlines will do.'],
    pt: ['Qualquer trecho de água de uns 2×2 tiles ou mais serve como ponto de pesca; a maioria dos rios, lagos e costas funciona.'],
  },
  woodcutting: {
    en: ['Tree health: small trees 40, tall thin trees about 57, big trees 80. Hits needed = tree health ÷ your damage.'],
    pt: ['Vida das árvores: pequenas 40, altas e finas cerca de 57, grandes 80. Golpes necessários = vida da árvore ÷ seu dano.'],
  },
  cooking: {
    en: ['Dishes heal you or give stat buffs for 30 minutes. Recipes in the same crafting group share the same kind of effect.'],
    pt: ['Os pratos curam ou dão bônus de atributo por 30 minutos. Receitas do mesmo grupo de criação têm o mesmo tipo de efeito.'],
  },
  weaving: {
    en: ['Weaving opens up when you have access to a Workbench. Some recipes are not known by default and only drop from mobs.'],
    pt: ['A Tecelagem libera quando você tem acesso a uma Bancada. Algumas receitas não são conhecidas de início e só caem de monstros.'],
  },
};

/** Pagina de uma proficiencia: descricao + dicas + recursos, receitas e ferramentas (so' as secoes que tem dados). */
export function ProfessionPageClient({ profession }: { profession: ApiProfession }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const [query, setQuery] = useState('');
  const name = localizedName(locale, profession.name, profession.namePt);
  const altName = alternateName(locale, profession.name, profession.namePt);
  const details = profession.details;
  const resources = useMemo(() => details?.resources ?? [], [details]);
  const recipes = useMemo(() => details?.recipes ?? [], [details]);
  const tools = useMemo(() => [...(details?.tools ?? [])].sort((a, b) => (a.price?.amount ?? 0) - (b.price?.amount ?? 0)), [details]);   // mais baratas primeiro
  const GroupIcon = profession.group === 'gathering' ? Pickaxe : Hammer;
  const tips = TIPS[profession.id]?.[locale === 'pt' ? 'pt' : 'en'] ?? [];

  const shownRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.result.name.toLowerCase().includes(q) || (r.result.namePt ?? '').toLowerCase().includes(q)
      || r.needs.some((n) => n.name.toLowerCase().includes(q) || (n.namePt ?? '').toLowerCase().includes(q)));
  }, [recipes, query]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={name}
        subtitle={altName ?? undefined}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: t.proficienciesCrumb, href: '/proficiencies' }, { label: name }]}
        icon={<span className="text-3xl leading-none">{profession.icon}</span>}
      />

      <div className="space-y-6">
        <div className="dossier-panel p-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <GroupIcon className="h-3.5 w-3.5" /> {profession.group === 'gathering' ? t.guideGathering : t.guideCrafting}
          </p>
          <p className="text-sm leading-relaxed text-card-foreground">{localizedText(locale, profession.description, profession.descriptionPt)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {recipes.length > 0 && <span className="rounded bg-secondary px-2 py-1 text-muted-foreground">{t.profRecipesCount.replace('{n}', String(recipes.length))}</span>}
            {resources.length > 0 && <span className="rounded bg-secondary px-2 py-1 text-muted-foreground">{t.profResourcesCount.replace('{n}', String(resources.length))}</span>}
            {tools.length > 0 && <span className="rounded bg-secondary px-2 py-1 text-muted-foreground">{t.profToolsCount.replace('{n}', String(tools.length))}</span>}
            <Link href="/proficiencies" className="rounded bg-primary/15 px-2 py-1 font-medium text-primary hover:underline">{t.profHowTitle} →</Link>
          </div>
        </div>

        {tips.length > 0 && (
          <div className="dossier-panel p-5">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-card-foreground"><Lightbulb className="h-4 w-4 text-primary" /> {t.profTipsTitle}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
              {tips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
        )}

        {/* O que se coleta e o que cai (arvores, depositos de minerio, ervas...) */}
        {resources.length > 0 && (
          <section className="dossier-panel p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.professionResources}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {resources.map((r) => (
                <div key={r.name} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-sm font-semibold text-card-foreground">{r.name}</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {r.loot.map((l) => (
                      <li key={l.name}>
                        <ItemRefChip item={l} prefix={`${l.min === l.max ? l.min : `${l.min}–${l.max}`}× `} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Receitas de criacao, com busca por resultado ou ingrediente */}
        {recipes.length > 0 && (
          <section className="dossier-panel p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-ink-100">{t.professionRecipes}</h2>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.profSearch} className="pl-9" />
              </div>
            </div>
            {shownRecipes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.profNoMatch}</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {shownRecipes.map((rec, i) => (
                  <li key={`${rec.result.name}-${i}`} className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-card-foreground"><ItemRefChip item={rec.result} /></span>
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">{t.professionLevel} {rec.level}</span>
                      {rec.workbench && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{t.professionWorkbench}</span>}
                    </div>
                    <p className="mb-1 mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.professionNeeds}</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {rec.needs.map((n) => (
                        <li key={n.name}><ItemRefChip item={n} prefix={`${n.qty}× `} /></li>
                      ))}
                    </ul>
                    {rec.learnedFrom && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{t.professionLearnedFrom}: <ItemRefChip item={rec.learnedFrom} /></div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Ferramentas (ex.: varas de pescar), com o preco na loja */}
        {tools.length > 0 && (
          <section className="dossier-panel p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.professionTools}</h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.name} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
                  <WikiImage
                    src={itemImageUrl(tool.image)}
                    alt=""
                    fallback={<span className="text-xs font-bold text-muted-foreground">{tool.name.charAt(0)}</span>}
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary/60"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-card-foreground">
                      {tool.slug ? <Link href={`/detail/${tool.slug}`} className="text-primary hover:underline">{localizedName(locale, tool.name, tool.namePt)}</Link> : localizedName(locale, tool.name, tool.namePt)}
                    </p>
                    {tool.price && <p className="text-xs text-muted-foreground">{t.profPrice}: {tool.price.amount.toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US')} {tool.price.currency}</p>}
                  </div>
                  {tool.level ? <span className="shrink-0 text-xs text-muted-foreground">{t.professionLevel} {tool.level}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {resources.length === 0 && recipes.length === 0 && tools.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.professionNoDetails}</p>
        )}

        <p className="text-xs text-muted-foreground">{t.profSources}</p>

        <Link href="/proficiencies" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> {t.professionBack}
        </Link>
      </div>
    </div>
  );
}
