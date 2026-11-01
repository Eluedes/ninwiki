'use client';

// Chave do torneio desenhada em HTML/CSS puro (sem biblioteca), no estilo Challonge: colunas por rodada, cartoes compactos
// (semente + nome + placar), vencedor destacado, perdedor esmaecido e linhas de ligacao com geometria fixa (nunca descolam dos cartoes).
// Eliminatoria simples = arvore (arrastar/rolar para o lado + zoom); todos-contra-todos = tabela de classificacao + partidas por rodada.
// Se `onSelectMatch` vier, as partidas com os dois lados definidos viram botoes (so' o organizador recebe isso da pagina).

import { useRef, useState } from 'react';
import { Check, Minus, Plus, Trophy } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { fill } from '@/lib/i18n-tournaments';
import type { ApiCompetitor, ApiEntry, ApiMatch, ApiPhase } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const BASE_H = 88;    // altura reservada por partida da 1a rodada (px); cada rodada seguinte dobra
const CARD_W = 208;   // largura do cartao (px)
const CONN_W = 28;    // largura da coluna de linhas entre rodadas (px)
const ZOOMS = [0.75, 1, 1.25];

type Names = Map<string, ApiCompetitor>;

/** Uma linha do cartao (um lado da partida): semente, nome e placar. */
function Side({ comp, score, won, lost, bye, final, title }: { comp: ApiCompetitor | undefined; score: number | null; won: boolean; lost: boolean; bye: boolean; final: boolean; title?: string }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  return (
    <div title={title} className={cn('flex h-[30px] items-stretch text-sm', won && 'bg-primary/10 font-semibold', lost && 'text-muted-foreground opacity-70')}>
      {/* semente */}
      <span className={cn('flex w-7 shrink-0 items-center justify-center border-r border-border bg-muted/50 text-[11px] tabular-nums text-muted-foreground', won && 'bg-primary/15 text-primary')}>{comp?.seed ?? ''}</span>
      <span className={cn('flex min-w-0 flex-1 items-center gap-1 px-2', !comp && 'text-xs italic text-muted-foreground')}>
        {won && (final ? <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden /> : <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />)}
        <span className={cn('truncate', lost && 'line-through decoration-muted-foreground/40')}>{comp ? comp.name : bye ? t.bye : t.tbd}</span>
        {won && <span className="sr-only"> ({t.winner})</span>}
      </span>
      {/* placar */}
      <span className={cn('flex w-8 shrink-0 items-center justify-center border-l border-border text-xs font-bold tabular-nums', won ? 'bg-primary text-primary-foreground' : 'bg-muted/40')}>{score ?? ''}</span>
    </div>
  );
}

/** Cartao de uma partida (botao quando o organizador pode lancar o resultado). Pendente x concluida x aguardando ficam bem distintas. */
export function MatchCard({ match, names, members, onSelect, index, final }: { match: ApiMatch; names: Names; members: (c: ApiCompetitor) => string; onSelect?: (m: ApiMatch) => void; index?: number; final?: boolean }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const a = match.competitorAId ? names.get(match.competitorAId) : undefined;
  const b = match.competitorBId ? names.get(match.competitorBId) : undefined;
  const bye = match.done && (!a || !b);
  const waiting = !match.done && (!a || !b);   // ainda sem os dois oponentes
  const clickable = !!onSelect && !!a && !!b;
  const win = (id: string | null) => match.done && !!match.winnerId && match.winnerId === id;
  const lose = (id: string | null) => match.done && !!match.winnerId && match.winnerId !== id;
  const body = (
    <div style={{ width: CARD_W }} className={cn(
      'overflow-hidden rounded-md border bg-card shadow-sm transition-colors',
      match.done && !bye && 'border-border',
      !match.done && !waiting && 'border-amber-500/60 ring-1 ring-amber-500/20',   // pronta para jogar
      waiting && 'border-dashed border-border bg-muted/20',                         // aguardando oponente
      bye && 'border-dashed opacity-60',
      final && 'border-amber-500/70 shadow-md shadow-amber-500/10',
      clickable && 'hover:border-primary',
    )}>
      <Side comp={a} score={match.scoreA} won={win(match.competitorAId)} lost={lose(match.competitorAId)} bye={bye} final={!!final} title={a ? members(a) : undefined} />
      <div className="border-t border-border" />
      <Side comp={b} score={match.scoreB} won={win(match.competitorBId)} lost={lose(match.competitorBId)} bye={bye} final={!!final} title={b ? members(b) : undefined} />
    </div>
  );
  const label = index !== undefined ? fill(t.matchN, { n: index }) : undefined;
  return clickable ? (
    <button type="button" onClick={() => onSelect?.(match)} aria-label={label ? `${label}: ${a?.name} / ${b?.name}` : `${a?.name} / ${b?.name}`} className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      {body}
    </button>
  ) : body;
}

