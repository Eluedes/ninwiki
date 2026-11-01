'use client';

// Pagina publica de um torneio (/tournaments/[id]): cabecalho com selo de estado, fases em abas com a chave desenhada, inscritos e,
// para o ORGANIZADOR logado, o painel de gestao e o lancamento de placar (clicando na partida). Visitante sem login so' le.
// Carrega no navegador porque a resposta depende de quem esta' logado (organizador, inscrito).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, EyeOff, Loader2, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, getTournament, joinTournament, leaveTournament, setMatchResult, type ApiMatch, type ApiTournament } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { formatDateTime } from '@/lib/utils';
import { BracketView } from './bracket-view';
import { OrganizerPanel } from './organizer-panel';
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
  const canScore = t.isOrganizer && !t.hidden && t.status !== 'finished';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title={t.name} subtitle={t.championName ? fill(d.champion, { name: t.championName }) : undefined} breadcrumbs={[{ label: d.title, href: '/tournaments' }, { label: t.name }]}
        action={<Button variant="outline" size="sm" onClick={copyLink}><Copy className="mr-1 h-4 w-4" />{copied ? d.copied : d.share}</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge status={t.status} />
        {t.visibility === 'unlisted' && <span className="rounded-full border border-border px-2 py-0.5 text-xs">{d.unlistedBadge}</span>}
        <span>{d.organizerLabel}: <Link href={`/players/${t.owner.id}`} className="font-medium text-foreground hover:underline">{t.owner.gameName || t.owner.username}</Link></span>
        <span>{fill(d.entries, { n: t.entryCount })}</span>
        {t.startsAt && <span>{fill(d.startsOn, { date: formatDateTime(t.startsAt, locale) })}</span>}
      </div>
      {t.hidden && <p className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"><EyeOff className="h-4 w-4" aria-hidden />{d.hiddenNotice}</p>}
      {t.description && <p className="mb-6 whitespace-pre-line text-sm">{t.description}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {!loaded ? null : !reader ? (
          t.status === 'open' && <><span className="text-sm text-muted-foreground">{d.signInToJoin}</span><LoginButton /></>
        ) : t.status === 'open' && !t.hidden ? (
          <Button onClick={toggleJoin} disabled={busy} variant={t.myEntryId ? 'outline' : 'default'}>{t.myEntryId ? d.leave : d.join}</Button>
        ) : t.myEntryId ? <span className="text-sm text-muted-foreground">{d.joined}</span>
          : <span className="text-sm text-muted-foreground">{t.status === 'draft' ? d.registrationNotOpen : d.registrationClosed}</span>}
        {reader && <Link href="/profile" className="text-sm text-primary hover:underline">{d.myProfile}</Link>}
        {actionError && <span role="alert" className="text-sm font-medium text-destructive">{actionError}</span>}
      </div>

      <Tabs defaultValue="bracket">
        <TabsList>
          <TabsTrigger value="bracket">{d.tabBracket}</TabsTrigger>
          <TabsTrigger value="entries">{d.tabEntries}</TabsTrigger>
          {t.isOrganizer && <TabsTrigger value="manage">{d.tabManage}</TabsTrigger>}
        </TabsList>

        <TabsContent value="bracket" className="mt-5">
          {t.phases.length === 0 ? <p className="text-muted-foreground">{d.noPhases}</p> : (
            <Tabs defaultValue={activePhase?.id} key={activePhase?.id}>
              <TabsList className="h-auto flex-wrap">
                {t.phases.map((p) => <TabsTrigger key={p.id} value={p.id}>{p.position}. {p.name}</TabsTrigger>)}
              </TabsList>
              {t.phases.map((p) => (
                <TabsContent key={p.id} value={p.id} className="mt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">{teamModeLabel(d, p.teamSize)} - {fmt(p.format)} - {p.status === 'setup' ? d.phaseSetup : p.status === 'running' ? d.phaseRunning : d.phaseFinished}</p>
                  <BracketView phase={p} entries={t.entries} onSelectMatch={canScore && p.status === 'running' ? setSelected : undefined} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="entries" className="mt-5">
          <Section title={fill(d.entriesTitle, { n: t.entries.length })}>
            {t.entries.length === 0 ? <p className="text-sm text-muted-foreground">{d.noEntries}</p> : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {t.entries.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                    <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- avatar externo do Discord */}
                    {e.avatarUrl ? <img src={e.avatarUrl} alt="" className="h-6 w-6 rounded-full" /> : <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden />}
                    {e.readerId ? <Link href={`/players/${e.readerId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{e.displayName}</Link> : <span className="min-w-0 flex-1 truncate">{e.displayName} <span className="text-xs text-muted-foreground">({d.guest})</span></span>}
                    {e.placement && <span className="text-xs font-semibold text-primary">{fill(d.place, { n: e.placement })}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </TabsContent>

        {t.isOrganizer && (
          <TabsContent value="manage" className="mt-5">
            {t.hidden ? <p className="text-sm text-muted-foreground">{d.hiddenNotice}</p> : <OrganizerPanel tournament={t} onChange={setT} onDeleted={() => router.push('/tournaments')} />}
          </TabsContent>
        )}
      </Tabs>
      <ResultDialog t={t} match={selected} onClose={() => setSelected(null)} onSaved={setT} />
    </div>
  );
}
