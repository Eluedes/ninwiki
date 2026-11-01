'use client';

// Moderacao de torneios (painel; exige tournaments.manage). A equipe NAO organiza torneios: so' esconde/mostra, corrige o nome ou apaga.

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Eye, EyeOff, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, deleteTournamentModeration, listTournamentsForModeration, moderateTournament, type ApiModerationTournament } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { StatusBadge } from '@/components/tournaments/shared';
import { formatDateTime } from '@/lib/utils';

/** Pagina /admin/tournaments. */
export default function TournamentsAdminPage() {
  const { dict, locale } = useLanguage();
  const t = dict.tournaments;
  const [rows, setRows] = useState<ApiModerationTournament[]>([]);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const h = setTimeout(() => setSearch(q.trim()), 350);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    let alive = true;
    listTournamentsForModeration({ q: search || undefined, hidden: onlyHidden ? true : undefined })
      .then((res) => { if (alive) { setRows(res); setError(null); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e instanceof ApiError ? e.message : t.adminError); setLoading(false); } });
    return () => { alive = false; };
  }, [search, onlyHidden, tick, t.adminError]);

  const act = useCallback(async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); setTick((n) => n + 1); } catch (e) { setError(e instanceof ApiError ? e.message : t.adminError); }
  }, [t.adminError]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{t.adminTitle}</h1><p className="text-sm text-muted-foreground">{t.adminSubtitle}</p></div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); setTick((n) => n + 1); }}><RefreshCw className="mr-1 h-4 w-4" />{t.adminRefresh}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={onlyHidden ? 'outline' : 'default'} onClick={() => { setLoading(true); setOnlyHidden(false); }}>{t.adminFilterAll}</Button>
        <Button size="sm" variant={onlyHidden ? 'default' : 'outline'} onClick={() => { setLoading(true); setOnlyHidden(true); }}>{t.adminFilterHidden}</Button>
        <Input className="max-w-xs" value={q} placeholder={t.adminSearch} aria-label={t.adminSearch} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="loading" /> : rows.length === 0 ? <p className="text-muted-foreground">{t.adminEmpty}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.name}</span><StatusBadge status={r.status} />
                  {r.hidden && <span className="text-xs text-amber-500">{t.hiddenBadge}{r.hiddenBy ? ` (${fill(t.adminHiddenBy, { name: r.hiddenBy })})` : ''}</span>}
                  {r.organizerHidden && <span className="text-xs text-muted-foreground">{t.hiddenByYouBadge}</span>}
                  {r.visibility === 'unlisted' && <span className="text-xs text-muted-foreground">{t.unlistedBadge}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{t.adminOrganizer}: {r.ownerName}{r.ownerBanned ? ` (${t.adminBanned})` : ''} - {fill(t.entries, { n: r.entryCount })} - {formatDateTime(r.createdAt, locale)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="ghost"><a href={`/tournaments/${r.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />{t.adminOpenPage}</a></Button>
                <Button size="sm" variant="outline" onClick={() => act(() => moderateTournament(r.id, { hidden: !r.hidden }))}>{r.hidden ? <Eye className="mr-1 h-4 w-4" /> : <EyeOff className="mr-1 h-4 w-4" />}{r.hidden ? t.adminShow : t.adminHide}</Button>
                <Button size="sm" variant="outline" onClick={() => { const n = prompt(t.adminRename, r.name); if (n && n.trim().length >= 3) act(() => moderateTournament(r.id, { name: n.trim() })); }}><Pencil className="mr-1 h-4 w-4" />{t.adminRename}</Button>
                <Button size="sm" variant="destructive" onClick={() => confirm(t.adminConfirmDelete) && act(() => deleteTournamentModeration(r.id))}><Trash2 className="mr-1 h-4 w-4" />{t.adminDelete}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
