'use client';

// Lista de Proficiencias do painel (criar / editar / apagar). Receitas, recursos e ferramentas NAO sao editados aqui:
// vem do importador (scripts/importar_profissoes_atlas.py); a lista so' mostra quanto cada uma tem.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError, deleteProfession, listProfessions, type ApiProfession } from '@/lib/api-client';
import { localizedName } from '@/lib/localized';

/** Lista de proficiencias no painel. */
export default function ProfessionsAdminPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.guideAdmin;
  const { can } = useAuth();

  const [professions, setProfessions] = useState<ApiProfession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProfessions()
      .then((p) => {
        if (!cancelled) setProfessions(p);
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

  async function handleDelete(p: ApiProfession) {
    const name = localizedName(locale, p.name, p.namePt);
    if (!window.confirm(t.confirmDelete.replace('{name}', name))) return;
    setBusyId(p.id);
    setError(null);
    try {
      await deleteProfession(p.id);
      setProfessions((prev) => prev.filter((x) => x.id !== p.id));
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
          <h1 className="text-2xl font-bold tracking-tight">{t.professionsTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.professionsSubtitle}</p>
        </div>
        <Link href="/admin/professions/edit/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.newProfession}
          </Button>
        </Link>
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
                <th className="px-4 py-3 font-semibold">{t.colGroup}</th>
                <th className="px-4 py-3 font-semibold">{t.colDetails}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {professions.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl leading-none">{p.icon}</span>
                      <div>
                        <p className="font-semibold leading-tight">{localizedName(locale, p.name, p.namePt)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.group === 'gathering' ? t.groupGathering : t.groupCrafting}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {t.detailsCount
                      .replace('{r}', String(p.details?.recipes?.length ?? 0))
                      .replace('{s}', String(p.details?.resources?.length ?? 0))
                      .replace('{t}', String(p.details?.tools?.length ?? 0))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/professions/edit/${p.id}`}
                        title={t.edit}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {can('lore.delete') && (
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={busyId === p.id}
                          title={t.delete}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400"
                        >
                          {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {professions.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>}
        </div>
      )}
    </div>
  );
}
