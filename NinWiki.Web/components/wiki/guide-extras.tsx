'use client';

// Conteudo extra exibido so' dentro da categoria "guides" do catalogo:
// Atributos, Story Arcs e Summons (as Profissoes tem secao propria em /proficiencies; aqui so' um quadro com atalhos). Nenhum
// deles e' um ContentItem (nao tem nivel, raridade, drops, etc.) - por
// isso nao entram na lista generica de cards do catalogo, e ganham sua
// propria secao com abas aqui. Todos os 5 vem como prop, ja' buscados
// da API real pelo Server Component pai (o catalogo so' busca isso
// quando category === 'guides', pra' nao desperdicar 5 requisicoes
// extras nas outras categorias).

import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, ScrollText, Sparkle } from 'lucide-react';
import type { ApiAttribute, ApiStoryArc, ApiSummon } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { alternateName, localizedName, localizedText } from '@/lib/localized';

interface GuideExtrasProps {
  attributes: ApiAttribute[];
  storyArcs: ApiStoryArc[];
  summons: ApiSummon[];
}

/** Abas extras do Guia: atributos, profissoes, arcos e summons (os ranks ninja saíram do Guia). */
export function GuideExtras({ attributes, storyArcs, summons }: GuideExtrasProps) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;

  return (
    <div className="mt-10 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold tracking-tight">{t.guideMore}</h2>
      <Tabs defaultValue="attributes">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="attributes">{t.guideAttributes}</TabsTrigger>
          <TabsTrigger value="arcs">{t.guideArcs}</TabsTrigger>
          <TabsTrigger value="summons">{t.guideSummons}</TabsTrigger>
        </TabsList>

        {/* Atributos: reaproveita o mesmo array usado nas paginas de
            Mastery - um so' lugar de verdade
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
                  <p className="text-xs text-muted-foreground">{localizedText(locale, attr.description, attr.descriptionPt)}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Story Arcs: capitulos de conteudo narrativo, mais recente
            primeiro (nao ha ordenacao automatica - a ordem no array de
            dados e' a ordem de exibicao, entao arcos novos entram no
            topo da pagina). */}
        <TabsContent value="arcs" className="mt-4">
          <div className="space-y-2">
            {storyArcs.map((arc) => (
              <div key={arc.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
                <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {localizedName(locale, arc.name, arc.namePt)} <span className="font-normal text-muted-foreground">· {locale === 'pt' ? 'Nv.' : 'Lv.'} {arc.levelRange}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{localizedText(locale, arc.description, arc.descriptionPt)}</p>
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
                <p className="mt-1 text-xs text-muted-foreground">{localizedText(locale, summon.village, summon.villagePt)}</p>
                <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  <li>1. {localizedText(locale, summon.stageYoung, summon.stageYoungPt)}</li>
                  <li>2. {localizedText(locale, summon.stageTeen, summon.stageTeenPt)}</li>
                  <li>3. {localizedText(locale, summon.stageAdult, summon.stageAdultPt)}</li>
                </ol>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
