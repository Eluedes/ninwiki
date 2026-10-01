'use client';

// Cabecalho fixo do painel /admin, mostrando quem esta' logado de verdade
// (vem de GET /auth/me via useAuth) e o cargo, com o botao de sair.

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { LanguageSelector } from '@/components/language-selector';
import { useAuth } from '@/components/providers/auth-provider';
import { RoleBadge } from '@/components/admin/role-badge';

/** Cabecalho do painel: idioma, tema e usuario logado com sair. */
export function AdminHeader() {
  const { dict } = useLanguage();
  const { me, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
      {/* div vazia: reserva o espaco a esquerda - bom lugar futuro para um
          breadcrumb ou titulo da pagina atual. */}
      <div />

      <div className="flex items-center gap-3">
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
              <span className="block text-sm font-semibold leading-tight text-card-foreground">{me.username}</span>
              <span className="block text-xs text-muted-foreground">{me.discordId}</span>
            </div>
            <RoleBadge role={me.role} />
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
