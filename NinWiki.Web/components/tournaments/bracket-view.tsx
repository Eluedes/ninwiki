'use client';

// Chave do torneio desenhada em HTML/CSS puro (sem biblioteca): colunas por rodada, cartoes de partida e linhas de ligacao.
// Eliminatoria simples = arvore (rola para o lado no celular); todos-contra-todos = partidas por rodada + tabela de classificacao.
// Se `onSelectMatch` vier, as partidas com os dois lados definidos viram botoes (o organizador clica para lancar o placar).

import { Check } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { fill } from '@/lib/i18n-tournaments';
import type { ApiCompetitor, ApiEntry, ApiMatch, ApiPhase } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const CARD_H = 76;   // altura reservada por partida da 1a rodada (px)

type Names = Map<string, ApiCompetitor>;

/** Uma linha do cartao (um lado da partida): nome, selo de vencedor e pontos. */
function Side({ comp, score, won, lost, bye, title }: { comp: ApiCompetitor | undefined; score: number | null; won: boolean; lost: boolean; bye: boolean; title?: string }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  return (
    <div title={title} className={cn('flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm', won && 'bg-primary/10 font-semibold', lost && 'text-muted-foreground')}>
      <span className={cn('flex min-w-0 items-center gap-1 truncate', !comp && 'italic text-muted-foreground')}>
        {won && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
        <span className="truncate">{comp ? comp.name : bye ? t.bye : t.tbd}</span>
      </span>
      <span className="shrink-0 tabular-nums">{score ?? ''}</span>
    </div>
  );
}

/** Cartao de uma partida (botao quando o organizador pode lancar o resultado). */
export function MatchCard({ match, names, members, onSelect, index }: { match: ApiMatch; names: Names; members: (c: ApiCompetitor) => string; onSelect?: (m: ApiMatch) => void; index?: number }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const a = match.competitorAId ? names.get(match.competitorAId) : undefined;
  const b = match.competitorBId ? names.get(match.competitorBId) : undefined;
  const bye = match.done && (!a || !b);
  const clickable = !!onSelect && !!a && !!b;
  const body = (
    <div className={cn('w-48 overflow-hidden rounded-lg border bg-card shadow-sm', match.done ? 'border-border' : 'border-primary/30', bye && 'opacity-60', clickable && 'hover:border-primary')}>
      <Side comp={a} score={match.scoreA} won={match.done && !!match.winnerId && match.winnerId === match.competitorAId} lost={match.done && !!match.winnerId && match.winnerId !== match.competitorAId} bye={bye} title={a ? members(a) : undefined} />
      <div className="border-t border-border" />
      <Side comp={b} score={match.scoreB} won={match.done && !!match.winnerId && match.winnerId === match.competitorBId} lost={match.done && !!match.winnerId && match.winnerId !== match.competitorBId} bye={bye} title={b ? members(b) : undefined} />
    </div>
  );
  const label = index !== undefined ? fill(t.matchN, { n: index }) : undefined;
  return clickable ? (
    <button type="button" onClick={() => onSelect?.(match)} aria-label={label ? `${label}: ${a?.name} / ${b?.name}` : `${a?.name} / ${b?.name}`} className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </button>
  ) : body;
}

/** Eliminatoria simples: uma coluna por rodada, com as linhas que ligam cada par ao jogo seguinte. */
function EliminationTree({ phase, names, members, onSelectMatch }: { phase: ApiPhase; names: Names; members: (c: ApiCompetitor) => string; onSelectMatch?: (m: ApiMatch) => void }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const rounds = new Map<number, ApiMatch[]>();
  for (const m of phase.matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m]);
  const keys = [...rounds.keys()].sort((x, y) => x - y);
  const last = keys[keys.length - 1];
  const firstCount = rounds.get(keys[0])?.length ?? 1;
  const title = (r: number) => (r === last ? t.roundFinal : r === last - 1 ? t.roundSemi : r === last - 2 ? t.roundQuarter : fill(t.roundN, { n: r }));
  return (
    <div className="overflow-x-auto pb-3" tabIndex={0} aria-label={t.scrollHint}>
      <div className="flex min-w-max gap-0">
        {keys.map((r) => {
          const list = [...(rounds.get(r) ?? [])].sort((x, y) => x.slot - y.slot);
          return (
            <div key={r} className="flex flex-col">
              <h4 className="mb-2 px-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">{title(r)}</h4>
              <div className="flex flex-1 flex-col" style={{ minHeight: firstCount * CARD_H }}>
                {list.map((m) => (
                  <div key={m.id} className="relative flex flex-1 items-center py-1.5 pr-4">
                    {r > 1 && <span className="h-0 w-4 shrink-0 border-t border-border" aria-hidden />}
                    <MatchCard match={m} names={names} members={members} onSelect={onSelectMatch} index={m.slot + 1} />
                    {/* ligacao com a partida seguinte: o par (slot par + impar) fecha uma "chave" que sai no meio */}
                    {r < last && (
                      <span aria-hidden className={cn('pointer-events-none absolute right-0 w-4 border-border', m.slot % 2 === 0 ? 'bottom-0 top-1/2 border-r border-t' : 'top-0 h-1/2 border-b border-r')} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Todos-contra-todos: partidas agrupadas por rodada + tabela de classificacao. */
function RoundRobin({ phase, names, members, onSelectMatch }: { phase: ApiPhase; names: Names; members: (c: ApiCompetitor) => string; onSelectMatch?: (m: ApiMatch) => void }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const rounds = new Map<number, ApiMatch[]>();
  for (const m of phase.matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m]);
  return (
    <div className="space-y-6">
      {phase.standings && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">{t.standings}</caption>
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">{t.colPos}</th>
                <th scope="col" className="px-3 py-2 text-left">{t.colName}</th>
                {[t.colPlayed, t.colWins, t.colDraws, t.colLosses, t.colDiff, t.colPoints].map((h) => <th key={h} scope="col" className="px-3 py-2 text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {phase.standings.map((s, i) => (
                <tr key={s.competitorId} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 font-medium" title={names.get(s.competitorId) ? members(names.get(s.competitorId)!) : undefined}>{names.get(s.competitorId)?.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.played}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.wins}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.draws}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.losses}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.pointsFor - s.pointsAgainst}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {[...rounds.keys()].sort((x, y) => x - y).map((r) => (
        <div key={r}>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{fill(t.roundN, { n: r })}</h4>
          <div className="flex flex-wrap gap-3">
            {rounds.get(r)!.map((m) => <MatchCard key={m.id} match={m} names={names} members={members} onSelect={onSelectMatch} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chave de uma fase (arvore ou tabela, conforme o formato). */
export function BracketView({ phase, entries, onSelectMatch }: { phase: ApiPhase; entries: ApiEntry[]; onSelectMatch?: (m: ApiMatch) => void }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const names: Names = new Map(phase.competitors.map((c) => [c.id, c]));
  const entryName = new Map(entries.map((e) => [e.id, e.displayName]));
  const members = (c: ApiCompetitor) => c.entryIds.map((id) => entryName.get(id) ?? '?').join(', ');
  if (phase.matches.length === 0) return <p className="text-sm text-muted-foreground">{t.noBracketYet}</p>;
  return phase.format === 'round_robin'
    ? <RoundRobin phase={phase} names={names} members={members} onSelectMatch={onSelectMatch} />
    : <EliminationTree phase={phase} names={names} members={members} onSelectMatch={onSelectMatch} />;
}