/** Eliminatoria simples: uma coluna por rodada; cada partida ocupa uma "celula" de altura fixa, entao as linhas acompanham os cartoes. */
function EliminationTree({ phase, names, members, onSelectMatch }: { phase: ApiPhase; names: Names; members: (c: ApiCompetitor) => string; onSelectMatch?: (m: ApiMatch) => void }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, x: 0, left: 0 });
  const rounds = new Map<number, ApiMatch[]>();
  for (const m of phase.matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m]);
  const keys = [...rounds.keys()].sort((x, y) => x - y);
  const last = keys[keys.length - 1];
  const firstCount = rounds.get(keys[0])?.length ?? 1;
  const title = (r: number) => (r === last ? t.roundFinal : r === last - 1 ? t.roundSemi : r === last - 2 ? t.roundQuarter : fill(t.roundN, { n: r }));
  const finalMatch = rounds.get(last)?.[0];
  const idx = (r: number) => r - keys[0];   // 0 na primeira rodada
  const zi = ZOOMS.indexOf(zoom);

  // Arrastar com o mouse para rolar (no celular o toque ja' rola sozinho).
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !scroller.current) return;
    drag.current = { active: true, moved: false, x: e.clientX, left: scroller.current.scrollLeft };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || !scroller.current) return;
    if (Math.abs(e.clientX - d.x) > 5) d.moved = true;
    if (d.moved) scroller.current.scrollLeft = d.left - (e.clientX - d.x);
  };
  const onUp = () => { drag.current.active = false; };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t.scrollHint}</p>
        <div className="flex items-center gap-1" role="group" aria-label="zoom">
          <button type="button" aria-label={t.zoomOut} disabled={zi <= 0} onClick={() => setZoom(ZOOMS[zi - 1])} className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Minus className="h-3.5 w-3.5" aria-hidden /></button>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label={t.zoomIn} disabled={zi >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[zi + 1])} className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus className="h-3.5 w-3.5" aria-hidden /></button>
        </div>
      </div>
      <div ref={scroller} tabIndex={0} role="region" aria-label={t.tabBracket}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        onClickCapture={(e) => { if (drag.current.moved) { e.stopPropagation(); e.preventDefault(); drag.current.moved = false; } }}
        className="cursor-grab overflow-x-auto rounded-xl border border-border bg-muted/20 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing">
        <div className="flex min-w-max" style={{ zoom }}>
          {keys.map((r) => {
            const list = [...(rounds.get(r) ?? [])].sort((x, y) => x.slot - y.slot);
            const h = BASE_H * 2 ** idx(r);   // altura da celula desta rodada
            const isLast = r === last;
            return (
              <div key={r} style={{ width: CARD_W + (isLast ? 0 : CONN_W) }}>
                <h4 className={cn('mb-3 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-center text-[11px] font-bold uppercase tracking-wider', isLast ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-border bg-card text-muted-foreground')} style={{ width: CARD_W }}>
                  {isLast && <Trophy className="h-3.5 w-3.5" aria-hidden />}{title(r)}
                </h4>
                <div className="relative" style={{ height: firstCount * BASE_H }}>
                  {list.map((m) => (
                    <div key={m.id} className="absolute left-0 flex items-center" style={{ top: m.slot * h, height: h }}>
                      <MatchCard match={m} names={names} members={members} onSelect={onSelectMatch} index={m.slot + 1} final={isLast && m.id === finalMatch?.id} />
                      {/* linhas: sai do meio do cartao, desce/sobe ate o encontro do par (borda da celula) e entra na partida seguinte */}
                      {!isLast && (
                        <span aria-hidden className="relative h-full" style={{ width: CONN_W }}>
                          <span className={cn('absolute left-0 top-1/2 h-px w-3.5', m.done ? 'bg-primary/60' : 'bg-border')} />
                          <span className={cn('absolute left-3.5 w-px', m.slot % 2 === 0 ? 'bottom-0 top-1/2' : 'bottom-1/2 top-0', m.done ? 'bg-primary/60' : 'bg-border')} />
                          <span className={cn('absolute left-3.5 right-0 h-px', m.slot % 2 === 0 ? 'bottom-0' : 'top-0', m.done ? 'bg-primary/60' : 'bg-border')} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Todos-contra-todos: tabela de classificacao + partidas agrupadas por rodada. */
function RoundRobin({ phase, names, members, onSelectMatch }: { phase: ApiPhase; names: Names; members: (c: ApiCompetitor) => string; onSelectMatch?: (m: ApiMatch) => void }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const rounds = new Map<number, ApiMatch[]>();
  for (const m of phase.matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m]);
  const medal = ['bg-amber-500 text-white', 'bg-slate-400 text-white', 'bg-orange-700 text-white'];   // ouro, prata, bronze
  return (
    <div className="space-y-6">
      {phase.standings && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[440px] text-sm">
            <caption className="sr-only">{t.standings}</caption>
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="w-12 px-3 py-2 text-left">{t.colPos}</th>
                <th scope="col" className="px-3 py-2 text-left">{t.colName}</th>
                {[t.colPlayed, t.colWins, t.colDraws, t.colLosses, t.colDiff, t.colPoints].map((h) => <th key={h} scope="col" className="px-3 py-2 text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {phase.standings.map((s, i) => {
                const diff = s.pointsFor - s.pointsAgainst;
                return (
                  <tr key={s.competitorId} className={cn('border-t border-border', i === 0 && 'bg-amber-500/5')}>
                    <td className="px-3 py-2"><span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums', medal[i] ?? 'bg-muted text-muted-foreground')}>{i + 1}</span></td>
                    <td className="px-3 py-2 font-medium" title={names.get(s.competitorId) ? members(names.get(s.competitorId)!) : undefined}>{names.get(s.competitorId)?.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.played}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.draws}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.losses}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', diff > 0 && 'text-emerald-600 dark:text-emerald-400', diff < 0 && 'text-destructive')}>{diff > 0 ? `+${diff}` : diff}</td>
                    <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{s.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {[...rounds.keys()].sort((x, y) => x - y).map((r) => (
        <div key={r}>
          <h4 className="mb-2 inline-block rounded-md border border-border bg-card px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{fill(t.roundN, { n: r })}</h4>
          <div className="flex flex-wrap gap-3">
            {rounds.get(r)!.map((m) => <MatchCard key={m.id} match={m} names={names} members={members} onSelect={onSelectMatch} index={m.slot + 1} />)}
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
  if (phase.matches.length === 0) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t.noBracketYet}</p>;
  return phase.format === 'round_robin'
    ? <RoundRobin phase={phase} names={names} members={members} onSelectMatch={onSelectMatch} />
    : <EliminationTree phase={phase} names={names} members={members} onSelectMatch={onSelectMatch} />;
}
