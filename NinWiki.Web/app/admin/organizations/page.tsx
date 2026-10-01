'use client';

// Organizacoes (ANBU, Hunter Nin...): corpos especializados que podem atuar em MAIS de
// uma vila. A ligacao com as vilas e' editada aqui, do lado da organizacao.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import {
  ApiError, createOrganization, deleteOrganization, listOrganizations, listVillages, updateOrganization,
  type ApiOrganizationAdmin, type ApiVillage, type OrganizationInput,
} from '@/lib/api-client';
import { localizedName } from '@/lib/localized';
import { slugify } from '@/lib/utils';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMPTY: OrganizationInput = { id: '', name: '', description: '', villageIds: [] };

/** Organizacoes no painel: lista e formulario (liga cada organizacao a vilas). */
export default function OrganizationsAdminPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.villagesAdmin;
  const { can } = useAuth();

  const [orgs, setOrgs] = useState<ApiOrganizationAdmin[]>([]);
  const [villages, setVillages] = useState<ApiVillage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // null = formulario fechado; isNew decide se o id ainda pode ser editado
  const [form, setForm] = useState<{ data: OrganizationInput; isNew: boolean; idTouched: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOrganizations(), listVillages()])
      .then(([o, v]) => {
        if (cancelled) return;
        setOrgs(o);
        setVillages(v);
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
  }, [t.loadError]);

  function openNew() {
    setFormError(null);
    setForm({ data: { ...EMPTY }, isNew: true, idTouched: false });
  }

  function openEdit(o: ApiOrganizationAdmin) {
    setFormError(null);
    setForm({
      data: { id: o.id, name: o.name, description: o.description, villageIds: [...o.villageIds] },
      isNew: false,
      idTouched: true,
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { data, isNew } = form;
    if (!data.name.trim()) return setFormError('O nome é obrigatório.');
    if (!SLUG.test(data.id)) return setFormError('O id deve ter só letras minúsculas, números e hífen (ex: anbu).');
    setBusy(true);
    setFormError(null);
    try {
      const saved = isNew ? await createOrganization(data) : await updateOrganization(data.id, data);
      setOrgs((prev) =>
        isNew ? [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)) : prev.map((o) => (o.id === saved.id ? saved : o))
      );
      setForm(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(o: ApiOrganizationAdmin) {
    if (!window.confirm(t.orgConfirmDelete.replace('{name}', o.name))) return;
    setError(null);
    try {
      await deleteOrganization(o.id);
      setOrgs((prev) => prev.filter((x) => x.id !== o.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.deleteError);
    }
  }

  function toggleVillage(villageId: string, checked: boolean) {
    setForm((f) =>
      f && {
        ...f,
        data: {
          ...f.data,
          villageIds: checked ? [...f.data.villageIds, villageId] : f.data.villageIds.filter((v) => v !== villageId),
        },
      }
    );
  }

  const villageName = (id: string) => {
    const v = villages.find((x) => x.id === id);
    return v ? localizedName(locale, v.name, v.namePt) : id;
  };
  const label = 'text-sm font-semibold text-card-foreground';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/villages" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {t.backToVillages}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t.orgsTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.orgsSubtitle}</p>
        </div>
        {!form && (
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.newOrg}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {form && (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">{form.isNew ? t.newOrg : t.orgEditTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className={label}>{t.orgName}</label>
              <Input
                value={form.data.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => f && { ...f, data: { ...f.data, name, id: f.isNew && !f.idTouched ? slugify(name) : f.data.id } });
                }}
              />
            </div>
            <div className="space-y-2">
              <label className={label}>
                {t.idSlug} {!form.isNew && <span className="font-normal text-muted-foreground">{t.idSlugLocked}</span>}
              </label>
              <Input
                value={form.data.id}
                disabled={!form.isNew}
                className="font-mono"
                onChange={(e) => setForm((f) => f && { ...f, idTouched: true, data: { ...f.data, id: e.target.value } })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={label}>{t.orgDescription}</label>
            <Textarea
              rows={3}
              value={form.data.description}
              onChange={(e) => setForm((f) => f && { ...f, data: { ...f.data, description: e.target.value } })}
            />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.orgVillages}</label>
            {villages.length === 0 && <p className="text-sm text-muted-foreground">{t.noVillagesYet}</p>}
            <div className="flex flex-wrap gap-4">
              {villages.map((v) => (
                <label key={v.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.data.villageIds.includes(v.id)}
                    onCheckedChange={(checked) => toggleVillage(v.id, checked === true)}
                  />
                  <span>{v.emblem}</span> {localizedName(locale, v.name, v.namePt)}
                </label>
              ))}
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t.orgSave}
            </Button>
            <Button type="button" variant="outline" onClick={() => setForm(null)} disabled={busy}>
              {t.orgCancel}
            </Button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      )}

      {!loading && (
        <div className="space-y-2">
          {orgs.map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">
                  {o.name} <span className="font-mono text-xs font-normal text-muted-foreground">{o.id}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{o.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.orgVillages}: {o.villageIds.length ? o.villageIds.map(villageName).join(', ') : '—'}
                </p>
              </div>
              <button
                onClick={() => openEdit(o)}
                title={t.edit}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {can('lore.delete') && (
                <button
                  onClick={() => handleDelete(o)}
                  title={t.delete}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {orgs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.orgEmpty}</p>}
        </div>
      )}
    </div>
  );
}
