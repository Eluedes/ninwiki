'use client';

// Barra lateral da pagina de detalhe: mostra o icone grande, a ficha
// de stats (fixa pra Mob, Arma, Moeda e Cast; generica de Atributos
// pro resto), e a lista de drops quando houver.
//
// Ordem de leitura segue a ficha do PROPRIO JOGO (comparado print a
// print com o Rafael, 24/09): stats -> Jutsu/Attacks (so' Mob) ->
// Drops.

import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/language-provider';
import { DropRow } from '@/components/wiki/drop-row';
import { WikiImage } from '@/components/wiki/wiki-image';
import { Crosshair, Heart, MapPin, Star, Swords, Timer, type LucideIcon } from 'lucide-react';
import type { ApiContentItem } from '@/lib/api-client';

interface DetailSidebarProps {
  entry: ApiContentItem;
}

interface StatRow {
  label: string;
  value: string;
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

  // Ficha de Arma: layout PROPRIO, diferente do resto (secoes que
  // expandem/recolhem, batendo com a ficha do proprio jogo - print de
  // referencia comparado com o Rafael, 26/09). So' inclui uma LINHA se
  // o campo tiver valor, e so' inclui a SECAO inteira se ela tiver
  // pelo menos uma linha - uma arma sem NPC cadastrado, por exemplo,
  // simplesmente nao mostra a secao "Como conseguir" vazia.
  if (entry.category === 'weapons') {
    const requirementsRows: StatRow[] = [{ label: dict.detail.levelReq, value: String(entry.level) }];
    if (entry.weaponRequirement) requirementsRows.push({ label: dict.detail.statReq, value: entry.weaponRequirement });

    const acquisitionRows: StatRow[] = [];
    if (entry.weaponNpc) acquisitionRows.push({ label: dict.detail.npc, value: entry.weaponNpc });

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
          <WikiImage src={entry.image} alt={`Imagem de ${name}`} fallback={entry.icon} className="h-28 w-28 rounded-lg" />
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
                      +{attr.value} {attr.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

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
          <WikiImage src={entry.image} alt={`Imagem de ${name}`} fallback={entry.icon} className="h-28 w-28 rounded-lg" />
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
              {entry.attacks.map((atk, i) => (
                <span key={i} className="rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs font-medium text-card-foreground">{atk.name}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{dict.detail.noAttacks}</p>
          )}
        </div>

        {spawnLocation && (
          <>
            <SectionTitle icon={MapPin}>{dict.detail.spawnLocation}</SectionTitle>
            <p className="px-4 py-3 text-sm leading-relaxed text-card-foreground">{spawnLocation}</p>
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

  // Monta a lista de linhas da ficha - o CONTEUDO muda por categoria/
  // tipo, mas a RENDERIZACAO (linhas zebradas label/valor) e' uma so',
  // reaproveitada pra todo mundo. So' inclui uma linha se o campo
  // correspondente tiver valor de verdade (nao mostra "Speed: " vazio
  // pra uma arma que ainda nao teve isso preenchido).
  const statRows: StatRow[] = [];
  if (entry.category === 'items' && entry.itemType === 'currency' && entry.maxStack != null) {
      statRows.push({ label: dict.detail.maxStack, value: entry.maxStack.toLocaleString('pt-BR') });
  }
  if (entry.category === 'items' && entry.itemType === 'cast' && entry.castVillageName) {
    statRows.push({ label: dict.detail.castVillage, value: entry.castVillageName });
  }
  // Atributos genericos - valem para toda categoria que nao seja Mob nem Arma (que tem ficha propria acima).
  for (const attr of entry.attributes) statRows.push({ label: attr.label, value: attr.value });

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
      <div className="border-b border-border bg-secondary/50 px-4 py-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-card-foreground">
          {dict.detail.attributes}
        </h3>
      </div>

      <div className="flex justify-center bg-muted/20 py-6 border-b border-border">
        <WikiImage
          src={entry.image}
          alt={`Imagem de ${name}`}
          fallback={entry.icon}
          className="h-28 w-28 rounded-lg"
        />
      </div>

      {statRows.length > 0 && (
        <div className="divide-y divide-border">
          {statRows.map((row, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center justify-between px-4 py-2 text-sm',
                // efeito "zebra" - linhas pares recebem um fundo levemente diferente
                i % 2 === 0 && 'bg-muted/30'
              )}
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold text-card-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Secao de drops so' renderiza se a entry tiver drops (nem toda
          entry tem - so' faz sentido para mobs). entry.drops.length > 0
          e nao so' "entry.drops &&" - um array vazio [] e' truthy em
          JS, o check teria que ser no tamanho mesmo com o campo sempre
          vindo preenchido (nunca undefined) da API. */}
      {entry.drops.length > 0 && (
        <div className="border-t border-border">
          <div className="border-b border-border bg-secondary/50 px-4 py-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-card-foreground">
              {dict.detail.drops}
            </h3>
          </div>
          <div className="px-4 py-2">
            {entry.drops.map((drop, i) => (
              <DropRow key={i} drop={drop} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
