'use client';

// Listagem de Jutsus - mesma migracao pra TanStack Table que a pagina
// de Conteudo (ver app/admin/content/page.tsx pros comentarios
// detalhados do padrao usado).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/language-provider';
import { Plus, Search, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  listJutsus,
  listMasteries,
  deleteJutsu,
  bulkDeleteJutsus,
  ApiError,
  type ApiJutsu,
  type ApiMastery,
} from '@/lib/api-client';
import { TanstackDataTable } from '@/components/admin/tanstack-data-table';

export default function JutsusListPage() {
  const { dict } = useLanguage();
  const t = dict.admin.jutsusList;
  const [jutsus, setJutsus] = useState<ApiJutsu[]>([]);
  const [masteries, setMasteries] = useState<ApiMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masteryFilter, setMasteryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [tableKey, setTableKey] = useState(0);

  useEffect(() => {
    Promise.all([listJutsus(), listMasteries()])
      .then(([j, m]) => {
        setJutsus(j);
        setMasteries(m);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t.loadError);
      })
      .finally(() => setLoading(false));
  }, [t.loadError]);

  const masteryName = (id: string) => masteries.find((m) => m.id === id)?.name ?? id;

  const filtered = jutsus
    .filter((j) => masteryFilter === 'all' || j.masteryId === masteryFilter)
    .filter((j) => j.name.toLowerCase().includes(search.toLowerCase()));

  async function handleDelete(id: string, name: string) {
    if (!confirm(t.deleteConfirm.replace('{name}', name))) return;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await deleteJutsu(id);
      setJutsus((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t.deleteError);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleBulkDelete(rows: ApiJutsu[], clearSelection: () => void) {
    if (!confirm(t.bulkDeleteConfirm.replace('{count}', String(rows.length)))) return;
    try {
      await bulkDeleteJutsus(rows.map((r) => r.id));
      const deletedIds = new Set(rows.map((r) => r.id));
      setJutsus((prev) => prev.filter((j) => !deletedIds.has(j.id)));
      clearSelection();
      setTableKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t.bulkDeleteError);
    }
  }

  const columns = useMemo<ColumnDef<ApiJutsu>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} aria-label={t.selectAll} />
      ),
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label={t.selectRow} />,
      enableSorting: false,
    },
    { accessorKey: 'name', header: t.colName, cell: ({ row }) => <span className="font-medium text-card-foreground">{row.original.name}</span> },
    {
      id: 'mastery',
      accessorFn: (row) => masteryName(row.masteryId),
      header: t.colMastery,
      cell: ({ row }) => <span className="text-muted-foreground">{masteryName(row.original.masteryId)}</span>,
    },
    { accessorKey: 'tier', header: t.colTier, cell: ({ row }) => `T${row.original.tier}` },
    { accessorKey: 'chakraCost', header: t.colChakra },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const jutsu = row.original;
        const busy = busyIds.has(jutsu.id);
        return (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/admin/jutsus/edit/${jutsu.id}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              title={t.edit}
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              onClick={() => handleDelete(jutsu.id, jutsu.name)}
              disabled={busy}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400 disabled:opacity-50"
              title={t.delete}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- masteryName depende de `masteries`, incluido abaixo
  ], [busyIds, masteries, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <Link href="/admin/jutsus/edit/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.newJutsu}
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setMasteryFilter('all')}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            masteryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
          )}
        >
          {t.all}
        </button>
        {masteries.map((m) => (
          <button
            key={m.id}
            onClick={() => setMasteryFilter(m.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              masteryFilter === m.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            )}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} className="pl-9" />
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
          <div>
            <p className="text-sm font-semibold text-destructive">{t.genericLoadError}</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <TanstackDataTable
          key={tableKey}
          columns={columns}
          data={filtered}
          emptyMessage={t.empty}
          bulkActions={(rows, clearSelection) => (
            <Button size="sm" variant="outline" className="text-red-400 hover:text-red-400" onClick={() => handleBulkDelete(rows, clearSelection)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t.delete}
            </Button>
          )}
        />
      )}
    </div>
  );
}
