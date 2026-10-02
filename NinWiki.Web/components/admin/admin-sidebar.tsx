'use client';

// Menu lateral fixo do painel /admin, com navegacao entre as secoes
// (Overview, Conteudo, Blog Posts, Users) e link de volta ao site publico.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, Boxes, Sparkles, Zap, FileJson, History, UserCog, Castle, Building2, ShieldCheck, Bug, MessageSquare, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { requiredPermissionFor } from '@/lib/admin-routes';
import { NinLogo } from '@/components/icons/nin-logo';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { API_URL } from '@/lib/api-client';

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
  { key: 'comments', href: '/admin/comments', icon: MessageSquare },
  { key: 'auditLog', href: '/admin/audit-log', icon: History },
  { key: 'villages', href: '/admin/villages', icon: Castle },
  { key: 'organizations', href: '/admin/organizations', icon: Building2 },
  { key: 'staff', href: '/admin/staff', icon: UserCog },
  { key: 'permissions', href: '/admin/permissions', icon: ShieldCheck },
  { key: 'errors', href: '/admin/errors', icon: Bug },
] as const;

/** Versao publicada do site e da API (so' S.Adm): ajuda a saber se o deploy mais recente ja' esta no ar. */
function VersionInfo() {
  const [apiVersion, setApiVersion] = useState('…');
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((h: { version?: string }) => setApiVersion(h.version ?? 'old'))
      .catch(() => setApiVersion('offline'));
  }, []);
  const web = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7);
  return (
    <p className="px-3 pb-2 text-[11px] leading-tight text-muted-foreground/70" title="Versao publicada (commit do GitHub)">
      Web {web} · API {apiVersion}
    </p>
  );
}

/** Conteudo do menu (logo, links filtrados pelo cargo, versao e voltar ao site): usado na barra fixa (telas grandes) e na gaveta (celular/tablet). */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { dict } = useLanguage();
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-5">
        <NinLogo className="h-8 w-8" />
        <span className="text-sm font-bold tracking-tight">Admin Panel</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems
          // Esconde o que o cargo nao pode usar (mesmo mapa do guarda de paginas)
          .filter(({ href }) => {
            const required = requiredPermissionFor(href);
            return required === null || can(required);
          })
          .map(({ key, href, icon: Icon }) => {
          // "Overview" (/admin) precisa de comparacao EXATA, senao ficaria marcado em toda sub-rota; as demais usam startsWith.
          const isActive =
            href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              onClick={onNavigate}
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

      <div className="shrink-0 border-t border-border p-3">
        {can('staff.view') && <VersionInfo />}
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {dict.admin.sidebar.backToSite}
        </Link>
      </div>
    </>
  );
}

/** Menu lateral fixo do painel - so' em telas grandes (lg+); no celular/tablet o menu abre numa gaveta (ver AdminMobileNav). */
export function AdminSidebar() {
  return (
    // sticky + h-screen: fica fixa na tela inteira mesmo rolando o conteudo ao lado.
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <SidebarContent />
    </aside>
  );
}

/** Botao de menu (hamburguer) + gaveta lateral com o mesmo menu, para celular e tablet (abaixo de lg). Fecha ao escolher uma pagina. */
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Fecha a gaveta quando a rota muda (ex.: botao voltar do navegador).
  useEffect(() => setOpen(false), [pathname]);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col gap-0 bg-card p-0">
        <SheetTitle className="sr-only">Admin Panel</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
