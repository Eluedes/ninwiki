'use client';

// Lista de Artigos do Guia do painel (criar / editar / apagar), com filtro de situacao (rascunho / publicado).
// A equipe logada recebe tambem os rascunhos da API; o visitante so' recebe os publicados.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError, deleteGuideArticle, listGuideArticles, type ApiGuideArticle } from '@/lib/api-client';
import { GuideIcon } from '@/components/lore/guide-icons';
import { localizedName } from '@/lib/localized';
import { cn } from '@/lib/utils';

/** Lista de artigos do Guia no painel. */
export default function GuideArticlesAdminPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.guideAdmin;
  const { can } = useAuth();

  const [articles, setArticles] = useState<ApiGuideArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');

  useEffect(() => {
    let cancelled = false;
    listGuideArticles()
      .then((a) => {
        if (!cancelled) setArticles(a);
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

  async function handleDelete(a: ApiGuideArticle) {
    const name = localizedName(locale, a.title, a.titlePt);
    if (!window.confirm(t.confirmDelete.replace('{name}', name))) return;
    setBusyId(a.id);
    setError(null);
    try {
      await deleteGuideArticle(a.id);
      setArticles((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.deleteError);
    } finally {
      setBusyId(null);
    }
  }

  const shown = articles.filter((a) => statusFilter === 'all' || a.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.articlesTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.articlesSubtitle}</p>
        </div>
        <Link href="/admin/guides/edit/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.newArticle}
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'draft', 'published'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            )}
          >
            {s === 'all' ? t.all : s === 'draft' ? t.draft : t.published}
          </button>
        ))}
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
                <th className="px-4 py-3 font-semibold">{t.colTitle}</th>
                <th className="px-4 py-3 font-semibold">{t.colSection}</th>
                <th className="px-4 py-3 font-semibold">{t.colStatus}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <GuideIcon icon={a.icon} className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold leading-tight">{localizedName(locale, a.title, a.titlePt)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{a.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dict.lore.guideSections[a.section]} · {a.position}</td>
                  <td className="px-4 py-3">
                    {a.status === 'draft'
                      ? <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400">{t.draft}</span>
                      : <span className="text-xs text-muted-foreground">{t.published}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/guides/edit/${a.id}`}
                        title={t.edit}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {can('lore.delete') && (
                        <button
                          onClick={() => handleDelete(a)}
                          disabled={busyId === a.id}
                          title={t.delete}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400"
                        >
                          {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>}
        </div>
      )}
    </div>
  );
}
