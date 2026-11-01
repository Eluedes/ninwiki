'use client';

// Pagina de UMA Proficiencia (rota /proficiencies/[id]): descricao, bonus de habilidade, dicas e tudo que o jogo tem dela - o que se coleta e o que cai,
// as receitas de criacao (com busca e filtros), as ferramentas e seus precos, em abas (so' as que tem dados). Client Component so' pra escolher os NOMES
// pelo idioma, filtrar as receitas e achar no mapa onde cada recurso e' coletado.
// A busca dos dados fica no Server Component app/(wiki)/(lore)/proficiencies/[id]/page.tsx.

import { cn, formatNumber } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ApiProfession } from '@/lib/api-client';
import { PageHeader } from '@/components/lore/page-header';
import { ItemRefChip, itemImageUrl } from '@/components/lore/item-ref-chip';
import { WikiImage } from '@/components/wiki/wiki-image';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/components/providers/language-provider';
import { alternateName, localizedName, localizedText } from '@/lib/localized';
import { ArrowLeft, Hammer, Lightbulb, MapPin, Pickaxe, Search } from 'lucide-react';

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

/** Onde cada recurso aparece no mapa: {nome do recurso: [{id da area, nome da area, quantidade}]}, a partir do json estatico do mapa (areas-info.json). */
type OndeColetar = Record<string, { id: string; name: [string, string]; n: number }[]>;

/** Baixa o json do mapa uma vez (so' quando a aba Recursos abre) e monta o indice recurso -> areas. Falhou = vazio (a linha "onde coletar" some). */
function useOndeColetar(ativo: boolean): OndeColetar | null {
  const [onde, setOnde] = useState<OndeColetar | null>(null);
  useEffect(() => {
    if (!ativo || onde) return;
    fetch('/game-maps/areas-info.json')
      .then((r) => r.json() as Promise<{ names: Record<string, [string, string]>; areas: Record<string, { res?: [string, string, number][] }> }>)
      .then((j) => {
        const idx: OndeColetar = {};
        for (const [id, a] of Object.entries(j.areas)) {
          for (const [nome, , n] of a.res ?? []) (idx[nome] ??= []).push({ id, name: j.names[id] ?? [`#${id}`, `#${id}`], n });
        }
        for (const l of Object.values(idx)) l.sort((x, y) => y.n - x.n);   // as areas com mais unidades primeiro
        setOnde(idx);
      })
      .catch(() => setOnde({}));
  }, [ativo, onde]);
  return onde;
}

/** Chip de filtro (liga/desliga) no estilo do site. */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
      {children}
    </button>
  );
}

