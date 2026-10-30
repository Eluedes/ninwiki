'use client';

// Janela de criar/editar um CARGO PERSONALIZADO (so' S.Adm): nome, cor, descricao e as permissoes que o cargo tem.
// A API valida tudo de novo (nome unico, cor #rrggbb, nada exclusivo do S.Adm); aqui so' guiamos a pessoa.

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleBadge } from '@/components/admin/role-badge';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, type ApiCustomRole, type ApiPermissionInfo, type CustomRoleInput, type PermissionName } from '@/lib/api-client';

const GROUP_ORDER = ['content', 'posts', 'lore', 'tools', 'notices', 'audit', 'staff'];
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#38bdf8', '#6366f1', '#a855f7', '#ec4899', '#64748b'];

/** Formulario (em janela) para criar ou editar um cargo personalizado; `role` vazio = criar. */
export function CustomRoleDialog({ open, onOpenChange, role, permissions, creatorDefaults, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ApiCustomRole | null;
  permissions: ApiPermissionInfo[];
  /** Permissoes que um Creator tem hoje: ponto de partida de um cargo novo. */
  creatorDefaults: PermissionName[];
  onSave: (input: CustomRoleInput) => Promise<void>;
}) {
  const { dict } = useLanguage();
  const t = dict.admin.rolesPage;
  const [name, setName] = useState(role?.name ?? '');
  const [color, setColor] = useState(role?.color ?? COLORS[5]);
  const [description, setDescription] = useState(role?.description ?? '');
  const [picked, setPicked] = useState<Set<PermissionName>>(new Set(role ? role.permissions : creatorDefaults));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grantable = permissions.filter((p) => !p.superOnly);
  const groups = GROUP_ORDER
    .map((g) => ({ group: g, items: grantable.filter((p) => p.group === g) }))
    .filter((g) => g.items.length > 0);

  function toggle(p: PermissionName) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t.nameRequired); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), color, description: description.trim(), permissions: [...picked] });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? t.editRole : t.newRole}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">{t.roleName}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">{t.preview}</label>
              <div className="flex h-10 items-center"><RoleBadge role="creator" label={name.trim() || '—'} color={color} /></div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t.roleColor}</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0" aria-label={t.roleColor} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t.roleDescription}</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{role ? t.baseNote : t.presetHint}</p>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={() => setPicked(new Set(grantable.map((p) => p.name)))}>{t.selectAll}</button>
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setPicked(new Set())}>{t.clearAll}</button>
              </div>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-3">
              {groups.map(({ group, items }) => (
                <div key={group}>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t.groups[group] ?? group}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {items.map((p) => (
                      <label key={p.name} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary/60">
                        <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={picked.has(p.name)} onChange={() => toggle(p.name)} />
                        <span>{t.names[p.name] ?? p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{dict.admin.auth.cancelName}</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{role ? t.saveRole : t.createRole}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
