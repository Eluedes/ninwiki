'use client';

// Cabecalho fixo do painel /admin, mostrando quem esta' logado de verdade
// (vem de GET /auth/me via useAuth) e o cargo, com o botao de sair.

import { useRouter } from 'next/navigation';
import { LogOut, Pencil } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { LanguageSelector } from '@/components/language-selector';
import { useAuth } from '@/components/providers/auth-provider';
import { RoleBadge } from '@/components/admin/role-badge';
import { AdminMobileNav } from '@/components/admin/admin-sidebar';
import { ApiError, updateStaffName } from '@/lib/api-client';

/** Cabecalho do painel: idioma, tema e usuario logado com sair. */
export function AdminHeader() {
  const { dict } = useLanguage();
  const { me, logout, can, refresh } = useAuth();
  const router = useRouter();

  /** Troca o PROPRIO nome (so' S.Adm): pergunta o nome novo, salva e atualiza o cabecalho. */
  async function handleEditMyName() {
    if (!me) return;
    const name = window.prompt(dict.admin.auth.editName + ':', me.username);
    if (name === null || !name.trim() || name.trim() === me.username) return;
    try {
      await updateStaffName(me.id, name.trim());
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : dict.admin.auth.actionError);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-border bg-card/80 px-3 backdrop-blur-md sm:px-6">
      {/* Celular/tablet: botao que abre o menu (a barra lateral fixa so' existe em telas grandes). */}
      <AdminMobileNav />
      <div className="hidden lg:block" />

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <LanguageSelector />
        {me && (
          <>
            {me.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt="" className="h-9 w-9 rounded-full bg-secondary object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold uppercase">
                {me.username.slice(0, 1)}
              </div>
            )}
            <div className="hidden sm:block">
              <span className="flex items-center gap-1 text-sm font-semibold leading-tight text-card-foreground">
                {me.username}
                {can('staff.edit') && (
                  <button onClick={handleEditMyName} title={dict.admin.auth.editName}
                    className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-card-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">{me.discordId}</span>
            </div>
            <RoleBadge role={me.role} label={me.customRole?.name} color={me.customRole?.color} />
            <button
              onClick={handleLogout}
              title={dict.admin.auth.logout}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
