'use client';

// Ficha do jutsu no MESMO estilo da ficha de Arma da wiki (components/wiki/detail-sidebar.tsx): cabecalhos de secao em
// negrito/maiusculas que abrem e fecham, linhas "rotulo (cinza) | valor (em destaque)", icone grande no topo - so' que com
// a cor da mastery como detalhe (barra ao lado do titulo e icone). Linha sem valor nao aparece e secao sem nenhuma linha
// some inteira. Secoes: Requisitos, Aquisicao, Detalhes da tecnica e Dados de batalha.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { MasteryIcon } from '@/components/lore/mastery-icon';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ApiJutsu, ApiMastery } from '@/lib/api-client';

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

interface SheetRow {
  label: string;
  value: ReactNode;
}

/** Linha rotulo/valor de uma secao (mesma aparencia das linhas da ficha de Arma). */
function Row({ label, value }: SheetRow) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-card-foreground">{value}</span>
    </div>
  );
}

/**
 * Valores por nivel, um por linha ("Level 1 - 6"), inclusive quando so' existe o nivel 1.
 * Quando o jutsu muda de nome em algum nivel (`names`), entra uma linha-divisoria ANTES desse nivel avisando o nome novo
 * ("From level 4: Great Fireball") - da' para ver de relance que dali em diante a skill passa a se chamar assim.
 */
function PerLevel({ values: raw, word, names = [], nameFrom }: { values: string[]; word: string; names?: string[]; nameFrom?: string }) {
  const values = Array.from({ length: Math.max(raw.length, names.length) }, (_, i) => raw[i] ?? '');   // nome no nivel 4 aparece mesmo se a lista de valores for mais curta
  // nome que passa a valer em cada nivel (so' marca o nivel quando o nome MUDA em relacao ao anterior)
  const cleaned = names.map((n) => (n ?? '').trim());
  const changesAt = values.map((_, i) => Boolean(nameFrom && cleaned[i] && cleaned[i] !== cleaned.slice(0, i).filter(Boolean).pop()));
  return (
    <ul className="space-y-0.5">
      {values.map((v, i) => {
        const changes = changesAt[i];
        if (!v.trim() && !changes) return null;
        return (
          <li key={i} className="list-none">
            {changes && nameFrom && (
              <div className="my-1.5 border-t border-border pt-1.5 text-xs font-bold text-primary">{nameFrom.replace('{n}', String(i + 1)).replace('{name}', cleaned[i])}</div>
            )}
            {v.trim() ? `${word} ${i + 1} - ${v.trim()}` : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Ficha completa de um jutsu (Requisitos, Aquisicao, Detalhes da tecnica, Dados de batalha). */
export function JutsuSheet({ jutsu, mastery, masteryName }: { jutsu: ApiJutsu; mastery?: ApiMastery; masteryName?: string }) {
  const { dict, locale } = useLanguage();
  const t = dict.jutsuInfo;
  const color = mastery?.color ?? '#c2410c';
  const has = (v: string | undefined | null) => Boolean(v && v.trim());
  const dmg = (jutsu.damageByLevel ?? []).filter((v) => has(v));
  const cds = (jutsu.cooldownByLevel ?? []).filter((v) => has(v));
  // nome por nivel (vira linha-divisoria dentro das listas de dano e recarga): em portugues usa a traducao, com o ingles de reserva
  const names = (jutsu.nameByLevel ?? []).map((n, i) => (locale === 'pt' ? jutsu.nameByLevelPt?.[i]?.trim() || n : n));

  const requirements: SheetRow[] = [
    ...(mastery ? [{ label: t.mastery, value: <Link href={`/masteries/${mastery.id}`} className="hover:underline" style={{ color }}>{masteryName}</Link> }] : []),
    ...(has(jutsu.requiredLevel) ? [{ label: t.level, value: jutsu.requiredLevel }] : []),
    ...(has(jutsu.requiredStat) ? [{ label: t.stat, value: jutsu.requiredStat }] : []),
  ];
  const acquisition: SheetRow[] = [
    { label: t.tier, value: `${has(jutsu.scrollType) ? jutsu.scrollType : t.tier} ${ROMAN[jutsu.tier] ?? jutsu.tier}` },
    ...(jutsu.isNpc ? [{ label: t.source, value: t.npcSource }] : []),
  ];
  const details: SheetRow[] = [
    { label: t.maxLevel, value: String(jutsu.maxLevel ?? 1) },
    ...(dmg.length ? [{ label: t.baseDamage, value: <PerLevel values={jutsu.damageByLevel} word={t.levelWord} names={names} nameFrom={t.nameFromLevel} /> }] : []),
    { label: t.chakraCost, value: `${jutsu.chakraCost} ${t.cpUnit}` },
    ...(cds.length
      ? [{ label: t.cooldown, value: <PerLevel values={jutsu.cooldownByLevel} word={t.levelWord} names={names} nameFrom={t.nameFromLevel} /> }]
      : has(jutsu.cooldown) ? [{ label: t.cooldown, value: jutsu.cooldown }] : []),
    ...(has(jutsu.castTime) ? [{ label: t.castTime, value: jutsu.castTime }] : []),
    ...(has(jutsu.castType) ? [{ label: t.castType, value: jutsu.castType }] : []),
    ...(has(jutsu.effect) ? [{ label: t.specialEffect, value: jutsu.effect }] : []),
  ];
  const battle: SheetRow[] = [
    ...(has(jutsu.range) ? [{ label: t.range, value: jutsu.range }] : []),
    ...(has(jutsu.allowedWeapons) ? [{ label: t.allowedWeapons, value: jutsu.allowedWeapons }] : []),
    ...(has(jutsu.debuff) ? [{ label: t.debuff, value: jutsu.debuff }] : []),
  ];

  // Jutsu NPC: so' o icone (sem requisitos, tier, niveis nem dados de batalha): a pagina mostra nome, imagem e descricao
  const sections = jutsu.isNpc ? [] : [
    { id: 'requirements', title: t.requirements, rows: requirements },
    { id: 'acquisition', title: t.acquisition, rows: acquisition },
    { id: 'details', title: t.techniqueDetails, rows: details },
    { id: 'battle', title: t.battleData, rows: battle },
  ].filter((section) => section.rows.length > 0);

  return (
    <aside className="overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:sticky lg:top-20">
      <div className="flex justify-center border-b border-border bg-muted/20 py-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}22`, color }}>
          <MasteryIcon icon={jutsu.icon} className="h-12 w-12" />
        </div>
      </div>
      {/* type="multiple": comeca tudo aberto e cada secao fecha/abre sozinha (igual a ficha de Arma). */}
      <Accordion type="multiple" defaultValue={sections.map((section) => section.id)}>
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="border-border">
            <AccordionTrigger
              className="bg-secondary/50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-card-foreground hover:no-underline [&>svg]:h-4 [&>svg]:w-4"
              style={{ boxShadow: `inset 3px 0 0 ${color}` }}
            >
              {section.title}
            </AccordionTrigger>
            <AccordionContent className="divide-y divide-border pb-0">
              {section.rows.map((row) => (
                <Row key={row.label} label={row.label} value={row.value} />
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </aside>
  );
}
