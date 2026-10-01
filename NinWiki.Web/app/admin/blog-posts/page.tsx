'use client';

// Lista de posts do blog no painel (dados reais da API): busca por titulo, status,
// autor, editar e apagar. Creator ve so' o que pode usar (nao apaga).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError, deletePost, listPosts, type ApiPostSummary } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function BlogPostsPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.blogAdmin;
  const { can } = useAuth();

  const [posts, setPosts] = useState<ApiPostSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPosts()
      .then((p) => {
        if (!cancelled) setPosts(p);
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

  const filtered = useMemo(
    () => posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase())),
    [posts, search]
  );

  async function handleDelete(post: ApiPostSummary) {
    if (!window.confirm(t.confirmDelete.replace('{title}', post.title))) return;
    setBusyId(post.id);
    setError(null);
    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
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
          <h1 className="text-2xl font-bold tracking-tight">{dict.admin.sidebar.blogPosts}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Link href="/admin/blog-posts/edit/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.newPost}
          </Button>
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} className="pl-9" />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.loading}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-semibold">{t.colTitle}</th>
                <th className="px-4 py-3 font-semibold">{t.colAuthor}</th>
                <th className="px-4 py-3 font-semibold">{t.colStatus}</th>
                <th className="px-4 py-3 font-semibold">{t.colUpdated}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold leading-tight">{p.title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.slug}</p>
                  </td>
                  <td className="px-4 py-3">{p.authorName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
                        p.status === 'published' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'
                      )}
                    >
                      {p.status === 'published' ? t.published : t.draft}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(p.updatedAt).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/blog-posts/edit/${p.id}`}
                        title={t.edit}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {can('posts.delete') && (
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
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>}
        </div>
      )}
    </div>
  );
}
