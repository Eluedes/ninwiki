'use client';

// Pagina inicial de Proficiencias (rota /proficiencies): como elas funcionam (nivel maximo, bonus de habilidade, curva de XP), uma calculadora de XP
// e os cards de cada proficiencia (coleta e criacao), cada um levando para a sua pagina. A busca dos dados fica no Server Component
// app/(wiki)/(lore)/proficiencies/page.tsx. Os valores gerais (500, +1% a cada 10 niveis, 128*L-64) sao os registrados pela comunidade.

import { formatNumber } from '@/lib/utils';
import Link from 'next/link';
import { useState } from 'react';
import type { ApiProfession } from '@/lib/api-client';
import { PageHeader } from '@/components/lore/page-header';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName, localizedText } from '@/lib/localized';
import { Hammer, Pickaxe } from 'lucide-react';

const MAX_LEVEL = 500;
const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];

/** XP total do nivel 1 ate o nivel N: soma de (128*L - 64) para L = 1..N-1 = 64 * (N-1)^2. */
export function totalXp(level: number): number {
  return 64 * (level - 1) * (level - 1);
}

/** Bonus de habilidade (%) no nivel N: 1% a cada 10 niveis, ate 50% no nivel 500. */
export function skillBonus(level: number): number {
  return Math.floor(level / 10);
}

/** Troca "{n}" no texto traduzido. */
function withCount(text: string, n: number): string {
  return text.replace('{n}', String(n));
}

/** Cards de uma lista de proficiencias (um grupo). */
function ProfessionCards({ list }: { list: ApiProfession[] }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => {
        const d = p.details ?? {};
        const counts = [
          d.recipes?.length ? withCount(t.profRecipesCount, d.recipes.length) : null,
          d.resources?.length ? withCount(t.profResourcesCount, d.resources.length) : null,
          d.tools?.length ? withCount(t.profToolsCount, d.tools.length) : null,
        ].filter(Boolean);
        return (
          <Link key={p.id} href={`/proficiencies/${p.id}`} className="group dossier-panel flex flex-col gap-2 p-4 transition-colors hover:border-primary/50">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/60 text-2xl leading-none">{p.icon}</span>
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-ink-100 group-hover:text-primary">{localizedName(locale, p.name, p.namePt)}</p>
                {counts.length > 0 && <p className="text-xs text-muted-foreground">{counts.join(' · ')}</p>}
              </div>
            </div>
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{localizedText(locale, p.description, p.descriptionPt)}</p>
            <p className="mt-auto text-xs font-medium text-primary">{t.professionOpen} →</p>
          </Link>
        );
      })}
    </div>
  );
}

/** Pagina de Proficiencias: regras gerais + calculadora + cards. */
export function ProficienciesPageClient({ professions }: { professions: ApiProfession[] }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  const fmt = (n: number) => formatNumber(n, locale);   // separador de milhar do idioma do site
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(100);
  const gathering = professions.filter((p) => p.group === 'gathering');
  const crafting = professions.filter((p) => p.group === 'crafting');
  const clamp = (n: number) => Math.min(MAX_LEVEL, Math.max(1, Math.floor(n) || 1));
  const needed = to > from ? totalXp(to) - totalXp(from) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.proficienciesTitle}
        subtitle={t.proficienciesSubtitle}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: t.proficienciesCrumb }]}
        icon={<Hammer className="h-7 w-7" />}
      />

      <div className="space-y-8">
        <section>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Pickaxe className="h-3.5 w-3.5" /> {t.guideGathering}</p>
          <ProfessionCards list={gathering} />
        </section>
        <section>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Hammer className="h-3.5 w-3.5" /> {t.guideCrafting}</p>
          <ProfessionCards list={crafting} />
        </section>

        <section className="dossier-panel p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{t.profHowTitle}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-card-foreground">
            <li>{t.profHowCap}</li>
            <li>{t.profHowBonus}</li>
            <li>{t.profHowFormula}</li>
            <li>{t.profHowExp}</li>
          </ul>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-card-foreground">{t.profCalcTitle}</h3>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-muted-foreground">
                  {t.profCalcFrom}
                  <Input type="number" min={1} max={MAX_LEVEL} value={from} onChange={(e) => setFrom(clamp(Number(e.target.value)))} className="mt-1 w-28" />
                </label>
                <label className="text-xs text-muted-foreground">
                  {t.profCalcTo}
                  <Input type="number" min={1} max={MAX_LEVEL} value={to} onChange={(e) => setTo(clamp(Number(e.target.value)))} className="mt-1 w-28" />
                </label>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {t.profCalcResult}: <span className="font-display text-xl font-bold text-primary">{fmt(needed)}</span> XP
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-card-foreground">{t.profMilestones}</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-1 font-medium">{t.profColLevel}</th>
                    <th className="py-1 font-medium">{t.profColXp}</th>
                    <th className="py-1 font-medium">{t.profColBonus}</th>
                  </tr>
                </thead>
                <tbody>
                  {MILESTONES.map((lv) => (
                    <tr key={lv} className="border-b border-border/50 last:border-0">
                      <td className="py-1 font-semibold text-card-foreground">{lv}</td>
                      <td className="py-1 text-muted-foreground">{fmt(totalXp(lv))}</td>
                      <td className="py-1 text-muted-foreground">+{skillBonus(lv)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t.profSources}</p>
        </section>
      </div>
    </div>
  );
}
