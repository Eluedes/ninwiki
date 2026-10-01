'use client';

// Lista de usuarios/staff do painel admin.
//
// ATENCAO - SO' VISUAL: assim como em data-table.tsx, os botoes de
// editar e excluir aqui NAO TEM onClick - nao fazem nada ao clicar.
// Esta tabela tambem nao usa o componente DataTable (e' uma tabela
// HTML escrita na mao, praticamente identica em estrutura) - outro
// candidato a unificacao quando o CRUD real for implementado.

import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import { adminUsers } from '@/lib/data';
import { Pencil, Trash2, Shield, ShieldCheck } from 'lucide-react';

/** Tela antiga de usuarios (substituida pela de Equipe). */
export default function UsersPage() {
  const { dict } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{dict.admin.users.title}</h1>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  {dict.admin.users.username}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  {dict.admin.users.role}
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-muted-foreground md:table-cell">
                  {dict.admin.users.joined}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                  {dict.admin.users.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adminUsers.map((user) => {
                const isAdmin = user.role === 'admin';
                const RoleIcon = isAdmin ? Shield : ShieldCheck;
                return (
                  <tr key={user.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                          {user.avatar}
                        </div>
                        <span className="font-medium text-card-foreground">
                          {user.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
                          isAdmin
                            ? 'bg-red-900/30 text-red-400'
                            : 'bg-emerald-900/30 text-emerald-400'
                        )}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {isAdmin ? dict.admin.header.role.admin : dict.admin.header.role.mod}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {user.joined}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Sem onClick - placeholder visual. */}
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                          title={dict.admin.table.edit}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400"
                          title={dict.admin.table.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
