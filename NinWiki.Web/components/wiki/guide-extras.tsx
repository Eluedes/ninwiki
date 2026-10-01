'use client';

// Conteudo extra exibido so' dentro da categoria "guides" do catalogo:
// Atributos, Profissoes, Ranks Ninja, Story Arcs e Summons. Nenhum
// deles e' um ContentItem (nao tem nivel, raridade, drops, etc.) - por
// isso nao entram na lista generica de cards do catalogo, e ganham sua
// propria secao com abas aqui. Todos os 5 vem como prop, ja' buscados
// da API real pelo Server Component pai (o catalogo so' busca isso
// quando category === 'guides', pra' nao desperdicar 5 requisicoes
// extras nas outras categorias).

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Pickaxe, Hammer, ArrowUp, ScrollText, Sparkle } from 'lucide-react';
import type { ApiAttribute, ApiProfession, ApiNinjaRank, ApiStoryArc, ApiSummon } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { alternateName, localizedName } from '@/lib/localized';

interface GuideExtrasProps {
  attributes: ApiAttribute[];
  professions: ApiProfession[];
  ninjaRanks: ApiNinjaRank[];
  storyArcs: ApiStoryArc[];
  summons: ApiSummon[];
}

/** Abas extras do Guia: atributos, profissoes, ranks, arcos e summons. */
export function GuideExtras({ attributes, professions, ninjaRanks, storyArcs, summons }: GuideExtrasProps) {
  const { locale } = useLanguage();
  const gathering = professions.filter((p) => p.group === 'gathering');
  const crafting = professions.filter((p) => p.group === 'crafting');
  // ninjaRanks ja' vem ordenado por hierarquia direto da API
  // (GET /ninja-ranks ordena por `order` no backend).
  const ranks = ninjaRanks;

  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold tracking-tight">Mais em Guias</h2>
      <Tabs defaultValue="attributes">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="attributes">Atributos</TabsTrigger>
          <TabsTrigger value="professions">Profissões</TabsTrigger>
          <TabsTrigger value="ranks">Ranks Ninja</TabsTrigger>
          <TabsTrigger value="arcs">Story Arcs</TabsTrigger>
          <TabsTrigger value="summons">Summons</TabsTrigger>
        </TabsList>

        {/* Atributos: reaproveita o mesmo array usado nas paginas de
            Mastery (lib/masteries-data.ts) - um so' lugar de verdade
            pra essa informacao, em vez de duplicar aqui. */}
        <TabsContent value="attributes" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {attributes.map((attr) => (
              <div key={attr.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {attr.name} {attr.namePt && <span className="font-normal text-muted-foreground">({attr.namePt})</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{attr.description}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="professions" className="mt-4 space-y-4">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Pickaxe className="h-3.5 w-3.5" /> Coleta
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {gathering.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <span className="text-xl leading-none">{p.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{localizedName(locale, p.name, p.namePt)}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Hammer className="h-3.5 w-3.5" /> Criação
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {crafting.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                  <span className="text-xl leading-none">{p.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{localizedName(locale, p.name, p.namePt)}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Ranks: exibidos em ordem, do mais baixo ao mais alto, com
            uma seta indicando a progressao entre eles. */}
        <TabsContent value="ranks" className="mt-4">
          <div className="space-y-2">
            {ranks.map((rank, i) => (
              <div key={rank.id}>
                {i > 0 && <ArrowUp className="mx-auto my-1 h-4 w-4 text-muted-foreground" />}
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-sm font-semibold text-card-foreground">
                    {localizedName(locale, rank.name, rank.namePt)}{alternateName(locale, rank.name, rank.namePt) && <span className="font-normal text-muted-foreground"> ({alternateName(locale, rank.name, rank.namePt)})</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{rank.description}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Story Arcs: capitulos de conteudo narrativo, mais recente
            primeiro (nao ha ordenacao automatica - a ordem no array de
            dados e' a ordem de exibicao, entao arcos novos entram no
            topo de lib/guide-data.ts). */}
        <TabsContent value="arcs" className="mt-4">
          <div className="space-y-2">
            {storyArcs.map((arc) => (
              <div key={arc.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {arc.name} <span className="font-normal text-muted-foreground">· Nv. {arc.levelRange}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{arc.description}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Summons: cada invocacao tem 3 estagios (Jovem/Adolescente/
            Adulta) - exibidos como uma mini-lista dentro do card, em
            vez de precisar de uma pagina de detalhe separada por enquanto. */}
        <TabsContent value="summons" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {summons.map((summon) => (
              <div key={summon.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-2">
                  <Sparkle className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm font-semibold text-card-foreground">
                    {localizedName(locale, summon.name, summon.namePt)}{alternateName(locale, summon.name, summon.namePt) && <span className="font-normal text-muted-foreground"> ({alternateName(locale, summon.name, summon.namePt)})</span>}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{summon.village}</p>
                <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <li>1. {summon.stageYoung}</li>
                  <li>2. {summon.stageTeen}</li>
                  <li>3. {summon.stageAdult}</li>
                </ol>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
