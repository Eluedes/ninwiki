'use client';

// Permissoes por cargo (rota /admin/permissions) - SO' o S.Adm.
// Matriz "permissao x cargo" (Adm e Creator): marca/desmarca e salva. Vale na hora.
// Permissoes exclusivas do S.Adm aparecem travadas. A seguranca de verdade esta' na API
// (PUT /roles/{cargo}/permissions exige roles.manage e recusa permissao exclusiva do S.Adm).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Lock, RotateCcw, Save } from 'lucide-react';
import {
  ApiError, getRolesOverview, resetRolePermissions, setRolePermissions,
  type ApiRolesOverview, type PermissionName, type StaffRole,
} from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EDITABLE: StaffRole[] = ['admin', 'creator'];
const GROUP_ORDER = ['content', 'posts', 'lore', 'tools', 'notices', 'audit', 'staff'];

type Draft = Record<string, Set<PermissionName>>;

/** Transforma a visao da API em rascunho editavel: cargo -> conjunto de permissoes marcadas. */
function toDraft(o: ApiRolesOverview): Draft {
  const d: Draft = {};
  for (const r of o.roles) d[r.role] = new Set(r.permissions);
  return d;
}

type Rows = ApiRolesOverview['permissions'];
type T = ReturnType<typeof useLanguage>['dict']['admin']['rolesPage'];

/** Linhas de um grupo de permissoes: nome, cadeado se for exclusiva do S.Adm e uma caixa por cargo. */
function GroupRows({ title, items, draft, toggle, labels, busy, t }: {
  title: string; items: Rows; draft: Draft; toggle: (r: StaffRole, p: PermissionName) => void;
  labels: Record<string, string>; busy: boolean; t: T;
}) {
  return (
    <>
      <tr className="bg-secondary/30">
        <td colSpan={1 + EDITABLE.length} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</td>
      </tr>
      {items.map((p) => (
        <tr key={p.name} className="border-b border-border/60 last:border-0">
          <td className="px-4 py-2.5">
            <span className={cn(p.superOnly && 'text-muted-foreground')}>{t.names[p.name] ?? p.name}</span>
            <span className="ml-2 font-mono text-[11px] text-muted-foreground/70">{p.name}</span>
            {p.superOnly && (
              <span title={t.lockedHint} className="ml-2 inline-flex items-center gap-1 rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                <Lock className="h-3 w-3" />{t.locked}
              </span>
            )}
          </td>
          {EDITABLE.map((role) => (
            <td key={role} className="px-4 py-2.5 text-center">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--primary))] disabled:opacity-40"
                checked={!p.superOnly && (draft[role]?.has(p.name) ?? false)}
                disabled={p.superOnly || busy}
                onChange={() => toggle(role, p.name)}
                aria-label={`${t.names[p.name] ?? p.name} - ${labels[role]}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Tela de permissoes por cargo (so' S.Adm): matriz permissao x cargo, salvar e restaurar padrao. */
export default function PermissionsPage() {
  const { dict } = useLanguage();
  const { refresh } = useAuth();
  const t = dict.admin.rolesPage;
  const [overview, setOverview] = useState<ApiRolesOverview | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<StaffRole | null>(null);
  const [savedRole, setSavedRole] = useState<StaffRole | null>(null);

  const apply = useCallback((o: ApiRolesOverview) => {
    setOverview(o);
    setDraft(toDraft(o));
  }, []);

  useEffect(() => {
    getRolesOverview()
      .then(apply)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.loadError));
  }, [apply, t.loadError]);

  const labels = useMemo(() => {
    const m: Record<string, string> = {};
    overview?.roles.forEach((r) => { m[r.role] = r.label; });
    return m;
  }, [overview]);

  const grouped = useMemo(() => {
    const groups: Record<string, ApiRolesOverview['permissions']> = {};
    overview?.permissions.forEach((p) => { (groups[p.group] ??= []).push(p); });
    return GROUP_ORDER.filter((g) => groups[g]).map((g) => ({ group: g, items: groups[g] }));
  }, [overview]);

  function dirty(role: StaffRole): boolean {
    const saved = overview?.roles.find((r) => r.role === role)?.permissions ?? [];
    const cur = draft[role] ?? new Set();
    return saved.length !== cur.size || saved.some((p) => !cur.has(p));
  }

  function toggle(role: StaffRole, perm: PermissionName) {
    setSavedRole(null);
    setDraft((prev) => {
      const next = new Set(prev[role]);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return { ...prev, [role]: next };
    });
  }

  async function save(role: StaffRole) {
    setBusy(role);
    setError(null);
    try {
      apply(await setRolePermissions(role, [...(draft[role] ?? [])]));
      setSavedRole(role);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setBusy(null);
    }
  }

  async function reset(role: StaffRole) {
    if (!window.confirm(t.confirmReset.replace('{role}', labels[role] ?? role))) return;
    setBusy(role);
    setError(null);
    try {
      apply(await resetRolePermissions(role));
      setSavedRole(role);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setBusy(null);
    }
  }

  if (!overview) {
    return error ? (
      <div className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle className="h-4 w-4" />{error}</div>
    ) : (
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.alwaysAll}</p>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" />{error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">{t.permission}</th>
              {EDITABLE.map((role) => (
                <th key={role} className="w-28 px-4 py-3 text-center font-semibold text-muted-foreground">
                  {labels[role]}
                  {dirty(role) && <span className="mt-0.5 block text-[10px] font-normal text-amber-400">{t.unsavedChanges}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ group, items }) => (
              <GroupRows key={group} title={t.groups[group] ?? group} items={items} draft={draft} toggle={toggle} labels={labels} busy={busy !== null} t={t} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-6">
        {EDITABLE.map((role) => (
          <div key={role} className="flex items-center gap-2">
            <Button size="sm" disabled={busy !== null || !dirty(role)} onClick={() => save(role)}>
              {busy === role ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {busy === role ? t.saving : `${t.save} ${labels[role]}`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => reset(role)}>
              <RotateCcw className="mr-1.5 h-4 w-4" />{t.reset}
            </Button>
            {savedRole === role && <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" />{t.saved}</span>}
          </div>
        ))}
      </div>
    </div>
  );

}
