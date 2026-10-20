'use client';

// Parte INTERATIVA da pagina de detalhe (botao de copiar atributos,
// i18n via useLanguage) - recebe a entry e as relacionadas ja'
// buscadas da API real como prop, vindas do Server Component pai
// (app/(wiki)/detail/[id]/page.tsx).

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { ReportButton } from '@/components/report/report-button';
import { DetailSidebar } from '@/components/wiki/detail-sidebar';
import { CatalogCard } from '@/components/wiki/catalog-card';
import { WikiImage } from '@/components/wiki/wiki-image';
import { RichText, extractPlainText } from '@/components/lore/rich-text';
import { cn, itemHasStack, shouldShowLevel, levelText, signedValue } from '@/lib/utils';
import { rarityConfig } from '@/lib/data';
import { itemTypeLabels } from '@/lib/item-types';
import { ArrowLeft, Heart, Languages, Layers, Scale, Swords, Star, Zap, Sparkles, type LucideIcon } from 'lucide-react';
import type { ApiContentItem, ApiContentItemSummary } from '@/lib/api-client';

/** Selo do subtipo do mob (o mob comum nao tem selo). */
const MOB_TYPE_LABEL: Record<string, { en: string; pt: string; className: string }> = {
  boss: { en: 'Boss', pt: 'Chefe', className: 'bg-red-500/15 text-red-400' },
  npc: { en: 'NPC', pt: 'NPC', className: 'bg-sky-500/15 text-sky-400' },
  mount: { en: 'Mount', pt: 'Montaria', className: 'bg-amber-500/15 text-amber-400' },
};