/** Pagina de uma proficiencia: cabecalho + abas (Visao geral, Recursos, Receitas, Ferramentas) - so' as abas que tem dados. */
export function ProfessionPageClient({ profession }: { profession: ApiProfession }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<number | null>(null);        // nivel exato escolhido (null = todos)
  const [bench, setBench] = useState<boolean | null>(null);       // precisa de bancada? (null = tanto faz)
  const [learn, setLearn] = useState<boolean | null>(null);       // precisa aprender com um item? (null = tanto faz)
  const [tab, setTab] = useState('overview');
  const [destaque, setDestaque] = useState<string | null>(null);   // slug da receita vinda da ficha do item (#recipe-<slug>): abre a aba e rola ate' ela
  // A hash e' lida no quadro seguinte (a navegacao do Next ja' atualizou a URL) e o setState fica fora do corpo do efeito.
  useEffect(() => {
    requestAnimationFrame(() => {
      const m = /^#recipe-(.+)$/.exec(window.location.hash);
      if (!m) return;
      setDestaque(decodeURIComponent(m[1]));
      setTab('recipes');
    });
  }, []);
  useEffect(() => {
    if (tab !== 'recipes' || !destaque) return;
    requestAnimationFrame(() => document.getElementById(`recipe-${destaque}`)?.scrollIntoView({ block: 'center' }));
  }, [tab, destaque]);
  const name = localizedName(locale, profession.name, profession.namePt);
  const altName = alternateName(locale, profession.name, profession.namePt);
  const details = profession.details;
  const resources = useMemo(() => details?.resources ?? [], [details]);
  const recipes = useMemo(() => details?.recipes ?? [], [details]);
  const tools = useMemo(() => [...(details?.tools ?? [])].sort((a, b) => (a.price?.amount ?? 0) - (b.price?.amount ?? 0)), [details]);   // mais baratas primeiro
  const GroupIcon = profession.group === 'gathering' ? Pickaxe : Hammer;
  const tips = TIPS[profession.id]?.[locale === 'pt' ? 'pt' : 'en'] ?? [];
  const onde = useOndeColetar(tab === 'resources' && resources.length > 0);
  const levels = useMemo(() => [...new Set(recipes.map((r) => r.level))].sort((a, b) => a - b), [recipes]);
  const anyBench = recipes.some((r) => r.workbench);
  const anyLearn = recipes.some((r) => r.learnedFrom);

  const shownRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hit = (i: { name: string; namePt?: string | null }) => i.name.toLowerCase().includes(q) || (i.namePt ?? '').toLowerCase().includes(q);
    return recipes.filter((r) => (level === null || r.level === level) && (bench === null || r.workbench === bench) && (learn === null || Boolean(r.learnedFrom) === learn)
      && (!q || hit(r.result) || r.needs.some(hit)));
  }, [recipes, query, level, bench, learn]);
  const filtering = query !== '' || level !== null || bench !== null || learn !== null;
  const clear = () => { setQuery(''); setLevel(null); setBench(null); setLearn(null); };

  // Numeros da visao geral (cada um leva para a aba correspondente)
  const stats = [
    recipes.length > 0 && { k: 'recipes', label: t.profRecipesCount.replace('{n}', String(recipes.length)) },
    resources.length > 0 && { k: 'resources', label: t.profResourcesCount.replace('{n}', String(resources.length)) },
    tools.length > 0 && { k: 'tools', label: t.profToolsCount.replace('{n}', String(tools.length)) },
  ].filter(Boolean) as { k: string; label: string }[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={name}
        subtitle={altName ?? undefined}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: t.proficienciesCrumb, href: '/proficiencies' }, { label: name }]}
        icon={<span className="text-3xl leading-none">{profession.icon}</span>}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-secondary/40 p-1">
          <TabsTrigger value="overview">{t.profTabOverview}</TabsTrigger>
          {resources.length > 0 && <TabsTrigger value="resources">{t.profTabResources} <span className="ml-1.5 text-xs text-muted-foreground">{resources.length}</span></TabsTrigger>}
          {recipes.length > 0 && <TabsTrigger value="recipes">{t.profTabRecipes} <span className="ml-1.5 text-xs text-muted-foreground">{recipes.length}</span></TabsTrigger>}
          {tools.length > 0 && <TabsTrigger value="tools">{t.profTabTools} <span className="ml-1.5 text-xs text-muted-foreground">{tools.length}</span></TabsTrigger>}
        </TabsList>

        {/* Visao geral: descricao, numeros (levam para a aba) e dicas */}
        <TabsContent value="overview" className="space-y-4">
          <div className="dossier-panel p-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <GroupIcon className="h-3.5 w-3.5" /> {profession.group === 'gathering' ? t.guideGathering : t.guideCrafting}
            </p>
            <p className="text-sm leading-relaxed text-card-foreground">{localizedText(locale, profession.description, profession.descriptionPt)}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {stats.map((s) => (
                <button key={s.k} type="button" onClick={() => setTab(s.k)} className="rounded-full border border-border px-3 py-1 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">{s.label}</button>
              ))}
              {levels.length > 0 && <span className="rounded-full bg-secondary px-3 py-1 text-muted-foreground">{t.profLevelRange.replace('{a}', String(levels[0])).replace('{b}', String(levels[levels.length - 1]))}</span>}
              <Link href="/proficiencies" className="rounded-full bg-primary/15 px-3 py-1 font-medium text-primary hover:underline">{t.profHowTitle} →</Link>
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
          {stats.length === 0 && <p className="dossier-panel p-5 text-sm text-muted-foreground">{t.professionNoDetails}</p>}
        </TabsContent>

        {/* Recursos: o que cai de cada um e onde coletar (areas do mapa, quando o dado existe) */}
        <TabsContent value="resources">
          <div className="grid gap-3 sm:grid-cols-2">
            {resources.map((r) => {
              const areas = onde?.[r.name] ?? [];
              return (
                <div key={r.name} className="dossier-panel p-4">
                  <p className="font-display text-base font-bold text-ink-100">{r.name}</p>
                  <p className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.profDrops}</p>
                  <ul className="space-y-1.5 text-sm text-card-foreground">
                    {r.loot.map((l) => (
                      <li key={l.name}><ItemRefChip item={l} prefix={`${l.min === l.max ? l.min : `${l.min}–${l.max}`}× `} /></li>
                    ))}
                  </ul>
                  {areas.length > 0 && (
                    <>
                      <p className="mb-1 mt-3 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><MapPin className="h-3 w-3" /> {t.profWhere}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {areas.slice(0, 6).map((a) => (
                          <Link key={a.id} href={`/map#map/${a.id}`} title={t.profOnMap} className="rounded-full border border-border px-2 py-0.5 text-xs text-primary transition-colors hover:border-primary/50 hover:underline">
                            {locale === 'pt' ? a.name[1] : a.name[0]} <span className="text-muted-foreground">×{a.n}</span>
                          </Link>
                        ))}
                        {areas.length > 6 && <span className="px-1 py-0.5 text-xs text-muted-foreground">+{areas.length - 6}</span>}
                      </div>
                    </>
                  )}
                  {onde && areas.length === 0 && <p className="mt-3 text-xs text-muted-foreground">{t.profWhereNone}</p>}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Receitas: busca + filtros (nivel, bancada, como aprende); cada linha mostra o resultado e os ingredientes com miniatura e link */}
        <TabsContent value="recipes" className="space-y-3">
          <div className="dossier-panel space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.profSearch} className="pl-9" />
              </div>
              <select value={level ?? ''} onChange={(e) => setLevel(e.target.value === '' ? null : Number(e.target.value))} aria-label={t.professionLevel}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                <option value="">{t.profLevelAll}</option>
                {levels.map((lv) => <option key={lv} value={lv}>{t.professionLevel} {lv}</option>)}
              </select>
            </div>
            {(anyBench || anyLearn) && (
              <div className="flex flex-wrap gap-2">
                {anyBench && <><Chip on={bench === true} onClick={() => setBench(bench === true ? null : true)}>{t.profBenchYes}</Chip><Chip on={bench === false} onClick={() => setBench(bench === false ? null : false)}>{t.profBenchNo}</Chip></>}
                {anyLearn && <><Chip on={learn === false} onClick={() => setLearn(learn === false ? null : false)}>{t.profLearnKnown}</Chip><Chip on={learn === true} onClick={() => setLearn(learn === true ? null : true)}>{t.profLearnItem}</Chip></>}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t.profShowing.replace('{n}', String(shownRecipes.length)).replace('{m}', String(recipes.length))} · {t.profSortLevel}</span>
              {filtering && <button type="button" onClick={clear} className="text-primary hover:underline">{t.profClear}</button>}
            </div>
          </div>

          {shownRecipes.length === 0 ? (
            <div className="dossier-panel p-8 text-center">
              <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.profNoMatch}</p>
              {filtering && <button type="button" onClick={clear} className="mt-2 text-sm text-primary hover:underline">{t.profClear}</button>}
            </div>
          ) : (
            <ul className="space-y-2">
              {shownRecipes.map((rec, i) => (
                <li key={`${rec.result.name}-${i}`} id={rec.result.slug ? `recipe-${rec.result.slug}` : undefined}
                  className={cn('dossier-panel flex scroll-mt-24 flex-col gap-3 p-3 text-sm md:flex-row md:items-center', rec.result.slug && rec.result.slug === destaque && 'ring-2 ring-primary')}>
                  <div className="flex min-w-0 items-center gap-3 md:w-72 md:shrink-0">
                    <WikiImage
                      src={itemImageUrl(rec.result.image)}
                      alt=""
                      fallback={<span className="text-sm font-bold text-muted-foreground">{rec.result.name.charAt(0)}</span>}
                      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/60"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-card-foreground">
                        {rec.result.slug
                          ? <Link href={`/detail/${rec.result.slug}`} className="text-primary hover:underline">{localizedName(locale, rec.result.name, rec.result.namePt)}</Link>
                          : localizedName(locale, rec.result.name, rec.result.namePt)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">{t.professionLevel} {rec.level}</span>
                        {rec.workbench && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{t.professionWorkbench}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 border-border md:border-l md:pl-4">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.professionNeeds}</p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-card-foreground">
                      {rec.needs.map((n) => <li key={n.name}><ItemRefChip item={n} prefix={`${n.qty}× `} /></li>)}
                    </ul>
                    {rec.learnedFrom && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{t.professionLearnedFrom}: <ItemRefChip item={rec.learnedFrom} /></div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Ferramentas (ex.: varas de pescar), com o preco na loja */}
        <TabsContent value="tools">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool.name} className="dossier-panel flex items-center gap-3 px-3 py-2 text-sm">
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
                  {tool.price && <p className="text-xs text-muted-foreground">{t.profPrice}: {formatNumber(tool.price.amount, locale)} {tool.price.currency}</p>}
                </div>
                {tool.level ? <span className="shrink-0 text-xs text-muted-foreground">{t.professionLevel} {tool.level}</span> : null}
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">{t.profSources}</p>
      <Link href="/proficiencies" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t.professionBack}
      </Link>
    </div>
  );
}
