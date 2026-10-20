'use client';

// Tela de login do painel (Fase 2).
//
// Fluxo real: o botao leva pra' API (GET /auth/discord/login), que manda pro
// Discord, e o Discord volta pra' API (/auth/discord/callback). Se a conta
// estiver cadastrada na equipe, a API cria a sessao (cookie httpOnly) e
// redireciona pra' /admin; se nao, volta pra' ca' com ?error=<motivo>.
//
// Em ambiente LOCAL, se a API estiver com DEV_LOGIN_ENABLED=true, aparece
// tambem um "login de desenvolvimento" (so' o Discord ID, sem Discord de
// verdade). A API nunca liga isso fora de development.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSelector } from '@/components/language-selector';
import { DiscordIcon } from '@/components/icons/brand-icons';
import { NinLogo } from '@/components/icons/nin-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, DISCORD_LOGIN_URL, devLogin, getAuthConfig, getMe, type AuthConfig } from '@/lib/api-client';

// useSearchParams exige uma fronteira <Suspense> (o Next prerenderiza a pagina); por isso o corpo fica
// em LoginContent e o export padrao so' embrulha.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

/** Conteudo da tela de login (Entrar com Discord / login de desenvolvimento). */
function LoginContent() {
  const { dict } = useLanguage();
  const t = dict.admin.auth;
  const router = useRouter();

  const [config, setConfig] = useState<AuthConfig | null>(null);
  // Motivo da falha do login (a API manda ?error=... de volta pra ca')
  const errorCode = useSearchParams().get('error');
  const [devId, setDevId] = useState('');
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  useEffect(() => {
    // Ja' esta' logado? Vai direto pro painel.
    getMe().then(() => router.replace('/admin')).catch(() => {});
    getAuthConfig().then(setConfig).catch(() => setConfig({ discordEnabled: false, devLoginEnabled: false }));
  }, [router]);

  const errorMessages: Record<string, string> = {
    not_staff: t.errNotStaff,
    inactive: t.errInactive,
    mfa_required: t.errMfa,
    discord_failed: t.errDiscordFailed,
    discord_denied: t.errDiscordDenied,
    invalid_state: t.errInvalidState,
    discord_not_configured: t.errNotConfigured,
    rate_limited: t.errRateLimited,
  };

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setDevBusy(true);
    setDevError(null);
    try {
      await devLogin(devId.trim());
      router.replace('/admin');
    } catch (err) {
      setDevError(
        err instanceof ApiError && err.status === 403 ? t.devError : err instanceof ApiError && err.status === 429 ? t.errRateLimited : t.errGeneric
      );
      setDevBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageSelector />
        <ThemeToggle />
      </div>

      {/* efeito decorativo de brilho no topo, so' visual */}
      <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center">
            <NinLogo className="h-14 w-14" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{dict.admin.login.welcome}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{dict.admin.login.subtitle}</p>
          </div>
        </div>

        {errorCode && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMessages[errorCode] ?? t.errGeneric}
          </div>
        )}

        {/* window.location (e nao <Link>): o fluxo sai do site pro Discord e volta
            por redirecionamentos de servidor - precisa de uma navegacao completa. */}
        <button
          onClick={() => {
            window.location.href = DISCORD_LOGIN_URL;
          }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all duration-200 hover:bg-[#4752C4] hover:shadow-xl hover:shadow-[#5865F2]/30 active:scale-[0.98]"
        >
          <DiscordIcon className="h-6 w-6" />
          {dict.admin.login.button}
        </button>

        {config?.devLoginEnabled && (
          <form onSubmit={handleDevLogin} className="space-y-3 rounded-xl border border-dashed border-border p-4 text-left">
            <div>
              <p className="text-sm font-semibold">{t.devTitle}</p>
              <p className="text-xs text-muted-foreground">{t.devHint}</p>
            </div>
            <Input
              value={devId}
              onChange={(e) => setDevId(e.target.value.replace(/\D/g, ''))}
              placeholder={t.devPlaceholder}
              inputMode="numeric"
            />
            {devError && <p className="text-xs text-destructive">{devError}</p>}
            <Button type="submit" variant="outline" className="w-full" disabled={devBusy || devId.length < 15}>
              {devBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.devButton}
            </Button>
          </form>
        )}

        <p className="text-xs text-muted-foreground">{dict.footer.disclaimer}</p>
      </div>
    </div>
  );
}
