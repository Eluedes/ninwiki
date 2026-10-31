'use client';

// Menu lateral fixo do painel /admin, com navegacao entre as secoes
// agrupadas por assunto (Wiki, Comunidade, Mundo, Sistema) e link de volta ao site publico.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, Boxes, Sparkles, Zap, FileJson, History, UserCog, Castle, Building2, ShieldCheck, Bug, MessageSquare, Megaphone, ImageIcon, ArrowLeft, ChevronDown, Flag, Languages, BookOpen, Hammer, Package, Sword, ScrollText, Construction, HeartHandshake, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { requiredPermissionFor } from '@/lib/admin-routes';
import { NinLogo } from '@/components/icons/nin-logo';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { API_URL } from '@/lib/api-client';
import type { Dictionary } from '@/lib/i18n';

// Itens agrupados em secoes (estilo CoreUI): `group: null` fica solto no topo;
// as demais viram um grupo recolhivel com titulo. `as const` ajuda o TypeScript
// a checar que `key` bate com uma chave valida de dict.admin.sidebar.
type NavKey = Exclude<keyof Dictionary['admin']['sidebar'], 'groups' | 'users' | 'backToSite' | 'breadcrumbHome' | 'viewSite'>;
type NavItem = { key: NavKey; href: string; icon: LucideIcon };
const navGroups: { group: 'wiki' | 'community' | 'world' | 'system' | null; items: NavItem[] }[] = [
  { group: null, items: [{ key: 'overview', href: '/admin', icon: LayoutDashboard }] },
  { group: 'wiki', items: [
    { key: 'contentMobs', href: '/admin/content/mobs', icon: Bug },
    { key: 'contentItems', href: '/admin/content/items', icon: Package },
    { key: 'contentWeapons', href: '/admin/content/weapons', icon: Sword },
    { key: 'contentMissions', href: '/admin/content/missions', icon: ScrollText },
    { key: 'masteries', href: '/admin/masteries', icon: Sparkles },
    { key: 'jutsus', href: '/admin/jutsus', icon: Zap },
    { key: 'guideArticles', href: '/admin/guides', icon: BookOpen },
    { key: 'professions', href: '/admin/professions', icon: Hammer },
    { key: 'bulkImport', href: '/admin/import', icon: FileJson },
    { key: 'translations', href: '/admin/translations', icon: Languages },
    { key: 'media', href: '/admin/media', icon: ImageIcon },
  ] },
  { group: 'community', items: [
    { key: 'blogPosts', href: '/admin/blog-posts', icon: FileText },
    { key: 'comments', href: '/admin/comments', icon: MessageSquare },
    { key: 'reports', href: '/admin/reports', icon: Flag },
    { key: 'volunteers', href: '/admin/volunteers', icon: HeartHandshake },
    { key: 'announcement', href: '/admin/announcement', icon: Megaphone },
  ] },
  { group: 'world', items: [
    { key: 'villages', href: '/admin/villages', icon: Castle },
    { key: 'organizations', href: '/admin/organizations', icon: Building2 },
  ] },
  { group: 'system', items: [
    { key: 'staff', href: '/admin/staff', icon: UserCog },
    { key: 'permissions', href: '/admin/permissions', icon: ShieldCheck },
    { key: 'auditLog', href: '/admin/audit-log', icon: History },
    { key: 'errors', href: '/admin/errors', icon: Bug },
    { key: 'maintenance', href: '/admin/maintenance', icon: Construction },
  ] },
];

/** Lista plana (usada pelo breadcrumb do cabecalho para achar o titulo da pagina atual). */
export const adminNavItems = navGroups.flatMap((g) => g.items);

/** Chave do localStorage com os grupos que o usuario recolheu. */
const COLLAPSED_KEY = 'ninwiki-admin-collapsed';

/** Versao publicada do site e da API (so' S.Adm): ajuda a saber se o deploy mais recente ja' esta no ar. */
function VersionInfo() {
  const { dict } = useLanguage();
  const [apiVersion, setApiVersion] = useState('…');
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((h: { version?: string }) => setApiVersion(h.version ?? 'old'))
      .catch(() => setApiVersion('offline'));
  }, []);
  const web = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7);
  return (
    <p className="px-3 pb-2 text-[11px] leading-tight text-muted-foreground/70" title={dict.admin.sidebar.versionTitle}>
      Web {web} · API {apiVersion}
    </p>
  );
}

/** Conteudo do menu (logo, links filtrados pelo cargo, versao e voltar ao site): usado na barra fixa (telas grandes) e na gaveta (celular/tablet). */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { dict } = useLanguage();
  const pathname = usePathname();
  const { can } = useAuth();

  // Grupos recolhidos (lembrados no navegador). Comeca vazio e le o localStorage depois de montar, para o HTML do servidor bater com o do cliente.
  const [collapsed, setCollapsed] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
      if (Array.isArray(saved)) queueMicrotask(() => setCollapsed(saved.filter((x): x is string => typeof x === 'string')));
    } catch { /* sem localStorage: tudo aberto */ }
  }, []);
  /** Recolhe/expande um grupo e grava a escolha. */
  function toggle(group: string) {
    const next = collapsed.includes(group) ? collapsed.filter((g) => g !== group) : [...collapsed, group];
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* ignora */ }
  }

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-5">
        <NinLogo className="h-8 w-8" />
        <span className="text-sm font-bold tracking-tight">{dict.admin.sidebar.panelTitle}</span>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {navGroups.map(({ group, items }) => {
          // Esconde o que o cargo nao pode usar (mesmo mapa do guarda de paginas)
          const visible = items.filter(({ href }) => {
            const required = requiredPermissionFor(href);
            return required === null || can(required);
          });
          if (visible.length === 0) return null;
          const links = visible.map(({ key, href, icon: Icon }) => {
            // "Overview" (/admin) precisa de comparacao EXATA, senao ficaria marcado em toda sub-rota; as demais usam startsWith.
            const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
            return (
              <Link
                key={key}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-card-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {dict.admin.sidebar[key]}
              </Link>
            );
          });
          if (group === null) return <div key="top" className="space-y-1">{links}</div>;
          // Grupo recolhivel; um grupo com a pagina atual dentro nunca fica escondido.
          const hasActive = visible.some(({ href }) => pathname.startsWith(href));
          const isOpen = hasActive || !collapsed.includes(group);
          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => toggle(group)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-card-foreground"
              >
                {dict.admin.sidebar.groups[group]}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !isOpen && '-rotate-90')} />
              </button>
              {isOpen && <div className="space-y-1">{links}</div>}
            </div>
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
  const { dict } = useLanguage();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Fecha a gaveta quando a rota muda (ex.: botao voltar do navegador): ajusta o estado durante a renderizacao, sem efeito.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
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
        <SheetTitle className="sr-only">{dict.admin.sidebar.panelTitle}</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
