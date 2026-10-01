'use client';

// Lista de Vilas do painel (criar / editar / apagar). Clas sao editados dentro de
// cada vila; Organizacoes tem tela propria (link no topo).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError, deleteVillage, listVillages, type ApiVillage } from '@/lib/api-client';
import { localizedName } from '@/lib/localized';

/** Lista de vilas no painel. */
export default function VillagesAdminPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.villagesAdmin;
  const { can } = useAuth();

  const [villages, setVillages] = useState<ApiVillage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listVillages()
      .then((v) => {
        if (!cancelled) setVillages(v);
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

  async function handleDelete(v: ApiVillage) {
    const name = localizedName(locale, v.name, v.namePt);
    if (!window.confirm(t.confirmDelete.replace('{name}', name))) return;
    setBusyId(v.id);
    setError(null);
    try {
      await deleteVillage(v.id);
      setVillages((prev) => prev.filter((x) => x.id !== v.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.deleteError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/organizations">
            <Button variant="outline">
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {t.manageOrgs}
            </Button>
          </Link>
          <Link href="/admin/villages/edit/new">
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              {t.newVillage}
            </Button>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t.colName}</th>
                <th className="px-4 py-3 font-semibold">{t.colElement}</th>
                <th className="px-4 py-3 font-semibold">{t.colLeader}</th>
                <th className="px-4 py-3 font-semibold">{t.colClans}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {villages.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl leading-none">{v.emblem}</span>
                      <div>
                        <p className="font-semibold leading-tight">{localizedName(locale, v.name, v.namePt)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{v.id}</p>
                      </div>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: v.accentColor }} />
                    </div>
                  </td>
                  <td className="px-4 py-3">{v.element}</td>
                  <td className="px-4 py-3">{v.leader}</td>
                  <td className="px-4 py-3">{v.clans.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/villages/edit/${v.id}`}
                        title={t.edit}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {can('lore.delete') && (
                        <button
                          onClick={() => handleDelete(v)}
                          disabled={busyId === v.id}
                          title={t.delete}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400"
                        >
                          {busyId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {villages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>}
        </div>
      )}
    </div>
  );
}
