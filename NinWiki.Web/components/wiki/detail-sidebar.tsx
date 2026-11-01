'use client';

// Barra lateral da pagina de detalhe: mostra o icone grande, a ficha
// de stats (fixa pra Mob, Arma, Moeda e Cast; generica de Atributos
// pro resto), e a lista de drops quando houver.
//
// Ordem de leitura segue a ficha do PROPRIO JOGO (comparado print a
// print com o Rafael, 24/09): stats -> Jutsu/Attacks (so' Mob) ->
// Drops.

import Link from 'next/link';
import { cn, itemHasStack, shouldShowLevel, levelText, signedValue, formatNumber } from '@/lib/utils';
import { rarityConfig } from '@/lib/data';
import { itemTypeLabels } from '@/lib/item-types';
import { useLanguage } from '@/components/providers/language-provider';
import { DropRow } from '@/components/wiki/drop-row';
import { DroppedBy } from '@/components/wiki/dropped-by';
import { CraftedBy } from '@/components/wiki/crafted-by';
import { carregarIndiceAreas, linkDoLugar, type AreaIndice } from '@/components/map/area-lookup';
import { WikiImage } from '@/components/wiki/wiki-image';
import { useEffect, useState } from 'react';
import { Coins, Crosshair, Gem, Hammer, Heart, Layers, MapPin, Skull, Star, Swords, Tag, Timer, type LucideIcon } from 'lucide-react';
import type { ApiContentItem, SaleEntry } from '@/lib/api-client';

interface DetailSidebarProps {
  entry: ApiContentItem;
}

interface StatRow {
  label: string;
  value: React.ReactNode;   // texto ou varias linhas (ex.: os requisitos da arma empilhados)
}

/**
 * Uma linha label/valor dentro de uma secao do Accordion de Arma -
 * mesma aparencia visual das linhas zebradas do resto da ficha, so'
 * que sem o efeito zebra (cada secao aqui tem poucas linhas, o zebra
 * ficaria estranho picotado entre secoes diferentes).
 */
function WeaponRow({ label, value }: StatRow) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-card-foreground">{value}</span>
    </div>
  );
}

/** Cabecalho de secao do bestiario (barra na cor do tema + titulo em maiusculas). */
/** Cor do ponto de cada zona (iguais as do Atlas: verde seguro, laranja perigo, vermelho guerra...). */
/** Formata o preco sempre igual no servidor e no navegador (evita diferenca de hidratacao). */
const PRICE_FORMAT = new Intl.NumberFormat('en-US');

