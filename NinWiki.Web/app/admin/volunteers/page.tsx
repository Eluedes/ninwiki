'use client';

// Inscricoes de voluntarios (painel; exige volunteers.manage). Lista paginada com filtro de status e busca; cada cartao abre os
// detalhes (texto completo), onde a equipe muda o status, escreve notas internas ou apaga (pedido de exclusao de dados).

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Lock, LockOpen, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ApiError, deleteVolunteer, getVolunteerFormStatus, listVolunteers, setVolunteerFormStatus, updateVolunteer, VOLUNTEER_STATUSES, type ApiVolunteer, type VolunteerStatus,
} from '@/lib/api-client';
import { cn, formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 20;

/** Cor do selo de cada status. */
const STATUS_STYLE: Record<VolunteerStatus, string> = {
  new: 'border-primary/50 bg-primary/10 text-primary',
  reviewing: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  rejected: 'border-destructive/40 bg-destructive/10 text-destructive',
  contacted: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
};

/** Pagina de inscricoes de voluntarios. */
export default function VolunteersPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.volunteersPage;
  const [status, setStatus] = useState<VolunteerStatus | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');   // valor da busca ja' "assentado" (evita uma chamada por tecla)
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ items: ApiVolunteer[]; total: number; newCount: number }>({ items: [], total: 0, newCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<boolean | null>(null);   // interruptor do formulario publico (null = carregando)
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    getVolunteerFormStatus().then((s) => setFormOpen(s.enabled)).catch(() => setFormOpen(null));
  }, []);

  /** Abre ou fecha o formulario publico (fica no banco e no log). */
  async function toggleForm() {
    if (formOpen === null) return;
    setToggling(true);
    setError(null);
    try {
      setFormOpen((await setVolunteerFormStatus(!formOpen)).enabled);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.toggleError);
    } finally {
      setToggling(false);
    }
  }

  /** Recarrega a pagina atual com os filtros. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listVolunteers({ status, q: search, limit: PAGE_SIZE, offset }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [status, search, offset, t.loadError]);

  useEffect(() => {
    const timer = setTimeout(load, 0);   // adiado para nao chamar setState direto dentro do efeito
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setOffset(0); }, 350);   // espera a pessoa parar de digitar
    return () => clearTimeout(timer);
  }, [query]);

  /** Roda uma acao numa inscricao, mostra o erro se houver e recarrega. */
  async function act(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.actionError);
    } finally {
      setBusyId(null);
    }
  }

  /** Salva as notas internas do cartao aberto. */
  async function saveNotes(v: ApiVolunteer) {
    await act(v.id, () => updateVolunteer(v.id, { staffNotes: notes[v.id] ?? v.staffNotes ?? '' }));
    setSavedId(v.id);
  }

  const last = Math.min(offset + PAGE_SIZE, data.total);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t.title}
            {data.newCount > 0 && <span className="ml-3 rounded-full bg-primary px-2.5 py-0.5 align-middle text-xs font-semibold text-primary-foreground">{data.newCount} {t.newCount}</span>}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />{t.refresh}
        </Button>
      </div>

      {formOpen !== null && (
        <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4', formOpen ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10')}>
          <div className="flex items-start gap-3 text-sm">
            {formOpen ? <LockOpen className="mt-0.5 h-5 w-5 text-emerald-500" /> : <Lock className="mt-0.5 h-5 w-5 text-amber-500" />}
            <div><p className="font-semibold">{formOpen ? t.formOpen : t.formClosed}</p><p className="text-muted-foreground">{formOpen ? t.formOpenHint : t.formClosedHint}</p></div>
          </div>
          <Button size="sm" variant="outline" disabled={toggling} onClick={toggleForm}>{formOpen ? t.closeForm : t.openForm}</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {[undefined, ...VOLUNTEER_STATUSES].map((s) => (
          <button
            key={s ?? 'all'} type="button" onClick={() => { setStatus(s); setOffset(0); }}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}
          >
            {s ? t.statuses[s] : t.all}
          </button>
        ))}
        <Input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder={t.searchPh} aria-label={t.searchPh} className="ml-auto h-9 w-full sm:w-64" />
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {loading && data.items.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((v) => {
            const open = openId === v.id;
            return (
              <li key={v.id} className="rounded-xl border border-border bg-card shadow-sm">
                <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : v.id)} className="flex w-full flex-wrap items-center gap-2 p-4 text-left">
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[v.status])}>{t.statuses[v.status]}</span>
                  <span className="font-semibold">{v.discord}</span>
                  <span className="text-sm text-muted-foreground">· {v.gameNick}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(v.createdAt, locale)}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="space-y-4 border-t border-border p-4 text-sm">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {([['languages', v.languages], ['availability', v.availability], ['email', v.contactEmail ?? '—'], ['areas', v.areas.map((a) => dict.volunteer.areaNames[a] ?? a).join(', ')]] as const).map(([k, val]) => (
                        <div key={k}><dt className="text-xs font-semibold uppercase text-muted-foreground">{t[k]}</dt><dd className="break-words">{val}</dd></div>
                      ))}
                    </dl>
                    {([['motivation', v.motivation]] as const).map(([k, val]) => (
                      <div key={k}><p className="text-xs font-semibold uppercase text-muted-foreground">{t[k]}</p><p className="whitespace-pre-wrap break-words">{val}</p></div>
                    ))}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">{t.setStatus}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {VOLUNTEER_STATUSES.map((s) => (
                          <Button key={s} size="sm" variant={v.status === s ? 'default' : 'outline'} disabled={busyId === v.id || v.status === s} onClick={() => act(v.id, () => updateVolunteer(v.id, { status: s }))}>
                            {t.statuses[s]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor={`n-${v.id}`} className="text-xs font-semibold uppercase text-muted-foreground">{t.notes}</label>
                      <Textarea id={`n-${v.id}`} rows={3} maxLength={2000} placeholder={t.notesPh} value={notes[v.id] ?? v.staffNotes ?? ''} onChange={(e) => { setNotes({ ...notes, [v.id]: e.target.value }); setSavedId(null); }} />
                      <div className="flex items-center gap-3">
                        <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => saveNotes(v)}>{t.saveNotes}</Button>
                        <span aria-live="polite" className="text-xs text-emerald-500">{savedId === v.id ? t.saved : ''}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{v.reviewedBy ? `${t.reviewedBy} ${v.reviewedBy}${v.reviewedAt ? ` · ${formatDateTime(v.reviewedAt, locale)}` : ''}` : ''}</span>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busyId === v.id}
                        onClick={() => { if (window.confirm(t.confirmDelete)) void act(v.id, () => deleteVolunteer(v.id)); }}>
                        <Trash2 className="mr-1.5 h-4 w-4" />{t.delete}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t.showing} {offset + 1}–{last} / {data.total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{t.prev}</Button>
            <Button size="sm" variant="outline" disabled={last >= data.total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>{t.next}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
