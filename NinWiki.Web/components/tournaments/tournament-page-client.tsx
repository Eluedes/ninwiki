'use client';

// Pagina publica de um torneio (/tournaments/[id]): cabecalho com selo de estado, fases em abas com a chave desenhada, inscritos e,
// para o ORGANIZADOR logado, o painel de gestao e o lancamento de placar (clicando na partida). Visitante sem login so' le.
// Carrega no navegador porque a resposta depende de quem esta' logado (organizador, inscrito).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Copy, EyeOff, Loader2, Settings, Swords, Trophy, UserRound, Users } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, getTournament, joinTournament, leaveTournament, listNinjaRanks, listVillages, setMatchResult, type ApiEntry, type ApiMatch, type ApiNinjaRank, type ApiTournament, type ApiVillage } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { localizedName } from '@/lib/localized';
import { cn, formatDateTime } from '@/lib/utils';
import { BracketView } from './bracket-view';
import { OrganizerPanel } from './organizer-panel';
import { Podium } from './podium';
import { LoginButton, Section, StatusBadge, selectClass, teamModeLabel, useReader } from './shared';

/** Janela para lancar/corrigir o placar de uma partida (so' o organizador chega aqui). */
function ResultDialog({ t, match, onClose, onSaved }: { t: ApiTournament; match: ApiMatch | null; onClose: () => void; onSaved: (t: ApiTournament) => void }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const comp = (id: string | null) => t.phases.flatMap((p) => p.competitors).find((c) => c.id === id)?.name ?? '?';
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [winner, setWinner] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  // Ao abrir outra partida, recarrega os campos com o placar atual (ajuste durante a renderizacao, sem useEffect).
  if (match && match.id !== lastId) {
    setLastId(match.id);
    setA(match.scoreA?.toString() ?? '');
    setB(match.scoreB?.toString() ?? '');
    setWinner(match.winnerId ? (match.winnerId === match.competitorAId ? 'a' : 'b') : '');
    setError(null);
  }
  async function save() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      const res = await setMatchResult(t.id, match.id, { scoreA: a === '' ? null : Number(a), scoreB: b === '' ? null : Number(b), winner: (winner || null) as 'a' | 'b' | null });
      onSaved(res);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : d.actionError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.enterResult}</DialogTitle>
          <DialogDescription>{d.resultHint}</DialogDescription>
        </DialogHeader>
        {match && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label htmlFor="r-a" className="text-sm font-medium">{d.scoreA}: {comp(match.competitorAId)}</label><Input id="r-a" type="number" min={0} max={999} value={a} onChange={(e) => setA(e.target.value)} /></div>
              <div className="space-y-1.5"><label htmlFor="r-b" className="text-sm font-medium">{d.scoreB}: {comp(match.competitorBId)}</label><Input id="r-b" type="number" min={0} max={999} value={b} onChange={(e) => setB(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="r-w" className="text-sm font-medium">{d.winnerPick}</label>
              <select id="r-w" className={selectClass} value={winner} onChange={(e) => setWinner(e.target.value)}>
                <option value="">{d.winnerNone}</option>
                <option value="a">{comp(match.competitorAId)}</option>
                <option value="b">{comp(match.competitorBId)}</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{d.correctionHint}</p>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button onClick={save} disabled={busy}>{busy ? d.saving : d.saveResult}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pagina inteira do torneio `id`. */
export function TournamentPageClient({ id }: { id: string }) {
  const { dict, locale } = useLanguage();
  const d = dict.tournaments;
  const router = useRouter();
  const { reader, loaded } = useReader();
  const [t, setT] = useState<ApiTournament | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [selected, setSelected] = useState<ApiMatch | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [villages, setVillages] = useState<ApiVillage[]>([]);
  const [ranks, setRanks] = useState<ApiNinjaRank[]>([]);

  // Nomes de vila/rank para os cartoes de inscritos e do campeao (falha = so' nao mostra).
  useEffect(() => {
    let alive = true;
    listVillages().then((v) => alive && setVillages(v)).catch(() => {});
    listNinjaRanks().then((r) => alive && setRanks(r)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    getTournament(id)
      .then((res) => { if (alive) { setT(res); setState('ok'); } })
      .catch((e) => alive && setState(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error'));
    return () => { alive = false; };
  }, [id, loaded, reader?.id]);   // recarrega quando a sessao de leitor e' conhecida (isOrganizer/myEntryId)

  if (state === 'loading') return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="loading" /></div>;
  if (state !== 'ok' || !t) return <p className="py-20 text-center text-muted-foreground">{state === 'notfound' ? d.notFound : d.loadingError}</p>;

  async function toggleJoin() {
    if (!t) return;
    setBusy(true);
    setActionError(null);
    try {
      setT(t.myEntryId ? await leaveTournament(t.id) : await joinTournament(t.id));
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : d.actionError);
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* sem permissao da area de transferencia: ignora */ }
  }
  const fmt = (f: string) => (f === 'round_robin' ? d.formatRoundRobin : d.formatSingle);
  const activePhase = t.phases.find((p) => p.status === 'running') ?? t.phases[t.phases.length - 1];
  // So' o organizador (confirmado pela API em `isOrganizer`) recebe controles de edicao; para os demais tudo e' somente leitura.
  const isOrg = t.isOrganizer;
  const canScore = isOrg && !t.hidden && t.status !== 'finished';
  /** "Vila - Rank" da inscricao (vazio se o jogador nao preencheu o perfil). */
  const detail = (e: ApiEntry) => {
    const village = villages.find((v) => v.id === e.villageId);
    const rank = ranks.find((r) => r.id === e.ninjaRankId);
    return [village && localizedName(locale, village.name, village.namePt), rank && localizedName(locale, rank.name, rank.namePt)].filter(Boolean).join(' - ');
  };
  // Campeao: a inscricao com colocacao 1 (traz vila/rank); se nao houver (ex.: equipe), mostra so' o nome.
  const champEntry = t.entries.find((e) => e.placement === 1);
  const showChampion = t.status === 'finished' && !!t.championName;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title={t.name} breadcrumbs={[{ label: d.title, href: '/tournaments' }, { label: t.name }]}
        action={<Button variant="outline" size="sm" onClick={copyLink} aria-label={d.share}><Copy className="mr-1 h-4 w-4" aria-hidden />{copied ? d.copied : d.share}</Button>} />

      {/* faixa de informacoes: estado, organizador, inscritos, data */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <StatusBadge status={t.status} />
        {t.organizerHidden && <span className="rounded-full border border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">{d.hiddenByYouBadge}</span>}
        {t.visibility === 'unlisted' && <span className="rounded-full border border-border px-2 py-0.5 text-xs">{d.unlistedBadge}</span>}
        <span className="flex items-center gap-1.5"><UserRound className="h-4 w-4" aria-hidden />{d.organizerLabel}: <Link href={`/players/${t.owner.id}`} className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.owner.gameName || t.owner.username}</Link></span>
        <span className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{fill(d.entries, { n: t.entryCount })}</span>
        {t.startsAt && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{fill(d.startsOn, { date: formatDateTime(t.startsAt, locale) })}</span>}
      </div>
      {t.hidden && <p className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"><EyeOff className="h-4 w-4 shrink-0" aria-hidden />{d.hiddenNotice} {d.staffLockedNotice}</p>}
      {!t.hidden && t.organizerHidden && <p role="status" className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/60 bg-amber-500/15 px-3 py-2 text-sm font-medium"><EyeOff className="h-4 w-4 shrink-0" aria-hidden />{d.hiddenByYouNotice}</p>}

      {/* campeao em destaque */}
      {showChampion && (
        <div className="mb-6 flex items-center gap-4 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 shadow-sm">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-md"><Trophy className="h-7 w-7" aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">{d.championTitle}</p>
            <p className="truncate text-xl font-bold sm:text-2xl">{t.championName}</p>
            {champEntry && detail(champEntry) && <p className="truncate text-sm text-muted-foreground">{detail(champEntry)}</p>}
          </div>
        </div>
      )}

      {t.description && <p className="mb-6 whitespace-pre-line text-sm">{t.description}</p>}

      {/* entrar/sair (leitor logado) ou convite (visitante deslogado) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!loaded ? null : !reader ? (
          t.status === 'open' && !t.hidden && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"><span className="text-sm">{d.inviteJoin}</span><LoginButton /></div>
        ) : t.status === 'open' && !t.hidden ? (
          <Button onClick={toggleJoin} disabled={busy} variant={t.myEntryId ? 'outline' : 'default'}>{t.myEntryId ? d.leave : d.join}</Button>
        ) : t.myEntryId ? <span className="text-sm text-muted-foreground">{d.joined}</span>
          : <span className="text-sm text-muted-foreground">{t.status === 'draft' ? d.registrationNotOpen : d.registrationClosed}</span>}
        {reader && <Link href="/profile" className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{d.myProfile}</Link>}
        {actionError && <span role="alert" className="text-sm font-medium text-destructive">{actionError}</span>}
      </div>

      <Tabs defaultValue="bracket">
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="bracket" className="gap-1.5"><Swords className="h-4 w-4" aria-hidden />{d.tabBracket}</TabsTrigger>
          <TabsTrigger value="entries" className="gap-1.5"><Trophy className="h-4 w-4" aria-hidden />{d.tabPodium}</TabsTrigger>
          {isOrg && <TabsTrigger value="manage" className="gap-1.5"><Settings className="h-4 w-4" aria-hidden />{d.tabManage}</TabsTrigger>}
        </TabsList>

        <TabsContent value="bracket" className="mt-5">
          {t.phases.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">{d.noPhases}</p> : (
            <Tabs defaultValue={activePhase?.id} key={activePhase?.id}>
              <TabsList className="h-auto flex-wrap justify-start">
                {t.phases.map((p) => <TabsTrigger key={p.id} value={p.id}>{p.position}. {p.name}</TabsTrigger>)}
              </TabsList>
              {t.phases.map((p) => (
                <TabsContent key={p.id} value={p.id} className="mt-4 space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-0.5 font-semibold text-foreground">{teamModeLabel(d, p.teamSize)}</span>
                    <span>{fmt(p.format)}</span><span aria-hidden>-</span>
                    <span>{p.status === 'setup' ? d.phaseSetup : p.status === 'running' ? d.phaseRunning : d.phaseFinished}</span>
                  </p>
                  <BracketView phase={p} entries={t.entries} onSelectMatch={canScore && p.status === 'running' ? setSelected : undefined} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="entries" className="mt-5 space-y-5">
          <Podium entries={t.entries} finished={t.status === 'finished'} detail={detail} />
          <Section title={fill(d.entriesTitle, { n: t.entries.length })}>
            {t.entries.length === 0 ? <p className="text-sm text-muted-foreground">{d.noEntries}</p> : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...t.entries.entries()].sort(([, x], [, y]) => (x.placement ?? 999) - (y.placement ?? 999)).map(([i, e]) => {
                  const sub = detail(e);
                  const name = e.readerId
                    ? <Link href={`/players/${e.readerId}`} className="block truncate font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{e.displayName}</Link>
                    : <span className="block truncate font-semibold">{e.displayName}</span>;
                  return (
                    <li key={e.id} className={cn('flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5', e.placement === 1 ? 'border-amber-500/60' : 'border-border')}>
                      {/* avatar (ou inicial do nome) */}
                      {/* eslint-disable-next-line @next/next/no-img-element -- avatar externo do Discord */}
                      {e.avatarUrl ? <img src={e.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full" /> : <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">{e.displayName.charAt(0).toUpperCase()}</span>}
                      <div className="min-w-0 flex-1">
                        {name}
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="tabular-nums">{fill(d.seedN, { n: i + 1 })}</span>
                          {!e.readerId && <span className="rounded-full border border-border px-1.5 py-px">{d.guest}</span>}
                          {sub && <span className="truncate">{sub}</span>}
                        </p>
                      </div>
                      {e.placement && <span className={cn('flex shrink-0 items-center gap-1 text-xs font-semibold', e.placement === 1 ? 'text-amber-600 dark:text-amber-400' : 'text-primary')}>{e.placement === 1 && <Trophy className="h-3.5 w-3.5" aria-hidden />}{fill(d.place, { n: e.placement })}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </TabsContent>

        {isOrg && (
          <TabsContent value="manage" className="mt-5">
            {t.hidden ? <p className="text-sm text-muted-foreground">{d.hiddenNotice}</p> : <OrganizerPanel tournament={t} onChange={setT} onDeleted={() => router.push('/tournaments')} />}
          </TabsContent>
        )}
      </Tabs>
      {canScore && <ResultDialog t={t} match={selected} onClose={() => setSelected(null)} onSaved={setT} />}
    </div>
  );
}
