'use client';

// Gerenciamento da equipe (Fase 2): quem pode entrar no painel e com qual cargo.
//
// As regras de verdade (hierarquia, donos, ultimo S.Adm...) estao no backend
// (app/core/staff_service.py) - esta tela so' esconde/mostra o que a pessoa
// pode fazer. Se alguem forcar uma acao proibida, a API recusa com o motivo
// e ele aparece aqui.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, UserPlus, Lock } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { RoleBadge } from '@/components/admin/role-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ApiError, createStaff, listStaff, setStaffActive, updateStaffRole,
  type ApiStaff, type StaffRole,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

// Hierarquia so' pra decidir o que MOSTRAR (o backend e' quem manda de verdade).
const RANK: Record<StaffRole, number> = { creator: 1, admin: 2, super_admin: 3 };

/** Tela da equipe (so' S.Adm): cadastrar, trocar cargo, desativar/reativar. */
export default function StaffPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.auth;
  const { me, can } = useAuth();

  const [staff, setStaff] = useState<ApiStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [discordId, setDiscordId] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<StaffRole>('creator');
  const [adding, setAdding] = useState(false);

  const roleLabel: Record<StaffRole, string> = {
    super_admin: t.roleSuperAdmin, admin: t.roleAdmin, creator: t.roleCreator,
  };
  const roleDescription: Record<StaffRole, string> = {
    super_admin: t.roleDescSuperAdmin, admin: t.roleDescAdmin, creator: t.roleDescCreator,
  };

  const load = useCallback(() => {
    listStaff()
      .then(setStaff)
      .catch((err) => setError(err instanceof ApiError ? err.message : t.loadError))
      .finally(() => setLoading(false));
  }, [t.loadError]);

  useEffect(load, [load]);

  const assignable = useMemo(() => me?.assignableRoles ?? [], [me]);
  // O cargo do formulario fica sempre dentro do que essa pessoa pode dar (derivado, sem efeito).
  const effectiveRole: StaffRole = assignable.includes(role) ? role : (assignable[assignable.length - 1] ?? role);

  // Esta pessoa pode mexer NESSE membro? (so' visual; o backend valida de novo)
  function manageable(member: ApiStaff): boolean {
    if (!me || member.id === me.id || member.isOwner) return false;
    return me.role === 'super_admin' || RANK[me.role] > RANK[member.role];
  }

  async function run(id: string, action: () => Promise<ApiStaff>) {
    setBusyId(id);
    setActionError(null);
    try {
      const updated = await action();
      setStaff((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setActionError(null);
    try {
      const created = await createStaff({ discordId: discordId.trim(), role: effectiveRole, username: username.trim() || undefined });
      setStaff((prev) => [...prev, created]);
      setDiscordId('');
      setUsername('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setAdding(false);
    }
  }

  function handleDeactivate(member: ApiStaff) {
    if (!window.confirm(t.confirmDeactivate.replace('{name}', member.username))) return;
    run(member.id, () => setStaffActive(member.id, false));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.staffTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.staffSubtitle}</p>
      </div>

      {/* legenda dos cargos */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(['super_admin', 'admin', 'creator'] as StaffRole[]).map((r) => (
          <div key={r} className="rounded-lg border border-border bg-card p-3">
            <RoleBadge role={r} />
            <p className="mt-2 text-xs text-muted-foreground">{roleDescription[r]}</p>
          </div>
        ))}
      </div>

      {can('staff.create') && assignable.length > 0 && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="h-4 w-4" /> {t.addStaff}
          </h2>
          <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">{t.discordId}</label>
              <Input
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                placeholder="123456789012345678"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">{t.displayName}</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">{t.role}</label>
              <select
                value={effectiveRole}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {assignable.map((r) => (
                  <option key={r} value={r}>{roleLabel[r]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={adding || discordId.length < 15}>
                {adding ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.adding}</>) : t.add}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t.discordIdHint} {t.displayNameHint}</p>
        </form>
      )}

      {actionError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{actionError}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{dict.admin.users.username}</th>
                <th className="px-4 py-3 font-semibold">{t.role}</th>
                <th className="px-4 py-3 font-semibold">{t.status}</th>
                <th className="px-4 py-3 font-semibold">{t.lastLogin}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => {
                const canManage = manageable(m);
                const busy = busyId === m.id;
                return (
                  <tr key={m.id} className={cn('border-b border-border last:border-0', !m.isActive && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full bg-secondary object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold uppercase">
                            {m.username.slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold leading-tight">
                            {m.username}
                            {m.id === me?.id && <span className="ml-1 text-xs font-normal text-muted-foreground">({t.you})</span>}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">{m.discordId}</p>
                        </div>
                        {m.isOwner && (
                          <span title={t.ownerHint} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                            <Lock className="h-3 w-3" /> {t.owner}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canManage && can('staff.edit') ? (
                        <select
                          value={m.role}
                          disabled={busy}
                          onChange={(e) => run(m.id, () => updateStaffRole(m.id, e.target.value as StaffRole))}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {/* inclui o cargo atual mesmo que a pessoa nao possa "dar" ele */}
                          {Array.from(new Set([m.role, ...assignable])).map((r) => (
                            <option key={r} value={r} disabled={!assignable.includes(r)}>{roleLabel[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', m.isActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-secondary text-muted-foreground')}>
                        {m.isActive ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US') : t.neverLoggedIn}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && can('staff.deactivate') ? (
                        m.isActive ? (
                          <Button variant="outline" size="sm" disabled={busy} onClick={() => handleDeactivate(m)}>
                            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}{t.deactivate}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(m.id, () => setStaffActive(m.id, true))}>
                            {busy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}{t.activate}
                          </Button>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {staff.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.noStaff}</p>}
        </div>
      )}
    </div>
  );
}
