'use client';

// Lista publica de torneios (/tournaments): filtro por estado, busca, "meus torneios" (se logado) e botao de criar.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { listTournaments, type ApiTournamentSummary, type TournamentStatus } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { cn, formatDate } from '@/lib/utils';
import { LoginButton, StatusBadge, useReader } from './shared';

const PAGE = 20;

/** Pagina /tournaments. */
export function TournamentsPageClient() {
  const { dict, locale } = useLanguage();
  const d = dict.tournaments;
  const { reader, loaded } = useReader();
  const [status, setStatus] = useState<TournamentStatus | undefined>(undefined);
  const [mine, setMine] = useState(false);
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader title={d.title} subtitle={d.subtitle} icon={<Trophy className="h-6 w-6" />}
        action={reader ? <Button asChild size="sm"><Link href="/tournaments/new">{d.create}</Link></Button> : undefined} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {loaded && !reader && <><span className="text-sm text-muted-foreground">{d.signInToCreate}</span><LoginButton /></>}
        {reader && <Button asChild size="sm" variant="outline"><Link href="/profile">{d.myProfile}</Link></Button>}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button key={f.label} type="button" aria-pressed={status === f.key && !mine} onClick={() => pick(() => { setStatus(f.key); setMine(false); })}
            className={cn('rounded-full border px-3 py-1 text-sm', status === f.key && !mine ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>{f.label}</button>
        ))}
        {reader && (
          <button type="button" aria-pressed={mine} onClick={() => pick(() => { setMine(true); setStatus(undefined); })}
            className={cn('rounded-full border px-3 py-1 text-sm', mine ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>{d.mine}</button>
        )}
        <Input className="ml-auto max-w-xs" value={q} placeholder={d.searchPlaceholder} aria-label={d.searchPlaceholder} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{d.loadError}</p>}
      {loading && data.items.length === 0 ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-label="loading" /> : data.items.length === 0 && !error ? (
        <p className="py-10 text-center text-muted-foreground">{d.empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.items.map((t) => (
            <li key={t.id}>
              <Link href={`/tournaments/${t.id}`} className="block h-full rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary">
                <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={t.status} />
                  {t.visibility === 'unlisted' && <span className="text-xs text-muted-foreground">{d.unlistedBadge}</span>}
                  {t.hidden && <span className="text-xs text-amber-500">{d.hiddenBadge}</span>}</div>
                <h3 className="font-semibold">{t.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{fill(d.by, { name: t.owner.gameName || t.owner.username })} - {fill(d.entries, { n: t.entryCount })}{t.phaseCount ? ` - ${fill(d.phasesCount, { n: t.phaseCount })}` : ''}</p>
                {t.championName && <p className="mt-1 text-xs font-medium text-primary">{fill(d.champion, { name: t.championName })}</p>}
                {t.startsAt && <p className="mt-1 text-xs text-muted-foreground">{fill(d.startsOn, { date: formatDate(t.startsAt, locale) })}</p>}
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
