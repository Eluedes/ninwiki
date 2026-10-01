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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MapPin, Swords } from 'lucide-react';
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
    <div className="flex items-center justify-between px-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-card-foreground">{value}</span>
    </div>
  );
}

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

    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex justify-center bg-muted/20 py-6 border-b border-border">
          <WikiImage src={entry.image} alt={`Imagem de ${name}`} fallback={entry.icon} className="h-28 w-28 rounded-lg" />
        </div>

        {/* type="multiple" + defaultValue com todos os ids: comeca com
            TUDO aberto (igual o print de referencia mostra), mas a
            pessoa pode fechar qualquer secao clicando no titulo -
            "multiple" permite varias abertas ao mesmo tempo, diferente
            do padrao "single" que fecharia uma secao ao abrir outra. */}
        <Accordion type="multiple" defaultValue={sections.map((s) => s.id)}>
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id} className="border-border">
              <AccordionTrigger className="bg-secondary/50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-card-foreground hover:no-underline [&>svg]:h-4 [&>svg]:w-4">
                {section.title}
              </AccordionTrigger>
              <AccordionContent className="divide-y divide-border pb-0">
                {section.rows.map((row, i) => (
                  <WeaponRow key={i} label={row.label} value={row.value} />
                ))}
                {/* Stat Bonus: so' na secao Weapon Details, e so' se
                    houver atributo cadastrado - reaproveita a lista
                    generica de Atributos (ver comentario no editor
                    admin: "Class"/"Stat Bonus" nao precisaram de campo
                    novo). */}
                {section.id === 'details' && entry.attributes.length > 0 && (
                  <div className="px-4 py-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {dict.detail.statBonus}
                    </p>
                    {entry.attributes.map((attr, i) => (
                      <p key={i} className="text-sm text-card-foreground">+{attr.value} {attr.label}</p>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {entry.drops.length > 0 && (
          <div className="border-t border-border">
            <div className="border-b border-border bg-secondary/50 px-4 py-2.5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-card-foreground">{dict.detail.drops}</h3>
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

  // Monta a lista de linhas da ficha - o CONTEUDO muda por categoria/
  // tipo, mas a RENDERIZACAO (linhas zebradas label/valor) e' uma so',
  // reaproveitada pra todo mundo. So' inclui uma linha se o campo
  // correspondente tiver valor de verdade (nao mostra "Speed: " vazio
  // pra uma arma que ainda nao teve isso preenchido).
  const statRows: StatRow[] = [];
  if (entry.category === 'mobs') {
    if (entry.mobHealth) statRows.push({ label: 'Health', value: entry.mobHealth });
    if (entry.mobDamage) statRows.push({ label: 'Damage', value: entry.mobDamage });
    if (entry.mobExperience) statRows.push({ label: 'Experience', value: entry.mobExperience });
    if (entry.mobRange) statRows.push({ label: 'Range', value: entry.mobRange });
    if (entry.mobRespawnTime) statRows.push({ label: 'Respawn Time', value: entry.mobRespawnTime });
  } else {
    if (entry.category === 'items' && entry.itemType === 'currency' && entry.maxStack != null) {
      statRows.push({ label: dict.detail.maxStack, value: entry.maxStack.toLocaleString('pt-BR') });
    }
    if (entry.category === 'items' && entry.itemType === 'cast' && entry.castVillageName) {
      statRows.push({ label: dict.detail.castVillage, value: entry.castVillageName });
    }
    // Atributos genericos - continuam disponiveis pra qualquer
    // categoria que nao seja Mob (Arma pode ter extra alem de Speed/
    // Requisito, Item/Missao/Guia nao tem campo fixo proprio ainda).
    for (const attr of entry.attributes) statRows.push({ label: attr.label, value: attr.value });
  }

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

      {/* Jutsu/Attacks - so' Mob, sempre mostra a secao (mesmo vazia,
          com "Nenhum") pra bater com a ficha do jogo, que sempre tem
          esse bloco mesmo quando diz "None". */}
      {entry.category === 'mobs' && (
        <div className="border-t border-border">
          <div className="border-b border-border bg-secondary/50 px-4 py-2.5">
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-card-foreground">
              <Swords className="h-3.5 w-3.5" /> {dict.detail.attacks}
            </h3>
          </div>
          <div className="px-4 py-2">
            {entry.attacks.length > 0 ? (
              <ul className="space-y-1 text-sm text-card-foreground">
                {entry.attacks.map((atk, i) => (
                  <li key={i}>• {atk.name}</li>
                ))}
              </ul>
            ) : (
              <p className="py-1 text-sm text-muted-foreground">{dict.detail.noAttacks}</p>
            )}
          </div>
        </div>
      )}

      {/* Local de spawn - so' pra Mob, e so' quando preenchido (o
          campo e' opcional). */}
      {entry.category === 'mobs' && spawnLocation && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dict.detail.spawnLocation}
              </p>
              <p className="text-sm text-card-foreground">{spawnLocation}</p>
            </div>
          </div>
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
