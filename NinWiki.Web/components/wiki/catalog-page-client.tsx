'use client';

// Parte INTERATIVA da pagina de catalogo (busca por texto, agrupamento
// por faixa de nivel que pode ser recolhido/expandido) - recebe os
// itens ja' buscados da API real como prop, vindos do Server Component
// pai (app/(wiki)/catalog/[category]/page.tsx). Precisa ser Client
// Component porque usa useState (texto da busca, secoes recolhidas).

import { WARDROBE_TYPES } from '@/lib/item-types';
import { useState, useMemo } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import { CatalogCard } from '@/components/wiki/catalog-card';
import { MobCard } from '@/components/wiki/mob-card';
import { GuideExtras } from '@/components/wiki/guide-extras';
import { GuideHub } from '@/components/wiki/guide-hub';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { ApiContentItemSummary, ApiAttribute, ApiStoryArc, ApiSummon, ApiGuideArticle } from '@/lib/api-client';
import type { Category } from '@/lib/types';

// Filtro exclusivo da categoria Items (26/09, pedido do Rafael): nem
// todo item cabe direito num dos 4 baldes abaixo sozinho - a
// combinacao foi decidida junto com ele: Ring = Equipment (e' o unico
// tipo de item que se "veste"); Consumable/Material ficam iguais;
// General+Currency+Cast viram "Special Items" (um balde catch-all pro
// que sobra, ao inves de criar mais filtros so' pra um tipo cada).
//
// SEM botao "All" de proposito (pedido explicito do Rafael, 27/09) -
// o estado null already mostra tudo sem filtro nenhum (usado so' como
// valor inicial e quando a pessoa clica de novo no filtro ja' ativo,
// pra' "desligar" ele), mas nao existe um botao VISIVEL com esse nome.
type ItemsFilterKey = 'consumables' | 'materials' | 'wardrobe' | 'ring' | 'pack' | 'special';

const ITEMS_FILTER_TYPES: Record<ItemsFilterKey, string[]> = {
  consumables: ['consumable'],
  materials: ['currency', 'material'],   // Moeda (currency) fica em Materials; 'material' so' existe em itens antigos
  wardrobe: [...WARDROBE_TYPES],     // Accessory e as pecas de roupa ficam juntos (Guarda-roupa)
  ring: ['ring'],                    // Ring tem categoria propria
  pack: ['pack'],                    // catalogo Pack
  special: ['general', 'cast', 'authority'],
};

interface EntryGroup {
  key: string;
  label: string;
  entries: ApiContentItemSummary[];
}

// Agrupa em faixas de 10 niveis (0-9, 10-19...) - mesma logica que
// getLevelGroups tinha em lib/data.ts, so' que operando na lista que
// veio da API em vez do mock.
function groupByLevel(items: ApiContentItemSummary[], levelRangeLabel: string): EntryGroup[] {
  const sorted = [...items].sort((a, b) => a.level - b.level);
  const groups: Record<string, ApiContentItemSummary[]> = {};
  for (const item of sorted) {
    const tier = Math.floor(item.level / 10);
    const key = `${tier * 10}-${tier * 10 + 9}`;
    (groups[key] ??= []).push(item);
  }
  return Object.entries(groups).map(([range, entries]) => ({ key: range, label: `${levelRangeLabel} ${range}`, entries }));
}

// Agrupa pelos 4 baldes de tipo (ver ITEMS_FILTER_TYPES acima), em vez
// de por nivel - so' usado na categoria Items (pedido do Rafael,
// 27/09: "Levels 0-9" nao fazia sentido pra' maioria dos itens, que
// nem tem nivel de verdade - ver shouldShowLevel em lib/utils.ts).
// SEMPRE devolve os 4 grupos, mesmo os vazios - filtrados fora depois
// pelo mesmo .filter(g => g.entries.length > 0) que ja existia pra
// busca por texto, entao um balde sem item nenhum simplesmente nao
// aparece, sem precisar de logica extra aqui.
//
// itemType === null cai em "Special Items" tambem (mesmo balde de
// "general") - sem isso, um item criado antes do campo item_type
// existir (ou uma entry onde ninguem escolheu um tipo ainda) nao
// batia com NENHUM dos 4 baldes e sumia da pagina inteira, sem
// aparecer em lugar nenhum - achado testando de verdade com uma
// entry assim.
function groupByItemType(items: ApiContentItemSummary[], labels: Record<ItemsFilterKey, string>): EntryGroup[] {
  return (Object.keys(ITEMS_FILTER_TYPES) as ItemsFilterKey[]).map((key) => ({
    key,
    label: labels[key],
    entries: items.filter((i) => (key === 'special' ? !i.itemType || ITEMS_FILTER_TYPES.special.includes(i.itemType) : i.itemType && ITEMS_FILTER_TYPES[key].includes(i.itemType))),
  }));
}

interface CatalogPageClientProps {
  items: ApiContentItemSummary[];
  category: Category;
  // Os 5 so' vem preenchidos quando category === 'guides' (o Server
  // Component pai so' busca eles nesse caso, pra' nao gastar 5
  // requisicoes a toa nas outras categorias) - por isso sao opcionais
  // aqui, com [] como padrao.
  guideAttributes?: ApiAttribute[];
  storyArcs?: ApiStoryArc[];
  summons?: ApiSummon[];
  guideArticles?: ApiGuideArticle[];   // artigos publicados do Guia (so' category === 'guides')
}

