'use client';

// Tabela generica reutilizada pelas paginas /admin/blog-posts e
// /admin/wiki-pages (ambas passam uma lista de ContentItem + o href
// base de edicao).
//
// ATENCAO - SO' VISUAL: o botao de editar (lapis) navega de verdade
// para a pagina de edicao, mas o botao de excluir (lixeira) NAO TEM
// onClick nenhum - e' puramente decorativo hoje. Nenhum dos dois
// realmente cria/edita/apaga nada no lib/data.ts, ja' que os dados sao
// um array estatico em memoria, nao um banco. Isso e' exatamente o que
// a Fase 4 do roadmap (CRUD real no painel) resolve.
//
// Tambem nao ha paginacao nem busca aqui - a tabela sempre renderiza
// a lista `items` inteira de uma vez, o que nao escala bem conforme
// o catalogo crescer.

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';
import type { ContentItem, ContentStatus } from '@/lib/data';

interface DataTableProps {
  items: ContentItem[];
  editHref: string; // prefixo da rota de edicao (ex: "/admin/wiki-pages/edit")
}

export function DataTable({ items, editHref }: DataTableProps) {
  const { dict } = useLanguage();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* overflow-x-auto: permite rolar a tabela horizontalmente em telas
          estreitas, em vez de quebrar o layout da pagina. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                {dict.admin.table.title}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                {dict.admin.table.category}
              </th>
              {/* coluna Author escondida em telas pequenas (hidden md:table-cell) */}
              <th className="hidden px-4 py-3 text-left font-semibold text-muted-foreground md:table-cell">
                {dict.admin.table.author}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                {dict.admin.table.status}
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                {dict.admin.table.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr
                key={item.id}
                className="transition-colors hover:bg-secondary/30"
              >
                <td className="px-4 py-3 font-medium text-card-foreground">
                  {item.title}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.category}
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                  {item.author}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {/* Editar: navega de verdade para a pagina de edicao
                        (que por sua vez ainda nao salva nada - ver
                        app/admin/wiki-pages/edit). */}
                    <Link
                      href={`${editHref}/${item.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                      title={dict.admin.table.edit}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    {/* Excluir: botao sem onClick - clicar nao faz nada.
                        Placeholder visual ate' a Fase 4 (CRUD real). */}
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400"
                      title={dict.admin.table.delete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Badge colorido de status (publicado = verde, rascunho = amarelo).
// Componente auxiliar interno, nao exportado - so' usado dentro desta tabela.
function StatusBadge({ status }: { status: ContentStatus }) {
  const { dict } = useLanguage();
  const isPublished = status === 'published';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        isPublished
          ? 'bg-emerald-900/30 text-emerald-400'
          : 'bg-amber-900/30 text-amber-400'
      )}
    >
      {isPublished ? dict.admin.table.published : dict.admin.table.draft}
    </span>
  );
}
