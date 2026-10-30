'use client';

// Aba de historico de UMA entry especifica - reaproveita o mesmo
// audit_log que ja alimenta /admin/audit-log, so' filtrado por
// entityType+entityId (ver listEntryHistory em lib/api-client.ts).
// Embutido dentro dos editores de Conteudo e Jutsu, logo abaixo dos
// campos do formulario.

import { useEffect, useState } from 'react';
import { listEntryHistory, ApiError, type ApiAuditLogEntry, type HistoryEntityType } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { cn, formatDateTime } from '@/lib/utils';
import { Loader2, AlertTriangle, Plus, Pencil, Trash2, History } from 'lucide-react';

/** Resume em texto o que mudou numa linha do historico. */
function formatDiff(entry: ApiAuditLogEntry): string | null {
  const diff = entry.diff;
  if (!diff) return null;
  // update grava {before: {...}, after: {...}} - mostra so' os campos
  // que de fato mudaram, um por linha, em vez do objeto inteiro cru.
  if (entry.action === 'update' && diff.before && diff.after) {
    const before = diff.before as Record<string, unknown>;
    const after = diff.after as Record<string, unknown>;
    const changes = Object.keys(after)
      .filter((k) => before[k] !== after[k])
      .map((k) => `${k}: "${before[k]}" → "${after[k]}"`);
    return changes.length > 0 ? changes.join(', ') : null;
  }
  return null;
}

/** Secao 'Historico' de uma entry: quem mudou o que e quando. */
export function EntryHistory({ entityType, entityId }: { entityType: HistoryEntityType; entityId: string }) {
  const { dict, locale } = useLanguage();
  const t = dict.admin.entryHistory;
  const actionConfig: Record<string, { label: string; icon: typeof Plus; className: string }> = {
    create: { label: t.created, icon: Plus, className: 'bg-emerald-900/30 text-emerald-400' },
    update: { label: t.updated, icon: Pencil, className: 'bg-sky-900/30 text-sky-400' },
    delete: { label: t.deleted, icon: Trash2, className: 'bg-red-900/30 text-red-400' },
  };
  const [entries, setEntries] = useState<ApiAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEntryHistory(entityType, entityId)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.loadError))
      .finally(() => setLoading(false));
  }, [entityType, entityId, t.loadError]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{t.empty}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const cfg = actionConfig[entry.action] ?? { label: entry.action, icon: History, className: 'bg-secondary text-muted-foreground' };
        const Icon = cfg.icon;
        const changeSummary = formatDiff(entry);
        return (
          <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-border bg-card/50 px-3 py-2.5">
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', cfg.className)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-card-foreground">
                <span className="font-medium">{cfg.label}</span>
                {/* Quem fez: vem do log geral (fotografia do momento). Linhas
                    antigas, de antes do login existir, nao tem nome -> "Sistema". */}
                <span className="text-muted-foreground"> {entry.actorName ?? t.bySystem}</span>
              </p>
              {changeSummary && <p className="mt-0.5 text-xs text-muted-foreground">{changeSummary}</p>}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDateTime(entry.createdAt, locale)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
