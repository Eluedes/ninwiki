'use client';

// Gerenciamento da equipe (Fase 2): quem pode entrar no painel e com qual cargo.
//
// As regras de verdade (hierarquia, donos, ultimo S.Adm...) estao no backend
// (app/core/staff_service.py) - esta tela so' esconde/mostra o que a pessoa
// pode fazer. Se alguem forcar uma acao proibida, a API recusa com o motivo
// e ele aparece aqui.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, UserPlus, Lock, Pencil, Check, X, Trash2 } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { RoleBadge } from '@/components/admin/role-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ApiError, createStaff, deleteStaff, getRolesOverview, listStaff, setStaffActive, updateStaffName, updateStaffRole,
  type ApiCustomRole, type ApiStaff, type StaffRole,
} from '@/lib/api-client';
import { cn, formatDateTime } from '@/lib/utils';

// Hierarquia so' pra decidir o que MOSTRAR (o backend e' quem manda de verdade).
const RANK: Record<StaffRole, number> = { creator: 1, admin: 2, super_admin: 3 };

/** Tela da equipe (so' S.Adm): cadastrar, trocar cargo, desativar/reativar. */
export default function StaffPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.auth;
  const { me, can, refresh } = useAuth();

  const [staff, setStaff] = useState<ApiStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [discordId, setDiscordId] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<string>('creator'); // um cargo comum ('creator'...) ou 'custom:<id>'
  const [customRoles, setCustomRoles] = useState<ApiCustomRole[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // linha com o nome em edicao
  const [nameDraft, setNameDraft] = useState('');

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

  // Cargos personalizados (so' o S.Adm enxerga a tela de cargos; para os outros a lista fica vazia).
  useEffect(() => {
    if (!can('roles.manage')) return;
    getRolesOverview().then((o) => setCustomRoles(o.customRoles)).catch(() => setCustomRoles([]));
  }, [can]);

  const assignable = useMemo(() => me?.assignableRoles ?? [], [me]);
  // O cargo do formulario fica sempre dentro do que essa pessoa pode dar (derivado, sem efeito).
  const customChosen = role.startsWith('custom:') ? customRoles.find((r) => r.id === role.slice(7)) : undefined;
  const effectiveRole: StaffRole = customChosen ? 'creator' : (assignable.includes(role as StaffRole) ? (role as StaffRole) : (assignable[assignable.length - 1] ?? 'creator'));
  /** Valor do select de uma pessoa: o cargo comum ou 'custom:<id>'. */
  const valueOf = (m: ApiStaff) => (m.customRole ? `custom:${m.customRole.id}` : m.role);
  /** Aplica a escolha do select (cargo comum ou personalizado) a um membro. */
  const changeRole = (m: ApiStaff, value: string) =>
    run(m.id, () => (value.startsWith('custom:') ? updateStaffRole(m.id, 'creator', value.slice(7)) : updateStaffRole(m.id, value as StaffRole)));

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

  /** Salva o novo nome; se for o proprio nome do S.Adm logado, atualiza tambem o cabecalho do painel. */
  async function saveName(member: ApiStaff) {
    const name = nameDraft.trim();
    if (!name || name === member.username) {
      setEditingId(null);
      return;
    }
    await run(member.id, () => updateStaffName(member.id, name));
    setEditingId(null);
    if (member.id === me?.id) await refresh();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setActionError(null);
    try {
      const created = await createStaff({ discordId: discordId.trim(), role: effectiveRole, customRoleId: customChosen?.id ?? null, username: username.trim() || undefined });
      setStaff((prev) => [...prev, created]);
      setDiscordId('');
      setUsername('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setAdding(false);
    }
  }

  /** Remove a pessoa da equipe de vez (pede confirmacao); some da lista e perde o acesso na hora. */
  async function handleRemove(member: ApiStaff) {
    if (!window.confirm(t.confirmRemove.replace('{name}', member.username))) return;
    setBusyId(member.id);
    setActionError(null);
    try {
      await deleteStaff(member.id);
      setStaff((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusyId(null);
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
        {customRoles.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3">
            <RoleBadge role="creator" label={r.name} color={r.color} />
            <p className="mt-2 text-xs text-muted-foreground">{r.description || `${r.permissions.length} ${dict.admin.rolesPage.permission.toLowerCase()}`}</p>
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
                value={customChosen ? `custom:${customChosen.id}` : effectiveRole}
                onChange={(e) => setRole(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {assignable.map((r) => (
                  <option key={r} value={r}>{roleLabel[r]}</option>
                ))}
                {assignable.includes('creator') && customRoles.map((r) => (
                  <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
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
                          {editingId === m.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                autoFocus value={nameDraft} maxLength={100} className="h-8 w-48"
                                onChange={(e) => setNameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveName(m);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <button type="button" title={t.saveName} disabled={busy} onClick={() => saveName(m)}
                                className="rounded p-1.5 text-emerald-400 hover:bg-secondary">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button type="button" title={t.cancelName} onClick={() => setEditingId(null)}
                                className="rounded p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
                            </div>
                          ) : (
                            <p className="flex items-center gap-1 font-semibold leading-tight">
                              {m.username}
                              {m.id === me?.id && <span className="ml-1 text-xs font-normal text-muted-foreground">({t.you})</span>}
                              {can('staff.edit') && (
                                <button type="button" title={t.nameHint}
                                  onClick={() => { setEditingId(m.id); setNameDraft(m.username); }}
                                  className="ml-1 inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-card-foreground">
                                  <Pencil className="h-3 w-3" />{t.editName}
                                </button>
                              )}
                            </p>
                          )}
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
                          value={valueOf(m)}
                          disabled={busy}
                          onChange={(e) => changeRole(m, e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {/* inclui o cargo atual mesmo que a pessoa nao possa "dar" ele */}
                          {Array.from(new Set([m.role, ...assignable])).map((r) => (
                            <option key={r} value={r} disabled={!assignable.includes(r)}>{roleLabel[r]}</option>
                          ))}
                          {customRoles.map((r) => (
                            <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={m.role} label={m.customRole?.name} color={m.customRole?.color} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', m.isActive ? 'bg-emerald-900/30 text-emerald-400' : 'bg-secondary text-muted-foreground')}>
                        {m.isActive ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {m.lastLoginAt ? formatDateTime(m.lastLoginAt, locale) : t.neverLoggedIn}
                    </td>
                    <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                      {canManage && can('staff.delete') && (
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => handleRemove(m)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="mr-1.5 h-3 w-3" />{t.remove}
                        </Button>
                      )}
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
