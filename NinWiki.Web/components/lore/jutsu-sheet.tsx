'use client';

// Ficha do jutsu em secoes que abrem e fecham (Requisitos, Aquisicao, Detalhes da tecnica, Dados de batalha), no estilo
// das wikis de jogos: titulo colorido (a cor da mastery) com seta e linhas "rotulo | valor". Linha sem valor nao aparece e
// secao sem nenhuma linha some inteira. Usa <details>/<summary> nativos: abre/fecha sem JavaScript.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronUp } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiJutsu, ApiMastery } from '@/lib/api-client';

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

interface SheetRow {
  label: string;
  value: ReactNode;
}

/** Uma secao recolhivel da ficha: cabecalho colorido + linhas (nada e' desenhado se nao houver linhas). */
function SheetSection({ title, rows, color }: { title: string; rows: SheetRow[]; color: string }) {
  if (rows.length === 0) return null;
  return (
    <details open className="group border-b border-border last:border-b-0">
      <summary
        className="relative flex cursor-pointer list-none items-center justify-center px-4 py-2.5 text-center font-display text-sm font-bold text-white [&::-webkit-details-marker]:hidden"
        style={{ backgroundColor: color }}
      >
        {title}
        <ChevronUp className="absolute right-3 h-4 w-4 transition-transform group-open:rotate-0 group-[:not([open])]:rotate-180" aria-hidden />
      </summary>
      <dl className="divide-y divide-border bg-card">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[38%_1fr] gap-3 px-4 py-3 text-sm">
            <dt className="font-bold text-card-foreground">{row.label}</dt>
            <dd className="text-muted-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Valores por nivel, um por linha ("Nivel 1 - 6"); com um valor so', mostra o valor direto. */
function PerLevel({ values, word }: { values: string[]; word: string }) {
  const filled = values.map((v) => v.trim());
  if (filled.length === 1) return <>{filled[0]}</>;
  return (
    <ul className="space-y-0.5">
      {filled.map((v, i) => (v ? <li key={i}>{`${word} ${i + 1} - ${v}`}</li> : null))}
    </ul>
  );
}

/** Ficha completa de um jutsu (seguindo a ordem: Requisitos, Aquisicao, Detalhes da tecnica, Dados de batalha). */
export function JutsuSheet({ jutsu, mastery, masteryName }: { jutsu: ApiJutsu; mastery?: ApiMastery; masteryName?: string }) {
  const { dict } = useLanguage();
  const t = dict.jutsuInfo;
  const color = mastery?.color ?? '#c2410c';
  const has = (v: string | undefined | null) => Boolean(v && v.trim());
  const dmg = (jutsu.damageByLevel ?? []).filter((v) => has(v));
  const cds = (jutsu.cooldownByLevel ?? []).filter((v) => has(v));

  const requirements: SheetRow[] = [
    ...(mastery ? [{ label: t.mastery, value: <Link href={`/masteries/${mastery.id}`} className="font-medium hover:underline" style={{ color }}>{masteryName}</Link> }] : []),
    ...(has(jutsu.requiredLevel) ? [{ label: t.level, value: jutsu.requiredLevel }] : []),
    ...(has(jutsu.requiredStat) ? [{ label: t.stat, value: jutsu.requiredStat }] : []),
  ];
  const acquisition: SheetRow[] = [
    { label: t.tier, value: `${has(jutsu.scrollType) ? jutsu.scrollType : t.tier} ${ROMAN[jutsu.tier] ?? jutsu.tier}` },
    ...(has(jutsu.shop) ? [{ label: t.shop, value: jutsu.shop }] : []),
  ];
  const details: SheetRow[] = [
    { label: t.maxLevel, value: String(jutsu.maxLevel ?? 1) },
    ...(dmg.length ? [{ label: t.baseDamage, value: <PerLevel values={jutsu.damageByLevel} word={t.levelWord} /> }] : []),
    { label: t.chakraCost, value: `${jutsu.chakraCost} ${t.cpUnit}` },
    ...(cds.length
      ? [{ label: t.cooldown, value: <PerLevel values={jutsu.cooldownByLevel} word={t.levelWord} /> }]
      : has(jutsu.cooldown) ? [{ label: t.cooldown, value: jutsu.cooldown }] : []),
    ...(has(jutsu.castTime) ? [{ label: t.castTime, value: jutsu.castTime }] : []),
    ...(has(jutsu.castType) ? [{ label: t.castType, value: jutsu.castType }] : []),
    ...(has(jutsu.effect) ? [{ label: t.specialEffect, value: jutsu.effect }] : []),
  ];
  const battle: SheetRow[] = [
    ...(has(jutsu.jutsuClass) ? [{ label: t.jutsuClass, value: jutsu.jutsuClass }] : []),
    ...(has(jutsu.range) ? [{ label: t.range, value: jutsu.range }] : []),
    ...(has(jutsu.debuff) ? [{ label: t.debuff, value: jutsu.debuff }] : []),
    ...(jutsu.battleExtra ?? []).filter((r) => has(r.label)).map((r) => ({ label: r.label, value: r.value })),
  ];

  return (
    <aside className="overflow-hidden rounded-xl border border-border shadow-sm lg:sticky lg:top-20">
      <SheetSection title={t.requirements} rows={requirements} color={color} />
      <SheetSection title={t.acquisition} rows={acquisition} color={color} />
      <SheetSection title={t.techniqueDetails} rows={details} color={color} />
      <SheetSection title={t.battleData} rows={battle} color={color} />
    </aside>
  );
}