/** Listagem do catalogo de uma categoria, com busca e filtros. */
export function CatalogPageClient({
  items,
  category,
  guideAttributes = [],
  storyArcs = [],
  summons = [],
  guideArticles = [],
}: CatalogPageClientProps) {
  const { dict } = useLanguage();
  const [search, setSearch] = useState('');
  const [itemsFilter, setItemsFilter] = useState<ItemsFilterKey | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // So' tem efeito quando category === 'items' - nas outras categorias
  // itemsFilter fica sempre null (o filtro nem aparece na tela), entao
  // esse .filter() e' um no-op pras demais.
  const filteredByType = useMemo(() => {
    if (category !== 'items' || itemsFilter === null) return items;
    // Mesmo tratamento de itemType nulo que groupByItemType logo abaixo -
    // sem isso, clicar no filtro "Special Items" nao mostrava os itens
    // sem tipo nenhum definido, so' os que tem itemType === 'general'
    // explicitamente.
    if (itemsFilter === 'special') return items.filter((i) => !i.itemType || ITEMS_FILTER_TYPES.special.includes(i.itemType));
    const allowed = ITEMS_FILTER_TYPES[itemsFilter];
    return items.filter((i) => i.itemType && allowed.includes(i.itemType));
  }, [items, category, itemsFilter]);

  const itemsFilterLabels = useMemo<Record<ItemsFilterKey, string>>(
    () => ({
      consumables: dict.catalog.itemsFilterConsumables,
      materials: dict.catalog.itemsFilterMaterials,
      wardrobe: dict.catalog.itemsFilterWardrobe,
      ring: dict.catalog.itemsFilterRings,
      pack: dict.catalog.itemsFilterPack,
      special: dict.catalog.itemsFilterSpecial,
    }),
    [dict]
  );

  // Items agrupa por TIPO (Consumables/Materials/Equipment/Special
  // Items), nao por nivel - "Levels 0-9" nao dizia nada pra maioria
  // dos itens, que nem tem nivel de verdade (pedido do Rafael, 27/09).
  // Todas as outras categorias continuam agrupando por nivel, sem
  // mudanca nenhuma.
  const entryGroups = useMemo(
    () =>
      category === 'items'
        ? groupByItemType(filteredByType, itemsFilterLabels)
        : groupByLevel(filteredByType, dict.catalog.levelRange),
    [category, filteredByType, dict, itemsFilterLabels]
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entryGroups
      .map((group) => ({
        ...group,
        entries: q
          ? group.entries.filter((e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
          : group.entries,
      }))
      // Sem isso, um balde de tipo sem item nenhum (ex: "Equipment"
      // antes de qualquer Ring existir) apareceria como uma secao
      // vazia - grupos por nivel nunca tem esse problema (so' existem
      // se ja' tiverem pelo menos 1 item dentro), mas grupos por tipo
      // sempre vem os 4 juntos de groupByItemType, mesmo os vazios.
      .filter((g) => g.entries.length > 0);
  }, [search, entryGroups]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalFiltered = filteredGroups.reduce((sum, g) => sum + g.entries.length, 0);
  const noGuideArticles = category === 'guides' && totalFiltered === 0 && search === '';   // Guia ainda sem artigos: so' o 'Comece por aqui' e as abas (sem busca nem 'nenhum resultado')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {dict.nav[category]}
        </h1>
        {!noGuideArticles && (
          <p className="mt-1 text-sm text-muted-foreground">
            {totalFiltered} {dict.catalog.results}
          </p>
        )}
      </div>

      {category === 'guides' && <GuideHub articles={guideArticles} />}

      <div className={cn('relative mb-8 max-w-md', noGuideArticles && 'hidden')}>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict.catalog.search}
          className="pl-9"
        />
      </div>

      {/* Filtro de tipo - so' aparece na categoria Items (nem toda
          categoria tem essa divisao). So' os 4 baldes, SEM botao
          "Todos" (pedido explicito do Rafael, 27/09) - clicar num
          filtro ja' ativo desliga ele de novo (volta a mostrar tudo),
          em vez de precisar de um botao separado pra isso. */}
      {category === 'items' && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {(['consumables', 'materials', 'wardrobe', 'ring', 'pack', 'special'] as const).map((key) => {
            return (
              <button
                key={key}
                onClick={() => setItemsFilter((prev) => (prev === key ? null : key))}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  itemsFilter === key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                )}
              >
                {itemsFilterLabels[key]}
              </button>
            );
          })}
        </div>
      )}

      {noGuideArticles ? null : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">{dict.catalog.noResults}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredGroups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            return (
              <section key={group.key}>
                <button
                  onClick={() => toggleCollapse(group.key)}
                  className="mb-3 flex w-full items-center gap-2 text-left"
                >
                  <h2 className="text-lg font-bold tracking-tight">
                    {group.label}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    ({group.entries.length})
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.entries.map((entry) => (
                      category === 'mobs' || category === 'weapons' ? <MobCard key={entry.id} entry={entry} kind={category === 'weapons' ? 'weapon' : 'mob'} /> : <CatalogCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Conteudo extra exclusivo da categoria Guia: Atributos,
          Profissoes, Ranks Ninja, Story Arcs e Summons - nao sao
          ApiContentItemSummary, por isso ficam numa secao separada em
          vez de dentro da lista de cards acima. */}
      {category === 'guides' && (
        <GuideExtras
          attributes={guideAttributes}
          storyArcs={storyArcs}
          summons={summons}
        />
      )}
    </div>
  );
}
