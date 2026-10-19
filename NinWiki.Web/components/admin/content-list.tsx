'use client';

// Listagem de Conteudo (mobs/itens/armas/missoes/guias) - conectada na
// API real. Cada categoria tem a sua propria pagina no menu (/admin/content/<categoria>); sem categoria mostra tudo.
// Usada por app/admin/content/page.tsx (tudo) e app/admin/content/[category]/page.tsx (uma categoria). Usa TanStack Table (components/admin/tanstack-data-table.tsx)
// pra' ordenacao de coluna, paginacao e selecao de linha (bulk actions),
// em vez da tabela feita na mao da versao anterior.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Plus, Search, Pencil, Trash2, Loader2, AlertTriangle, Send, FileEdit } from 'lucide-react';
import {
  listContentItems,
  deleteContentItem,
  bulkUpdateContentStatus,
  bulkDeleteContentItems,
  ApiError,
  type ApiContentItemSummary,
} from '@/lib/api-client';
import type { Category } from '@/lib/types';
import { TanstackDataTable } from '@/components/admin/tanstack-data-table';

/** Lista de entries do catalogo no painel (busca, filtro de situacao, acoes em massa); `category` fixa a categoria (vazio = todas). */
export function ContentList({ category }: { category?: Category }) {
  const { dict } = useLanguage();
  const { can } = useAuth();
  const t = dict.admin.contentList;
  const categoryLabel = useMemo<Record<Category | 'all', string>>(
    () => ({
      all: t.filterAll,
      mobs: dict.nav.mobs,
      items: dict.nav.items,
      weapons: dict.nav.weapons,
      missions: dict.nav.missions,
      guides: dict.nav.guides,
      masteries: dict.nav.masteries,
    }),
    [dict, t.filterAll]
  );
  const [items, setItems] = useState<ApiContentItemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Filtro por status (Todos / Rascunhos / Publicados): vale em qualquer categoria e so' esconde linhas da lista (nao recarrega).
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // Incrementar isso forca o React a montar uma TanstackDataTable NOVA
  // (via key={tableKey}), o que reseta a selecao de linha depois de uma
  // acao em massa - sem isso, a selecao continuaria "marcada" em cima
  // de linhas que talvez nem existam mais na lista.
  const [tableKey, setTableKey] = useState(0);

  // A pagina que usa este componente passa `key={categoria}`: trocar de categoria monta a lista de novo (com "carregando" ligado de inicio).
  useEffect(() => {
    listContentItems(category)
      .then(setItems)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t.loadError);
      })
      .finally(() => setLoading(false));
  }, [category, t.loadError]);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'all' || i.status === statusFilter));

  /** Troca o filtro de status e zera a selecao da tabela (as linhas mudam de posicao). */
  function changeStatusFilter(next: 'all' | 'draft' | 'published') {
    setStatusFilter(next);
    setTableKey((k) => k + 1);
  }

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(t.deleteConfirm.replace('{name}', name))) return;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await deleteContentItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t.deleteError);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [t.deleteConfirm, t.deleteError]);

  async function handleBulkStatus(rows: ApiContentItemSummary[], status: 'draft' | 'published', clearSelection: () => void) {
    try {
      const updated = await bulkUpdateContentStatus(rows.map((r) => r.id), status);
      const updatedIds = new Set(updated.map((u) => u.id));
      setItems((prev) => prev.map((i) => (updatedIds.has(i.id) ? { ...i, status } : i)));
      clearSelection();
      setTableKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t.bulkStatusError);
    }
  }

  async function handleBulkDelete(rows: ApiContentItemSummary[], clearSelection: () => void) {
    if (!confirm(t.bulkDeleteConfirm.replace('{count}', String(rows.length)))) return;
    try {
      await bulkDeleteContentItems(rows.map((r) => r.id));
      const deletedIds = new Set(rows.map((r) => r.id));
      setItems((prev) => prev.filter((i) => !deletedIds.has(i.id)));
      clearSelection();
      setTableKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t.bulkDeleteError);
    }
  }

  // useMemo: as definicoes de coluna nao mudam entre renders (so'
  // dependem de `busyIds`, pro botao de apagar mostrar o spinner certo) -
  // sem isso, o TanStack Table recriaria as colunas do zero a cada
  // digitacao no campo de busca, sem necessidade.
  const columns = useMemo<ColumnDef<ApiContentItemSummary>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label={t.selectAll}
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label={t.selectRow} />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: t.colName,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{row.original.icon}</span>
          <span className="font-medium text-card-foreground">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: t.colCategory,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {categoryLabel[row.original.category] ?? row.original.category}
          {(row.original.mobType || row.original.itemType) && (
            <span className="ml-1.5 text-xs text-muted-foreground/70">
              ({row.original.mobType ?? row.original.itemType})
            </span>
          )}
        </span>
      ),
    },
    { accessorKey: 'level', header: t.colLevel },
    { accessorKey: 'rarity', header: t.colRarity },
    {
      accessorKey: 'status',
      header: t.colStatus,
      cell: ({ row }) => (
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
            row.original.status === 'published' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'
          )}
        >
          {row.original.status === 'published' ? t.published : t.draft}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        const busy = busyIds.has(item.id);
        return (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/admin/content/edit/${item.id}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              title={t.edit}
            >
              <Pencil className="h-4 w-4" />
            </Link>
            {can('content.delete') && (
            <button
              onClick={() => handleDelete(item.id, item.name)}
              disabled={busy}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400 disabled:opacity-50"
              title={t.delete}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            )}
          </div>
        );
      },
    },
  ], [busyIds, t, categoryLabel, can, handleDelete]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{category ? categoryLabel[category] : dict.admin.sidebar.content}</h1>
        <Link href={category ? `/admin/content/edit/new?category=${category}` : '/admin/content/edit/new'}>
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.newEntry}
          </Button>
        </Link>
      </div>

      {/* Filtro por status: ver so' os rascunhos (ou so' os publicados) */}
      <div className="flex flex-wrap gap-1.5">
        {([['all', t.filterAll], ['draft', t.draft], ['published', t.published]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => changeStatusFilter(key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              statusFilter === key
                ? key === 'draft' ? 'border-amber-400/60 bg-amber-900/30 text-amber-300' : key === 'published' ? 'border-emerald-400/60 bg-emerald-900/30 text-emerald-300' : 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:text-card-foreground'
            )}
          >
            {label}
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
            <>
              {can('content.publish') && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleBulkStatus(rows, 'published', clearSelection)}>
                    <Send className="mr-1.5 h-3.5 w-3.5" /> {t.publish}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleBulkStatus(rows, 'draft', clearSelection)}>
                    <FileEdit className="mr-1.5 h-3.5 w-3.5" /> {t.markDraft}
                  </Button>
                </>
              )}
              {can('content.delete') && (
                <Button size="sm" variant="outline" className="text-red-400 hover:text-red-400" onClick={() => handleBulkDelete(rows, clearSelection)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t.delete}
                </Button>
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
