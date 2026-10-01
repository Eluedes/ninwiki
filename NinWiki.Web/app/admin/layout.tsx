'use client';

// Layout do painel administrativo - sidebar + header fixos, envolvendo
// toda pagina dentro de /admin/*, E o GUARDA DE ACESSO (Fase 2):
//   - sem sessao valida  -> manda pro /login
//   - com sessao, mas sem a permissao da pagina (ver lib/admin-routes.ts)
//                        -> mostra "sem acesso"
//
// Isto e' so' a camada de experiencia. A seguranca de verdade fica no
// backend: mesmo alguem que burlasse este guarda pelo navegador
// receberia 401/403 da API em toda chamada (app/core/auth.py).

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { AuthProvider, useAuth } from '@/components/providers/auth-provider';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import { requiredPermissionFor } from '@/lib/admin-routes';

function AdminShell({ children }: { children: React.ReactNode }) {
  const { status, can, refresh } = useAuth();
  const { dict } = useLanguage();
  const t = dict.admin.auth;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status === 'loading' || status === 'anonymous') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t.checkingSession}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="max-w-sm text-sm text-muted-foreground">{t.apiUnreachable}</p>
        <Button variant="outline" onClick={() => refresh()}>
          {t.retry}
        </Button>
      </div>
    );
  }

  const required = requiredPermissionFor(pathname);
  const blocked = required !== null && !can(required);

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader />
        <div className="flex-1 p-6">
          {blocked ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
              <ShieldAlert className="h-10 w-10 text-muted-foreground" />
              <h1 className="text-xl font-bold">{t.noAccessTitle}</h1>
              <p className="text-sm text-muted-foreground">{t.noAccessBody}</p>
              <Link href="/admin" className="text-sm text-primary hover:underline">
                {t.backToOverview}
              </Link>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
