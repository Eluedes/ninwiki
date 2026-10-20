'use client';

// Log geral do sistema - quem fez o que, quando e de onde (painel, bot, login).
// Le da tabela audit_log via GET /audit-log.
//
// Quem ve o que (a API e' quem decide, esta tela so' acompanha):
//   - Adm: so' o trabalho de CONTEUDO (criar/editar/apagar/publicar/upload).
//   - S.Adm: tudo - tambem logins, mudancas de equipe, tentativas negadas e o IP.

import { useEffect, useState } from 'react';
import {
  Loader2, AlertTriangle, Plus, Pencil, Trash2, History, LogIn, LogOut, UserCog, ShieldAlert, Upload,
} from 'lucide-react';
import { listAuditLog, ApiError, clearAuditLog, type ApiAuditLogEntry } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { RoleBadge } from '@/components/admin/role-badge';
import { cn } from '@/lib/utils';
import { auditTarget } from '@/lib/audit-target';

const ACTION_STYLE: Record<string, { icon: typeof Plus; className: string }> = {
  create: { icon: Plus, className: 'bg-emerald-900/30 text-emerald-400' },
  update: { icon: Pencil, className: 'bg-sky-900/30 text-sky-400' },
  delete: { icon: Trash2, className: 'bg-red-900/30 text-red-400' },
  'bulk-delete': { icon: Trash2, className: 'bg-red-900/30 text-red-400' },
  upload: { icon: Upload, className: 'bg-sky-900/30 text-sky-400' },
  login: { icon: LogIn, className: 'bg-emerald-900/30 text-emerald-400' },
  logout: { icon: LogOut, className: 'bg-secondary text-muted-foreground' },
  login_denied: { icon: ShieldAlert, className: 'bg-red-900/30 text-red-400' },
  permission_denied: { icon: ShieldAlert, className: 'bg-red-900/30 text-red-400' },
  role_change: { icon: UserCog, className: 'bg-amber-900/30 text-amber-400' },
  rename: { icon: UserCog, className: 'bg-amber-900/30 text-amber-400' },
  activate: { icon: UserCog, className: 'bg-emerald-900/30 text-emerald-400' },
  deactivate: { icon: UserCog, className: 'bg-red-900/30 text-red-400' },
};

// Filtro da tela -> tipo de registro que a API filtra (so' o S.Adm tem o log completo pra filtrar).
const FILTER_ENTITY_TYPE: Record<string, string | undefined> = {
  all: undefined, content: 'content_item', auth: 'auth', staff: 'staff', security: 'security',
};

/** Log geral do sistema (quem fez o que, quando e de onde). */
export default function AuditLogPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.auditLog;
  const a = dict.admin.auth;
  const { can } = useAuth();
  const seesEverything = can('audit.view_all');

  // Filtros por tipo de registro - so' o S.Adm tem o log completo pra filtrar.
  const filters: { key: string; label: string }[] = [
    { key: 'all', label: a.logAll },
    { key: 'content', label: a.logContent },
    { key: 'auth', label: a.logAuth },
    { key: 'staff', label: a.logStaff },
    { key: 'security', label: a.logSecurity },
  ];

  const [filter, setFilter] = useState('all');
  const [entries, setEntries] = useState<ApiAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null); // resultado da limpeza
  const [reloadKey, setReloadKey] = useState(0); // muda para recarregar a lista

  // O "carregando" do filtro novo e' ligado no CLIQUE (changeFilter), nao aqui dentro: chamar setState
  // direto no corpo de um efeito dispara renders em cascata.
  useEffect(() => {
    let cancelled = false;
    listAuditLog(100, FILTER_ENTITY_TYPE[filter])
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey, t.loadError]);

  /** Limpa o log (so' S.Adm): tudo, ou so' o que passou de N dias; pede confirmacao e recarrega a lista. */
  async function handleClear(days?: number) {
    const question = days ? t.clearConfirmOlder.replace('{days}', String(days)) : t.clearConfirmAll;
    if (!window.confirm(question)) return;
    setClearing(true);
    setNotice(null);
    setError(null);
    try {
      const { deleted } = await clearAuditLog(days);
      setNotice(t.clearDone.replace('{n}', String(deleted)));
      setLoading(true);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.clearError);
    } finally {
      setClearing(false);
    }
  }

  function changeFilter(next: string) {
    setFilter(next);
    setLoading(true);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {can('audit.clear') && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="text-xs font-semibold text-muted-foreground">{t.clearLog}:</span>
          <button disabled={clearing} onClick={() => handleClear(30)} className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-card-foreground disabled:opacity-50">{t.clearOlder30}</button>
          <button disabled={clearing} onClick={() => handleClear(7)} className="rounded-md bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-card-foreground disabled:opacity-50">{t.clearOlder7}</button>
          <button disabled={clearing} onClick={() => handleClear()} className="rounded-md bg-red-900/30 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-red-900/50 disabled:opacity-50">{t.clearAll}</button>
          {clearing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      {seesEverything && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{a.logByLabel}:</span>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => changeFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-card-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {entries.map((entry) => {
            const style = ACTION_STYLE[entry.action] ?? { icon: History, className: 'bg-secondary text-muted-foreground' };
            const Icon = style.icon;
            const actionLabel = a.logActions[entry.action] ?? entry.action;
            const entityLabel = a.logEntities[entry.entityType] ?? entry.entityType;
            // O que mostrar como "alvo": nome da entry, nome da pessoa (equipe/login) ou o id.
            const target = auditTarget(entry.diff, entry.entityId);   // sempre texto (renomear imagem grava o nome como {before, after})
            return (
              <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', style.className)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-card-foreground">
                    <span className="font-semibold">{entry.actorName ?? t.system}</span>
                    {entry.actorRole && <RoleBadge role={entry.actorRole} className="ml-1.5 px-1.5 py-0.5 align-middle text-[10px]" />}{' '}
                    {actionLabel}{' '}
                    <span className="text-muted-foreground">{entityLabel}</span>{' '}
                    <span className="font-medium">&quot;{target}&quot;</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.logSources[entry.source] ?? entry.source}
                    {entry.ipAddress && <span className="ml-2 font-mono">{entry.ipAddress}</span>}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US')}
                </span>
              </div>
            );
          })}
          {entries.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>}
        </div>
      )}
    </div>
  );
}
