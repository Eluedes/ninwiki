'use client';

// Menu lateral fixo do painel /admin, com navegacao entre as secoes
// (Overview, Conteudo, Blog Posts, Users) e link de volta ao site publico.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, Boxes, Sparkles, Zap, FileJson, History, UserCog, Castle, Building2, ShieldCheck, Bug, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { requiredPermissionFor } from '@/lib/admin-routes';
import { NinLogo } from '@/components/icons/nin-logo';

// `as const` congela o array/objetos como literais exatos (em vez de
// string generica), o que ajuda o TypeScript a checar que `key` bate
// com uma chave valida de dict.admin.sidebar.
const navItems = [
  { key: 'overview', href: '/admin', icon: LayoutDashboard },
  { key: 'content', href: '/admin/content', icon: Boxes },
  { key: 'masteries', href: '/admin/masteries', icon: Sparkles },
  { key: 'jutsus', href: '/admin/jutsus', icon: Zap },
  { key: 'bulkImport', href: '/admin/import', icon: FileJson },
  { key: 'blogPosts', href: '/admin/blog-posts', icon: FileText },
  { key: 'auditLog', href: '/admin/audit-log', icon: History },
  { key: 'villages', href: '/admin/villages', icon: Castle },
  { key: 'organizations', href: '/admin/organizations', icon: Building2 },
  { key: 'staff', href: '/admin/staff', icon: UserCog },
  { key: 'permissions', href: '/admin/permissions', icon: ShieldCheck },
  { key: 'errors', href: '/admin/errors', icon: Bug },
] as const;

/** Menu lateral do painel, filtrado pelas permissoes do cargo. */
export function AdminSidebar() {
  const { dict } = useLanguage();
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    // sticky + h-screen: a sidebar fica fixa na tela inteira mesmo
    // rolando o conteudo principal ao lado.
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <NinLogo className="h-8 w-8" />
        <span className="text-sm font-bold tracking-tight">Admin Panel</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems
          // Esconde o que o cargo nao pode usar (mesmo mapa do guarda de paginas)
          .filter(({ href }) => {
            const required = requiredPermissionFor(href);
            return required === null || can(required);
          })
          .map(({ key, href, icon: Icon }) => {
          // "Overview" (/admin) precisa de comparacao EXATA, senao
          // ficaria marcado como ativo em qualquer sub-rota (ex:
          // /admin/users tambem comeca com "/admin"). As demais usam
          // startsWith para cobrir sub-rotas (ex: /admin/wiki-pages/edit/123
          // ainda deve destacar "wikiPages" no menu).
          const isActive =
            href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-card-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {dict.admin.sidebar[key]}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {dict.admin.sidebar.backToSite}
        </Link>
      </div>
    </aside>
  );
}
