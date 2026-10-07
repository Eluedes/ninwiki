'use client';

// Reports dos visitantes (painel; exige reports.manage): informacoes desatualizadas e erros de traducao apontados nas paginas.
// A equipe filtra por status/tipo, abre a pagina citada e marca como resolvido, descartado ou reabre, ou apaga.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ApiError, deleteReport, listReports, setReportStatus, type ApiReport, type ReportKind, type ReportStatus,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const STATUSES: (ReportStatus | 'all')[] = ['open', 'resolved', 'dismissed', 'all'];
const KINDS: ReportKind[] = ['outdated', 'translation', 'other'];

/** Cor do selo de cada tipo de report. */
const KIND_STYLE: Record<ReportKind, string> = {
  outdated: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  translation: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  other: 'border-border bg-secondary text-muted-foreground',
};

/** Pagina de reports dos visitantes. */
export default function ReportsPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.reportsPage;
  const [status, setStatus] = useState<ReportStatus | 'all'>('open');
  const [kind, setKind] = useState<ReportKind | undefined>(undefined);
  const [items, setItems] = useState<ApiReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Recarrega a lista com o filtro atual. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listReports(status, kind));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [status, kind, t.loadError]);

  useEffect(() => {
    // adiado por um instante (callback) para nao chamar setState direto dentro do efeito
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /** Roda uma acao num report, mostra o erro se houver e recarrega. */
  async function act(id: string, action: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
          {t.refresh}
        </Button>
      </div>

      {/* Filtros: status e tipo */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              status === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
            )}
          >
            {t[s]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {[undefined, ...KINDS].map((k) => (
          <button
            key={k ?? 'all'}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
            )}
          >
            {k ? t.kinds[k] : t.allKinds}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', KIND_STYLE[r.kind])}>{t.kinds[r.kind]}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t.targets[r.targetType]}</span>
                <Link href={r.targetPath} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  {r.targetName}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {r.status !== 'open' && (
                  <span className="ml-auto text-xs text-muted-foreground">{t[r.status]}{r.handledBy ? ` · ${t.handledBy} ${r.handledBy}` : ''}</span>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-card-foreground">{r.message}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.reportedOn} {new Date(r.createdAt).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US')}
                  {r.locale ? ` · ${t.language}: ${r.locale.toUpperCase()}` : ''}
                </span>
                <div className="flex gap-1.5">
                  {r.status === 'open' ? (
                    <>
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, () => setReportStatus(r.id, 'resolved'))}>
                        <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-500" />{t.resolve}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, () => setReportStatus(r.id, 'dismissed'))}>
                        <XCircle className="mr-1.5 h-4 w-4" />{t.dismiss}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, () => setReportStatus(r.id, 'open'))}>
                      <RotateCcw className="mr-1.5 h-4 w-4" />{t.reopen}
                    </Button>
                  )}
                  <Button
                    size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busyId === r.id} title={t.delete}
                    onClick={() => { if (window.confirm(t.confirmDelete)) void act(r.id, () => deleteReport(r.id)); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
