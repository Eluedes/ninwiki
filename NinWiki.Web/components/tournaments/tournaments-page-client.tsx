'use client';

// Lista publica de torneios (/tournaments): filtro por estado, busca, "meus torneios" (se logado) e botao de criar.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Layers, Loader2, Search, Trophy, UserRound, Users } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { listTournaments, type ApiTournamentSummary, type TournamentStatus } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { cn, formatDate } from '@/lib/utils';
import { LoginButton, StatusBadge, useReader } from './shared';

const PAGE = 20;

/** Faixa lateral do cartao na cor do estado (combina com StatusBadge). */
const STRIPE: Record<TournamentStatus, string> = { draft: 'bg-muted-foreground/40', open: 'bg-emerald-500', running: 'bg-amber-500', finished: 'bg-sky-500' };

/** Pagina /tournaments. */
export function TournamentsPageClient({ initialMine = false }: { initialMine?: boolean }) {
  const { dict, locale } = useLanguage();
  const d = dict.tournaments;
  const { reader, loaded } = useReader();
  const [status, setStatus] = useState<TournamentStatus | undefined>(undefined);
  const [mine, setMine] = useState(initialMine);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ items: ApiTournamentSummary[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Espera o usuario parar de digitar antes de buscar.
  useEffect(() => {
    const h = setTimeout(() => { setSearch(q.trim()); setOffset(0); }, 350);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    let alive = true;
    listTournaments({ status, q: search || undefined, mine, limit: PAGE, offset })
      .then((res) => { if (alive) { setData((prev) => ({ items: offset === 0 ? res.items : [...prev.items, ...res.items], total: res.total })); setError(false); setLoading(false); } })
      .catch(() => { if (alive) { setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, [status, search, mine, offset]);

  const filters: { key: TournamentStatus | undefined; label: string }[] = [
    { key: undefined, label: d.all }, { key: 'open', label: d.statusOpen }, { key: 'running', label: d.statusRunning }, { key: 'finished', label: d.statusFinished },
  ];
  /** Troca um filtro e volta ao inicio da lista. */
  const pick = (fn: () => void) => { setLoading(true); setOffset(0); fn(); };

  /** Classe de um botao de filtro (pilula ativa x inativa). */
  const pill = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title={d.title} subtitle={d.subtitle} icon={<Trophy className="h-6 w-6" />}
        action={reader ? <Button asChild size="sm"><Link href="/tournaments/new">{d.create}</Link></Button> : undefined} />
      {loaded && !reader && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm">{d.signInToCreate}</span><LoginButton />
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label={d.filterLabel}>
        {filters.map((f) => (
          <button key={f.label} type="button" aria-pressed={status === f.key && !mine} onClick={() => pick(() => { setStatus(f.key); setMine(false); })} className={pill(status === f.key && !mine)}>{f.label}</button>
        ))}
        {reader && <button type="button" aria-pressed={mine} onClick={() => pick(() => { setMine(true); setStatus(undefined); })} className={pill(mine)}>{d.mine}</button>}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" value={q} placeholder={d.searchPlaceholder} aria-label={d.searchPlaceholder} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{d.loadError}</p>}
      {loading && data.items.length === 0 ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-label="loading" /> : data.items.length === 0 && !error ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><Trophy className="h-7 w-7" aria-hidden /></span>
          <p className="font-medium">{mine ? d.emptyMine : d.empty}</p>
          {!reader && <p className="text-sm text-muted-foreground">{d.emptyHint}</p>}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.items.map((t) => (
            <li key={t.id}>
              <Link href={`/tournaments/${t.id}`} className={cn('group relative block h-full overflow-hidden rounded-xl border bg-card p-4 pl-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', t.status === 'finished' ? 'border-border' : 'border-border')}>
                {/* faixa lateral na cor do estado */}
                <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', STRIPE[t.status])} />
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={t.status} />
                  {t.visibility === 'unlisted' && <span className="text-xs text-muted-foreground">{d.unlistedBadge}</span>}
                  {t.hidden && <span className="text-xs text-amber-500">{d.hiddenBadge}</span>}
                  {t.organizerHidden && <span className="text-xs text-amber-500">{d.hiddenByYouBadge}</span>}
                </div>
                <h3 className="text-lg font-semibold leading-snug group-hover:text-primary">{t.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" aria-hidden />{fill(d.by, { name: t.owner.gameName || t.owner.username })}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{fill(d.entries, { n: t.entryCount })}</span>
                  {t.phaseCount > 0 && <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" aria-hidden />{fill(d.phasesCount, { n: t.phaseCount })}</span>}
                  {t.startsAt && <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{fill(d.startsOn, { date: formatDate(t.startsAt, locale) })}</span>}
                </div>
                {t.championName && <p className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-sm font-semibold text-amber-600 dark:text-amber-400"><Trophy className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{fill(d.champion, { name: t.championName })}</span></p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data.items.length < data.total && (
        <div className="mt-5 text-center"><Button variant="outline" onClick={() => setOffset(data.items.length)}>{d.loadMore}</Button></div>
      )}
    </div>
  );
}
