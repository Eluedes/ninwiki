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
  { prefix: '/admin/comments', permission: 'comments.moderate' },
  { prefix: '/admin/reports', permission: 'reports.manage' },
  { prefix: '/admin/volunteers', permission: 'volunteers.manage' },
  { prefix: '/admin/tournaments', permission: 'tournaments.manage' },
  { prefix: '/admin/discord-links', permission: 'discord.links' },
  { prefix: '/admin/bot', permission: 'discord.links' },   // servidores do bot (somente leitura): mesma permissao das ligacoes
  { prefix: '/admin/translations', permission: 'translation.import' },
  { prefix: '/admin/media', permission: 'uploads.create' },
  { prefix: '/admin/announcement', permission: 'announcement.manage' },
  { prefix: '/admin/import', permission: 'content.import' },
  { prefix: '/admin/masteries', permission: 'lore.edit' },
  { prefix: '/admin/jutsus', permission: 'lore.edit' },
  { prefix: '/admin/maintenance', permission: 'site.maintenance' },
  { prefix: '/admin/seasonal-theme', permission: 'site.seasonal_theme' },
  { prefix: '/admin/guides', permission: 'lore.edit' },
  { prefix: '/admin/professions', permission: 'lore.edit' },
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
