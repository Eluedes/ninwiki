'use client';

// Tabela generica do painel admin, construida com TanStack Table
// (biblioteca headless - ela cuida da logica de ordenacao/paginacao/
// selecao, a gente so' desenha o visual com os componentes do shadcn).
// SUBSTITUI as tabelas escritas na mao em /admin/content e
// /admin/jutsus (JSX com .map() direto) - a tabela antiga em
// components/admin/data-table.tsx continua existindo, usada so' pela
// pagina de Blog Posts (ainda mockada, fora do escopo desta rodada).
//
// O que isso resolve, dos "Proximos passos combinados" do ROADMAP.md:
//   1. TanStack Table no lugar da tabela manual (esta troca)
//   2. Paginacao + ordenacao de coluna (embutidas aqui)
//   3. Bulk actions (selecao de linha embutida aqui + barra de acao)

import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TanstackDataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  // Barra de acoes em massa (publicar/apagar varios) - so' aparece
  // quando pelo menos 1 linha esta' selecionada. `selectedRows` e' a
  // lista dos objetos de dado selecionados (nao so' os indices), pra'
  // quem usa este componente nao precisar re-buscar o item pelo id.
  bulkActions?: (selectedRows: TData[], clearSelection: () => void) => React.ReactNode;
  emptyMessage?: string;
}

export function TanstackDataTable<TData>({
  columns,
  data,
  bulkActions,
  emptyMessage,
}: TanstackDataTableProps<TData>) {
  const { dict } = useLanguage();
  const t = dict.admin.dataTable;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // O React Compiler (que nem esta ligado neste projeto) avisa que o TanStack Table devolve funcoes que
  // ele nao consegue memoizar - limitacao conhecida da biblioteca, sem efeito no funcionamento.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  return (
    <div className="space-y-3">
      {/* Barra de bulk actions - so' ocupa espaco quando tem selecao,
          pra' nao "pular" o layout toda hora que a pessoa marca/desmarca. */}
      {bulkActions && selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-card-foreground">
            {selectedRows.length} {selectedRows.length > 1 ? t.selectedPlural : t.selected}
          </span>
          <div className="flex items-center gap-2">
            {bulkActions(selectedRows, () => setRowSelection({}))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-secondary/50 hover:bg-secondary/50">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className={cn('font-semibold text-muted-foreground', canSort && 'cursor-pointer select-none')}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {header.isPlaceholder ? null : (
                          <span className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && sortDir === 'asc' && <ArrowUp className="h-3.5 w-3.5" />}
                            {canSort && sortDir === 'desc' && <ArrowDown className="h-3.5 w-3.5" />}
                          </span>
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                    {emptyMessage ?? t.noResults}
                  </TableCell>
                </TableRow>
              )}
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'} className="transition-colors hover:bg-secondary/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Controles de paginacao - pagina atual, total de paginas, e
          quantos itens mostrar por pagina. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t.itemsPerPage}</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t.pageOf
              .replace('{current}', String(table.getState().pagination.pageIndex + 1))
              .replace('{total}', String(Math.max(table.getPageCount(), 1)))}
            {' · '}{table.getFilteredRowModel().rows.length} {t.items}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