/** Cartao grande de um numero de combate (vida, dano, experiencia) do bestiario. */
function StatTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', tone)}>
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={cn('mt-1.5 font-bold text-card-foreground', value.length > 14 ? 'text-base leading-snug' : 'text-2xl tabular-nums')}>{value}</p>
    </div>
  );
}

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
  const isMob = entry.category === 'mobs';
  const isWeapon = entry.category === 'weapons';
  const mobType = entry.mobType ? MOB_TYPE_LABEL[entry.mobType] : undefined;
  /** Nome do tipo de item no idioma atual (Geral, Ring, Consumivel, Material, Moeda, Cast, Autoridade). */
  const ce = dict.admin.contentEditor;
  const itemTypeLabel = (type: string) => itemTypeLabels(ce)[type] ?? type;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/catalog/${entry.category}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.detail.back}
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Selo so' em portugues e so' quando o texto veio da traducao automatica sem revisao */}
          {isPt && entry.translationAuto && (
            <span title={dict.detail.autoTranslatedHint} className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
              <Languages className="h-3 w-3" />{dict.detail.autoTranslated}
            </span>
          )}
          {entry.updatedAt && (
            <span className="text-xs text-muted-foreground">{dict.detail.updatedOn} {new Date(entry.updatedAt).toLocaleDateString(isPt ? 'pt-BR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          )}
          {/* Itens e armas podem ser comparados lado a lado com outro */}
          {(entry.category === 'items' || entry.category === 'weapons') && (
            <Link href={`/compare?a=${entry.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground">
              <Scale className="h-3.5 w-3.5" />{dict.compare.button}
            </Link>
          )}
          {/* Visitante avisa informacao desatualizada / erro de traducao desta pagina (vai para /admin/reports) */}
          <ReportButton targetType="content" targetId={entry.slug} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {isWeapon ? (
            // ARMAS: titulo com selos (nivel exigido, tipo, classe), peca em destaque, cartoes de dano/velocidade e Stat Bonus.
            <>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {shouldShowLevel(entry.category, entry.itemType, entry.level, entry.levelUnknown) && (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{dict.detail.levelReq} {levelText(entry)}</span>
                  )}
                  {entry.weaponType && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold uppercase text-card-foreground">{entry.weaponType}</span>}
                  <span className={cn('text-xs font-semibold', rarityConfig[entry.rarity].color)}>{rarityConfig[entry.rarity].label}</span>
                </div>
              </div>

              <div className="flex justify-center rounded-2xl border border-border bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.2),transparent_65%)] bg-secondary/30 py-14">
                <WikiImage
                  src={entry.image}
                  alt={`Imagem de ${name}`}
                  fallback={entry.icon}
                  className="h-44 w-44 rounded-xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                />
              </div>

              {(entry.weaponBaseDamage || entry.weaponSpeed || entry.weaponSpecialAbility) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {entry.weaponBaseDamage && <StatTile icon={Swords} label={dict.detail.baseDamage} value={entry.weaponBaseDamage} tone="text-orange-400" />}
                  {entry.weaponSpeed && <StatTile icon={Zap} label={dict.detail.attackSpeed} value={entry.weaponSpeed} tone="text-sky-400" />}
                  {entry.weaponSpecialAbility && <StatTile icon={Sparkles} label={dict.detail.specialAbility} value={entry.weaponSpecialAbility} tone="text-violet-400" />}
                </div>
              )}

              {entry.attributes.length > 0 && (
                <div>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{dict.detail.statBonus}</h2>
                  <div className="flex flex-wrap gap-2">
                    {entry.attributes.map((attr, i) => (
                      <span key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-400">
                        {signedValue(attr.value)} {attr.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : isMob ? (
            // BESTIARIO: titulo com selos (nivel, tipo, raridade), sprite grande sobre fundo com brilho e cartoes de combate.
            <>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{dict.detail.level} {levelText(entry)}</span>
                  {mobType && (
                    <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold uppercase', mobType.className)}>{isPt ? mobType.pt : mobType.en}</span>
                  )}
                  {/* mobs nao tem raridade */}
                </div>
              </div>

              <div className="flex justify-center rounded-2xl border border-border bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.2),transparent_65%)] bg-secondary/30 py-14">
                <WikiImage
                  src={entry.image}
                  alt={`Imagem de ${name}`}
                  fallback={entry.icon}
                  className="h-44 w-44 rounded-xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                />
              </div>

              {(entry.mobHealth || entry.mobDamage || entry.mobExperience) && (
                <div className="grid grid-cols-3 gap-3" aria-label={dict.detail.combatStats}>
                  {entry.mobHealth && <StatTile icon={Heart} label={dict.detail.mobHealth} value={entry.mobHealth} tone="text-red-400" />}
                  {entry.mobDamage && <StatTile icon={Swords} label={dict.detail.mobDamage} value={entry.mobDamage} tone="text-orange-400" />}
                  {entry.mobExperience && <StatTile icon={Star} label={dict.detail.mobExperience} value={entry.mobExperience} tone="text-amber-400" />}
                </div>
              )}
            </>
          ) : (
            // ITENS (e guias/missoes): titulo com selos (tipo, raridade, nivel), imagem grande sobre um brilho na COR DA RARIDADE e cartao de Max Stack.
            <>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {entry.category === 'items' && entry.itemType && (
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-bold uppercase text-card-foreground">{itemTypeLabel(entry.itemType)}</span>
                  )}
                  {entry.category === 'items' && (
                    <span className={cn('rounded-md border px-2 py-0.5 text-xs font-bold uppercase', rarityConfig[entry.rarity].chip)}>{rarityConfig[entry.rarity].label}</span>
                  )}
                  {shouldShowLevel(entry.category, entry.itemType, entry.level, entry.levelUnknown) && (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{dict.detail.level} {levelText(entry)}</span>
                  )}
                </div>
              </div>

              <div
                className="relative flex justify-center overflow-hidden rounded-2xl border border-border bg-secondary/30 py-14"
                style={{ backgroundImage: `radial-gradient(circle at 50% 45%, rgba(${rarityConfig[entry.rarity].glow},0.28), transparent 62%)` }}
              >
                <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:24px_24px]" aria-hidden="true" />
                <WikiImage
                  src={entry.image}
                  alt={`Imagem de ${name}`}
                  fallback={<span className="text-7xl">{entry.icon}</span>}
                  className="relative h-44 w-44 rounded-xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
                />
              </div>

              {itemHasStack(entry.category, entry.itemType) && entry.maxStack != null && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatTile icon={Layers} label={dict.detail.maxStack} value={entry.maxStack.toLocaleString(isPt ? 'pt-BR' : 'en-US')} tone="text-sky-400" />
                </div>
              )}
            </>
          )}

          {/* Descricao e' opcional em mobs: sem texto, nao renderiza o card vazio. */}
          {(extractPlainText(description).trim() || /<img/i.test(description)) && (
            <div className="rounded-lg border border-border bg-card p-6">
              <RichText content={description} className="text-card-foreground leading-relaxed" />
            </div>
          )}

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
