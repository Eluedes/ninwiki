// Mapa "pagina do painel -> permissao necessaria" - UM lugar so', usado tanto
// pelo guarda de paginas (app/admin/layout.tsx) quanto pelo menu lateral
// (components/admin/admin-sidebar.tsx), entao os dois nunca discordam.
//
// Paginas que NAO estao aqui (Visao Geral, Conteudo, Blog Posts) ficam
// liberadas pra qualquer membro logado da equipe.
//
// IMPORTANTE: isso e' so' experiencia de uso (esconder o que a pessoa nao pode
// usar). A seguranca de verdade esta' no backend - toda rota da API confere a
// permissao de novo (app/core/permissions.py) e nega mesmo se alguem
// forcar a URL ou mexer neste arquivo no navegador.
import type { PermissionName } from '@/lib/api-client';

export const ROUTE_PERMISSIONS: { prefix: string; permission: PermissionName }[] = [
  { prefix: '/admin/staff', permission: 'staff.view' },
  { prefix: '/admin/permissions', permission: 'roles.manage' },
  { prefix: '/admin/errors', permission: 'errors.view' },
  { prefix: '/admin/audit-log', permission: 'audit.view' },
  { prefix: '/admin/blog-posts', permission: 'posts.create' },
  { prefix: '/admin/import', permission: 'content.import' },
  { prefix: '/admin/masteries', permission: 'lore.edit' },
  { prefix: '/admin/jutsus', permission: 'lore.edit' },
  { prefix: '/admin/villages', permission: 'lore.edit' },
  { prefix: '/admin/organizations', permission: 'lore.edit' },
];

/** Permissao exigida por uma pagina do painel (ou null se qualquer membro da equipe pode). */
export function requiredPermissionFor(pathname: string): PermissionName | null {
  const match = ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/')
  );
  return match ? match.permission : null;
}
