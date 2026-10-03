'use client';

// Erros e problemas do wiki (rota /admin/errors) - SO' S.Adm (permissao errors.view).
// Lista o que quebrou (API, site, DeepL, flood), agrupado: um problema = uma linha com o contador de ocorrencias.
// Clique numa linha para ver o local no codigo, a rota e o traceback (mascarado). "Resolver" marca como resolvido;
// se o problema voltar a acontecer ele reabre sozinho e o bot avisa de novo no Discord.

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bug, ChevronDown, ChevronRight, Check, Globe, Languages, Loader2, RefreshCw, RotateCcw, Server, ShieldAlert, Trash2 } from 'lucide-react';
import {
  ApiError, deleteError, listErrors, reopenError, resolveError, type ApiErrorEvent,
} from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SOURCE_ICON = { api: Server, web: Globe, deepl: Languages, security: ShieldAlert } as const;
type Filter = 'open' | 'resolved' | 'all';

/** Tela do registro de erros: filtros, lista agrupada e detalhes expansiveis com traceback. */
export default function ErrorsPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.errorsPage;
  const [filter, setFilter] = useState<Filter>('open');
  const [source, setSource] = useState('');
  const [items, setItems] = useState<ApiErrorEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    listErrors(filter, source || undefined)
      .then((rows) => { setItems(rows); setError(null); })
      .catch((err) => setError(err instanceof ApiError ? err.message : t.loadError));
  }, [filter, source, t.loadError]);

  useEffect(() => { load(); }, [load]);

  /** Executa uma acao sobre um problema (resolver, reabrir, apagar) e recarrega a lista. */
  async function act(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusyId(null);
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Bug className="h-6 w-6 text-primary" />{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          <p className="text-xs text-muted-foreground">{t.howTo}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-4 w-4" />{t.refresh}</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['open', 'resolved', 'all'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('rounded-full border px-3 py-1 text-sm transition-colors', filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
            {t[f]}
          </button>
        ))}
        <select value={source} onChange={(e) => setSource(e.target.value)} className="ml-auto rounded-md border border-border bg-card px-2 py-1 text-sm">
          <option value="">{t.allSources}</option>
          {Object.entries(t.sources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" />{error}
        </div>
      )}

      {items === null && !error ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : items?.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="space-y-2">
          {items?.map((e) => {
            const Icon = SOURCE_ICON[e.source] ?? Bug;
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} className={cn('rounded-xl border bg-card shadow-sm', e.resolved ? 'border-border opacity-70' : e.level === 'error' ? 'border-red-900/50' : 'border-amber-900/50')}>
                <button onClick={() => setExpanded(isOpen ? null : e.id)} className="flex w-full items-start gap-3 p-4 text-left">
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', e.level === 'error' ? 'bg-red-900/30 text-red-400' : 'bg-amber-900/30 text-amber-400')}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{e.title}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{t.sources[e.source] ?? e.source}</span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{e.count} {t.occurrences}</span>
                      {e.resolved && <span className="rounded bg-emerald-900/30 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400">{t.resolved}</span>}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">{e.message}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{fmt(e.lastSeen)}{e.path ? ` · ${e.method ?? ''} ${e.path}` : ''}</span>
                  </span>
                  {isOpen ? <ChevronDown className="mt-1 h-4 w-4 text-muted-foreground" /> : <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-border p-4 text-sm">
                    {e.hintPt && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 p-3">
                        <p className="mb-1 text-xs font-semibold text-amber-400">💡 O que pode estar acontecendo</p>
                        <p className="text-sm leading-relaxed">{e.hintPt}</p>
                      </div>
                    )}
                    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {e.location && <div><dt className="text-xs text-muted-foreground">{t.where}</dt><dd className="font-mono text-xs">{e.location}</dd></div>}
                      {e.path && <div><dt className="text-xs text-muted-foreground">{t.route}</dt><dd className="font-mono text-xs">{e.method} {e.path}</dd></div>}
                      {e.status && <div><dt className="text-xs text-muted-foreground">{t.status}</dt><dd>{e.status}</dd></div>}
                      <div><dt className="text-xs text-muted-foreground">{t.firstSeen}</dt><dd>{fmt(e.firstSeen)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{t.lastSeen}</dt><dd>{fmt(e.lastSeen)}</dd></div>
                      {e.ipAddress && <div><dt className="text-xs text-muted-foreground">{t.ip}</dt><dd className="font-mono text-xs">{e.ipAddress}</dd></div>}
                      {e.resolved && e.resolvedBy && <div><dt className="text-xs text-muted-foreground">{t.resolvedBy}</dt><dd>{e.resolvedBy}{e.resolvedAt ? ` · ${fmt(e.resolvedAt)}` : ''}</dd></div>}
                    </dl>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground">{t.trace}</p>
                      <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-secondary/40 p-3 text-xs">{e.trace ?? t.noTrace}</pre>
                    </div>
                    <div className="flex gap-2">
                      {e.resolved ? (
                        <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => act(e.id, () => reopenError(e.id))}>
                          <RotateCcw className="mr-1.5 h-4 w-4" />{t.reopen}
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busyId === e.id} onClick={() => act(e.id, () => resolveError(e.id))}>
                          <Check className="mr-1.5 h-4 w-4" />{t.resolve}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busyId === e.id}
                        onClick={() => { if (window.confirm(t.confirmDelete)) void act(e.id, () => deleteError(e.id)); }}>
                        <Trash2 className="mr-1.5 h-4 w-4" />{t.delete}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