/** Lojas de NPC que vendem a entry: uma linha por loja, com onde fica e o preco (moeda = nome de um item). */
function SoldAt({ sales }: { sales: SaleEntry[] }) {
  const { dict } = useLanguage();
  return (
    <ul className="divide-y divide-border">
      {sales.map((s, i) => {
        const places = s.places ?? [];
        const qty = s.qty ?? 1;
        return (
          <li key={i} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-card-foreground">{s.shop}</p>
              {places.length > 0 && <p className="text-xs text-muted-foreground">{places.slice(0, 3).join(', ')}{places.length > 3 ? ` +${places.length - 3}` : ''}</p>}
            </div>
            <span className="shrink-0 text-right font-semibold text-primary">
              {s.price ? `${PRICE_FORMAT.format(s.price)} ${s.currency ?? 'Ryo'}` : dict.detail.free}
              {qty > 1 && <small className="block font-normal text-muted-foreground">{dict.detail.forQty.replace('{n}', String(qty))}</small>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const ZONE_DOT: Record<string, string> = {
  safe: 'bg-green-400', danger: 'bg-orange-400', war: 'bg-red-400', arena: 'bg-yellow-200', parkour: 'bg-cyan-400', none: 'bg-muted-foreground/50',
};

function SectionTitle({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-y border-border border-l-[3px] border-l-primary bg-secondary/50 px-4 py-2.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
      <h3 className="text-sm font-bold uppercase tracking-wide text-card-foreground">{children}</h3>
    </div>
  );
}

/** Barra lateral da pagina de detalhe (ficha resumida da entry). */
export function DetailSidebar({ entry }: DetailSidebarProps) {
  const { dict, locale } = useLanguage();
  const isPt = locale === 'pt';
  const name = isPt ? (entry.namePt ?? entry.name) : entry.name;
  const spawnLocation = isPt ? (entry.spawnLocationPt ?? entry.spawnLocation) : entry.spawnLocation;
  // Lugares do mob: a lista (com zona) vale; sem lista, o texto livre antigo e' quebrado por virgula em linhas (sem zona).
  const places: { name: string; zone: string | null }[] = (entry.spawnLocations ?? []).length > 0
    ? (entry.spawnLocations ?? []).map((l) => ({ name: isPt ? (l.namePt ?? l.name) : l.name, zone: l.zone ?? null }))
    : (spawnLocation ?? '').split(/[,;]/).map((p) => p.trim().replace(/\.$/, '')).filter(Boolean).map((name) => ({ name, zone: null }));
  // Indice nome -> area do mapa (so' mob com lugares; carrega o json do mapa sob demanda). Sem ele os lugares ficam so' texto.
  const [areas, setAreas] = useState<AreaIndice | null>(null);
  const temLugares = entry.category === 'mobs' && places.length > 0;
  useEffect(() => {
    if (!temLugares) return;
    let vivo = true;
    carregarIndiceAreas().then((ind) => vivo && setAreas(ind));
    return () => { vivo = false; };
  }, [temLugares]);
  const craftedBy = entry.craftedBy ?? [];   // receitas das profissoes que fazem esta entry (a API calcula; `?? []` cobre resposta antiga)
  const soldAt = entry.soldAt ?? [];   // lojas de NPC que vendem esta entry (`?? []` cobre resposta antiga durante o deploy)
  const droppedBy = entry.droppedBy ?? [];   // mobs que dropam esta entry (a API calcula; `?? []` cobre resposta antiga durante o deploy)

  // Ficha de Arma: layout PROPRIO, diferente do resto (secoes que
  // expandem/recolhem, batendo com a ficha do proprio jogo - print de
  // referencia comparado com o Rafael, 26/09). So' inclui uma LINHA se
  // o campo tiver valor, e so' inclui a SECAO inteira se ela tiver
  // pelo menos uma linha - uma arma sem NPC cadastrado, por exemplo,
  // simplesmente nao mostra a secao "Como conseguir" vazia.
  if (entry.category === 'weapons') {
    const requirementsRows: StatRow[] = shouldShowLevel(entry.category, entry.itemType, entry.level, entry.levelUnknown) ? [{ label: dict.detail.levelReq, value: levelText(entry) }] : [];
    // ate' 3 requisitos (um por linha): UMA so' linha "Stat Req." com todos empilhados no mesmo bloco
    const reqs = (entry.weaponRequirement ?? '').split('\n').map((r) => r.trim()).filter(Boolean);
    if (reqs.length) requirementsRows.push({ label: dict.detail.statReq, value: reqs.map((r, i) => <span key={i} className="block">{r}</span>) });

    const acquisitionRows: StatRow[] = [];
    if (entry.weaponNpc) {
      // NPC ligado a uma pagina: o nome acompanha a pagina e vira link (so' se ela esta' publicada; senao fica so' o nome)
      const npcName = isPt && entry.weaponNpcId ? (entry.weaponNpcNamePt ?? entry.weaponNpc) : entry.weaponNpc;
      acquisitionRows.push({ label: dict.detail.npc, value: entry.weaponNpcSlug ? <Link href={`/detail/${entry.weaponNpcSlug}`} className="text-primary hover:underline">{npcName}</Link> : npcName });
    }

    const detailsRows: StatRow[] = [{ label: dict.detail.weaponClass, value: entry.rarity }];
    if (entry.weaponType) detailsRows.push({ label: dict.detail.weaponType, value: entry.weaponType });
    if (entry.weaponBaseDamage) detailsRows.push({ label: dict.detail.baseDamage, value: entry.weaponBaseDamage });
    if (entry.weaponSpecialAbility) detailsRows.push({ label: dict.detail.specialAbility, value: entry.weaponSpecialAbility });
    if (entry.weaponSpeed) detailsRows.push({ label: dict.detail.attackSpeed, value: entry.weaponSpeed });

    const battleDataRows: StatRow[] = [];
    if (entry.weaponKnockbackDistance) battleDataRows.push({ label: dict.detail.knockbackDistance, value: entry.weaponKnockbackDistance });

    const sections = [
      { id: 'requirements', title: dict.detail.requirementsSection, rows: requirementsRows },
      { id: 'acquisition', title: dict.detail.acquisitionSection, rows: acquisitionRows },
      { id: 'details', title: dict.detail.weaponDetailsSection, rows: detailsRows },
      { id: 'battle', title: dict.detail.battleDataSection, rows: battleDataRows },
    ].filter((s) => s.rows.length > 0);

    // Mesmo visual do bestiario: cabecalho com barra na cor do tema, linhas com valor em destaque, sem secoes que expandem.
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex justify-center border-b border-border bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.18),transparent_70%)] bg-muted/20 py-6">
          <WikiImage src={entry.image} alt={name} fallback={entry.icon} className="h-28 w-28 rounded-lg" />
        </div>

        {sections.map((section) => (
          <div key={section.id}>
            <SectionTitle>{section.title}</SectionTitle>
            <div className="divide-y divide-border">
              {section.rows.map((row, i) => (
                <WeaponRow key={i} label={row.label} value={row.value} />
              ))}
            </div>
            {/* Stat Bonus: so' na secao de detalhes da arma, e so' se houver atributo cadastrado */}
            {section.id === 'details' && entry.attributes.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dict.detail.statBonus}</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.attributes.map((attr, i) => (
                    <span key={i} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">
                      {signedValue(attr.value)} {attr.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Feito por craft: receitas das profissoes que produzem esta arma (automatico) */}
        {craftedBy.length > 0 && (
          <>
            <SectionTitle icon={Hammer}>{dict.detail.crafted}</SectionTitle>
            <CraftedBy recipes={craftedBy} slug={entry.slug} />
          </>
        )}

        {/* Dropado por: automatico (mobs que ligam esta arma nos drops) */}
        {droppedBy.length > 0 && (
          <>
            <SectionTitle icon={Skull}>{dict.detail.droppedBy}</SectionTitle>
            <DroppedBy mobs={droppedBy} />
          </>
        )}

        {/* Vendido em: lojas de NPC que vendem esta arma, com o preco */}
        {soldAt.length > 0 && (
          <>
            <SectionTitle icon={Coins}>{dict.detail.soldAt}</SectionTitle>
            <SoldAt sales={soldAt} />
          </>
        )}

        {entry.drops.length > 0 && (
          <>
            <SectionTitle>{dict.detail.drops}</SectionTitle>
            <div className="px-4 py-2">
              {entry.drops.map((drop, i) => (
                <DropRow key={i} drop={drop} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // BESTIARIO: ficha de mob no mesmo visual da ficha de jutsu (cabecalho com barra na cor do tema, linhas com icone e
  // valores em cor), mas SEM secoes que expandem - tudo sempre aberto. So' mostra a linha/secao que tiver conteudo.
  if (entry.category === 'mobs') {
    const mobRows: { icon: LucideIcon; label: string; value: string; tone: string }[] = [];
    if (entry.mobHealth) mobRows.push({ icon: Heart, label: dict.detail.mobHealth, value: entry.mobHealth, tone: 'text-red-400' });
    if (entry.mobDamage) mobRows.push({ icon: Swords, label: dict.detail.mobDamage, value: entry.mobDamage, tone: 'text-orange-400' });
    if (entry.mobExperience) mobRows.push({ icon: Star, label: dict.detail.mobExperience, value: entry.mobExperience, tone: 'text-amber-400' });
    if (entry.mobRange) mobRows.push({ icon: Crosshair, label: dict.detail.mobRange, value: entry.mobRange, tone: 'text-sky-400' });
    if (entry.mobRespawnTime) mobRows.push({ icon: Timer, label: dict.detail.mobRespawn, value: entry.mobRespawnTime, tone: 'text-emerald-400' });

    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex justify-center border-b border-border bg-[radial-gradient(circle_at_50%_45%,hsl(var(--primary)/0.18),transparent_70%)] bg-muted/20 py-6">
          <WikiImage src={entry.image} alt={name} fallback={entry.icon} className="h-28 w-28 rounded-lg" />
        </div>

        {mobRows.length > 0 && (
          <>
            <SectionTitle>{dict.detail.attributes}</SectionTitle>
            <div className="divide-y divide-border">
              {mobRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <row.icon className={cn('h-4 w-4', row.tone)} />
                    {row.label}
                  </span>
                  <span className="font-bold tabular-nums text-card-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Jutsu/Attacks: sempre aparece (com "Nenhum"), como na ficha do proprio jogo */}
        <SectionTitle icon={Swords}>{dict.detail.attacks}</SectionTitle>
        <div className="px-4 py-3">
          {entry.attacks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {entry.attacks.map((atk, i) => {
                const label = isPt ? (atk.namePt ?? atk.name) : atk.name;
                // Jutsu ligado: o selo vira link para a pagina da skill; texto livre fica sem link.
                return atk.jutsuId ? (
                  <Link key={i} href={`/jutsus/${atk.jutsuId}`} className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20">{label}</Link>
                ) : (
                  <span key={i} className="rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs font-medium text-card-foreground">{label}</span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.detail.noAttacks}</p>
          )}
        </div>

        {places.length > 0 && (
          <>
            <SectionTitle icon={MapPin}>{dict.detail.spawnLocation}</SectionTitle>
            {/* um lugar por linha, com um ponto na cor da zona e o nome da zona (como o "Found in" do Atlas) */}
            <ul className="divide-y divide-border">
              {places.map((p, i) => (
                <li key={i} className="flex items-center gap-2.5 px-4 py-2 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ZONE_DOT[p.zone ?? 'none']}`} aria-hidden />
                  {/* o nome vira link para o mapa ja' focado na area (so' se casar com uma area; senao fica texto) */}
                  {(() => {
                    const href = linkDoLugar(areas, p.name);
                    return href
                      ? <Link href={href} className="min-w-0 flex-1 font-medium text-card-foreground underline-offset-2 hover:text-primary hover:underline">{p.name}</Link>
                      : <span className="min-w-0 flex-1 font-medium text-card-foreground">{p.name}</span>;
                  })()}
                  {p.zone && <span className="shrink-0 text-xs text-muted-foreground">{dict.detail.zones[p.zone] ?? p.zone}</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        {entry.drops.length > 0 && (
          <>
            <SectionTitle>{dict.detail.drops}</SectionTitle>
            <div className="px-4 py-2">
              {entry.drops.map((drop, i) => (
                <DropRow key={i} drop={drop} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ITENS (e guias/missoes): ficha no mesmo visual do bestiario/arma - secoes com barra na cor do tema e valores em destaque.
  // A imagem grande ja' aparece no topo da pagina (com o brilho da raridade), entao aqui nao se repete.
  // So' entra a linha que tiver valor (um item sem stack nao mostra "Max Stack: ").
  const ce = dict.admin.contentEditor;
  const typeLabels = itemTypeLabels(ce);
  const rarity = rarityConfig[entry.rarity];
  const detailRows: { icon: LucideIcon; label: string; value: string; tone?: string }[] = [];
  if (entry.category === 'items') {
    if (entry.itemType) detailRows.push({ icon: Tag, label: dict.detail.itemType, value: typeLabels[entry.itemType] ?? entry.itemType });
    detailRows.push({ icon: Gem, label: ce.rarity, value: dict.detail.rarities[entry.rarity], tone: rarity.color });
    if (shouldShowLevel(entry.category, entry.itemType, entry.level, entry.levelUnknown)) detailRows.push({ icon: Star, label: dict.detail.level, value: levelText(entry), tone: 'text-amber-400' });
    if (itemHasStack(entry.category, entry.itemType) && entry.maxStack != null) {
      detailRows.push({ icon: Layers, label: dict.detail.maxStack, value: formatNumber(entry.maxStack, locale), tone: 'text-sky-400' });
    }
    if (entry.itemType === 'cast' && entry.castVillageName) detailRows.push({ icon: MapPin, label: dict.detail.castVillage, value: entry.castVillageName });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {detailRows.length > 0 && (
        <>
          <SectionTitle>{dict.detail.itemDetails}</SectionTitle>
          <div className="divide-y divide-border">
            {detailRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <row.icon className={cn('h-4 w-4', row.tone ?? 'text-primary')} />
                  {row.label}
                </span>
                <span className={cn('text-right font-bold', row.tone ?? 'text-card-foreground')}>{row.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Atributos cadastrados (ex.: +5 Strength) como selos, no mesmo estilo do Stat Bonus das armas */}
      {entry.attributes.length > 0 && (
        <>
          <SectionTitle>{dict.detail.attributes}</SectionTitle>
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {entry.attributes.map((attr, i) => (
              <span key={i} className="rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs font-medium text-card-foreground">
                <span className="text-muted-foreground">{attr.label}</span> <span className="font-bold">{signedValue(attr.value)}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* Feito por craft: receitas das profissoes que produzem este item (automatico); some se nenhuma. */}
      {craftedBy.length > 0 && (
        <>
          <SectionTitle icon={Hammer}>{dict.detail.crafted}</SectionTitle>
          <CraftedBy recipes={craftedBy} slug={entry.slug} />
        </>
      )}

      {/* Dropado por: automatico (mobs que ligam este item nos drops); some se nenhum mob dropa. */}
      {droppedBy.length > 0 && (
        <>
          <SectionTitle icon={Skull}>{dict.detail.droppedBy}</SectionTitle>
          <DroppedBy mobs={droppedBy} />
        </>
      )}

      {/* Vendido em: lojas de NPC que vendem este item, com o preco (preco que o jogador paga). */}
      {soldAt.length > 0 && (
        <>
          <SectionTitle icon={Coins}>{dict.detail.soldAt}</SectionTitle>
          <SoldAt sales={soldAt} />
        </>
      )}

      {/* Drops so' aparecem se a entry tiver (nem toda tem). */}
      {entry.drops.length > 0 && (
        <>
          <SectionTitle>{dict.detail.drops}</SectionTitle>
          <div className="px-4 py-2">
            {entry.drops.map((drop, i) => (
              <DropRow key={i} drop={drop} />
            ))}
          </div>
        </>
      )}

      {detailRows.length === 0 && entry.attributes.length === 0 && entry.drops.length === 0 && droppedBy.length === 0 && craftedBy.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{name}</p>
      )}
    </div>
  );
}
