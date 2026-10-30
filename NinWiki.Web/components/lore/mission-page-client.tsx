'use client';

// Pagina de UMA missao (rota /missions/[id]): cabecalho com nivel/rank/tipo, quem da' e onde, requisitos, objetivos e recompensas. Texto do wiki com
// [[alvo|rotulo]] vira miniatura + link quando o alvo e' um item/arma/mob publicado (`refs`, montado no Server Component).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ExternalLink, ScrollText, CheckCircle2, Gift } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { ItemRefChip } from '@/components/lore/item-ref-chip';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName } from '@/lib/localized';
import { parseMarkup, type Mission } from '@/lib/missions';
import type { ItemRef } from '@/lib/api-client';

/** Texto com referencias do wiki: pedaco simples = texto; alvo publicado = ItemRefChip; alvo sem pagina = so' o rotulo. */
function Markup({ text, refs }: { text: string; refs: Record<string, ItemRef> }) {
  return (
    <>
      {parseMarkup(text).map((seg, i) => {
        if ('text' in seg) return <span key={i}>{seg.text}</span>;
        const ref = refs[seg.target.toLowerCase()];
        if (!ref) return <span key={i}>{seg.label}</span>;
        const renamed = seg.label.toLowerCase() !== seg.target.toLowerCase();   // "[[Bat|Bats]]": mostra o rotulo do texto, nao o nome da pagina
        return <ItemRefChip key={i} item={renamed ? { ...ref, name: seg.label, namePt: null } : ref} />;
      })}
    </>
  );
}

/** Um bloco da pagina com titulo. */
function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="dossier-panel p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">{icon}{title}</h2>
      {children}
    </section>
  );
}

/** Pagina de detalhe de uma missao. */
export function MissionPageClient({ mission: m, refs, guides }: { mission: Mission; refs: Record<string, ItemRef>; guides: { id: string; title: string; titlePt: string | null }[] }) {
  const { locale, dict } = useLanguage();
  const t = dict.lore.missionsx;
  const hasStructured = !!(m.rewards.exp || m.rewards.ryo);
  const rewardLines = hasStructured ? (m.rewards.extra ? [m.rewards.extra] : []) : m.rewards.list;
  const facts: [string, ReactNode][] = [];
  if (m.npc) facts.push([t.giver, <Markup key="n" text={m.npc} refs={refs} />]);
  if (m.location) facts.push([t.location, <Markup key="l" text={m.location} refs={refs} />]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={m.name}
        breadcrumbs={[{ label: dict.lore.home, href: '/' }, { label: t.crumb, href: '/missions' }, { label: m.name }]}
        icon={<ScrollText className="h-7 w-7" />}
      />

      <div className="mb-5 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded bg-secondary px-2 py-1 text-muted-foreground">{m.level !== null ? t.levelFmt.replace('{n}', String(m.level)) : t.levelUnknown}</span>
        {m.rank && <span className="rounded bg-secondary px-2 py-1 text-muted-foreground">{t.rankFmt.replace('{r}', m.rank)}</span>}
        <span className="rounded bg-primary/10 px-2 py-1 text-primary">{t.types[m.type]}</span>
        {m.areas.map((a) => <span key={a} className="rounded bg-secondary px-2 py-1 text-muted-foreground">{t.areas[a]}</span>)}
        {m.inClient && <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" />{t.inClient}</span>}
      </div>

      <div className="space-y-4">
        {m.quote && (
          <blockquote className="rounded-lg border-l-4 border-primary/60 bg-secondary/40 p-4 text-sm italic leading-relaxed">
            <p className="mb-1 text-[11px] font-semibold not-italic uppercase tracking-wide text-muted-foreground">{t.request}</p>
            “{m.quote}”
          </blockquote>
        )}

        {(m.summary || facts.length > 0) && (
          <Panel title={t.about}>
            {m.summary && <p className="text-sm leading-relaxed"><Markup text={m.summary} refs={refs} /></p>}
            {m.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground"><Markup text={m.description} refs={refs} /></p>}
            {facts.length > 0 && (
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {facts.map(([k, v]) => (
                  <div key={k}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
            )}
          </Panel>
        )}

        {m.requirements.length > 0 && (
          <Panel title={t.requirements}>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {m.requirements.map((r, i) => <li key={i}><Markup text={r} refs={refs} /></li>)}
            </ul>
          </Panel>
        )}

        {m.objectives.length > 0 && (
          <Panel title={t.objectives}>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed marker:font-semibold marker:text-primary">
              {m.objectives.map((o, i) => <li key={i}><Markup text={o} refs={refs} /></li>)}
            </ol>
          </Panel>
        )}

        {(hasStructured || rewardLines.length > 0) && (
          <Panel title={t.rewards} icon={<Gift className="h-5 w-5 text-primary" />}>
            {hasStructured && (
              <div className="mb-2 flex flex-wrap gap-2 text-sm">
                {m.rewards.exp && <span className="rounded-md bg-primary/10 px-3 py-1.5 font-semibold text-primary">{m.rewards.exp} {t.rewardExp}</span>}
                {m.rewards.ryo && <span className="rounded-md bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-500">{m.rewards.ryo} {t.rewardRyo}</span>}
              </div>
            )}
            {rewardLines.length > 0 && (
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {rewardLines.map((r, i) => <li key={i}><Markup text={r} refs={refs} /></li>)}
              </ul>
            )}
          </Panel>
        )}

        {m.sections.map((s) => (
          <Panel key={s.title} title={s.title}>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {s.lines.map((l, i) => <li key={i}><Markup text={l} refs={refs} /></li>)}
            </ul>
          </Panel>
        ))}

        {(m.objectives.length === 0 || (!hasStructured && rewardLines.length === 0)) && <p className="text-sm italic text-muted-foreground">{t.partial}</p>}

        {guides.length > 0 && (
          <Panel title={t.howTitle}>
            <ul className="space-y-1 text-sm">
              {guides.map((g) => <li key={g.id}><Link href={`/guide/${g.id}`} className="text-primary hover:underline">{localizedName(locale, g.title, g.titlePt)}</Link></li>)}
            </ul>
          </Panel>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        {t.notice} {t.source}{' '}
        <a href={m.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Fandom <ExternalLink className="h-3 w-3" /></a>
      </p>
      <Link href="/missions" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t.back}
      </Link>
    </div>
  );
}
