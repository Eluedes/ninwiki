'use client';

// Pagina de manutencao (textos no idioma escolhido: ingles por padrao, portugues se o visitante escolheu). TELA CHEIA e SEM menu: ela fica fora do
// layout do site (app/maintenance), entao nao tem cabecalho, rodape nem link nenhum - a unica saida e' o login da equipe.
//
// Dois usos:
//  - Pagina isolada em construcao (lib/maintenance.ts, ex.: /map): manutencao do SITE desligada -> aviso com "voltar ao inicio".
//  - Manutencao do SITE inteiro (ligada pelo S.Adm em /admin/maintenance): o proxy mostra esta pagina no lugar de qualquer pagina. Aqui a EQUIPE sai
//    dela: se ja' esta' logada, a pagina troca a sessao por um passe (API /site/pass), grava o cookie do passe (/maintenance-pass) e recarrega -
//    o site abre normalmente. Se nao esta' logada, o botao leva ao login (/login); depois do login a equipe volta ao site e passa por aqui de novo.
// As animacoes sao CSS puro (classes maint-* em app/globals.css) e param sozinhas para quem pediu "reduzir movimento" no sistema.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Hammer, Loader2, LogIn } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/language-selector';
import { ThemeToggle } from '@/components/theme-toggle';
import { NinLogo } from '@/components/icons/nin-logo';
import { ApiError, createMaintenancePass, getSiteStatus, type ApiSiteStatus } from '@/lib/api-client';
import { localizedText } from '@/lib/localized';

const RELOAD_KEY = 'ninwiki-maint-reload';   // evita recarregar em loop se o passe nao for aceito

// Brasas que sobem pela tela: posicao (%), tamanho (px), duracao e atraso (s) e deriva lateral (px). Lista FIXA (nada aleatorio) para o HTML do
// servidor ser igual ao do navegador.
const EMBERS = [
  { left: 6, size: 4, dur: 11, delay: 0, drift: 30 }, { left: 14, size: 3, dur: 14, delay: 3, drift: -20 },
  { left: 22, size: 5, dur: 12, delay: 6, drift: 40 }, { left: 31, size: 3, dur: 16, delay: 1, drift: -35 },
  { left: 39, size: 4, dur: 10, delay: 8, drift: 25 }, { left: 47, size: 2, dur: 13, delay: 4, drift: -15 },
  { left: 55, size: 5, dur: 15, delay: 2, drift: 35 }, { left: 63, size: 3, dur: 11, delay: 9, drift: -30 },
  { left: 71, size: 4, dur: 14, delay: 5, drift: 20 }, { left: 79, size: 3, dur: 12, delay: 7, drift: -40 },
  { left: 87, size: 5, dur: 16, delay: 0, drift: 30 }, { left: 94, size: 2, dur: 10, delay: 3, drift: -20 },
];

/** Tela de manutencao animada, com a saida da equipe quando o site inteiro esta' em manutencao. */
export function MaintenancePageClient() {
  const { dict, locale } = useLanguage();
  const t = dict.maintenance;
  const [status, setStatus] = useState<ApiSiteStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSiteStatus();
        if (cancelled) return;
        setStatus(s);
        if (!s.maintenance) return;   // so' uma pagina em construcao: nada a liberar
        // Equipe logada? Troca a sessao por um passe e deixa o site abrir.
        let last = 0;
        try { last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0); } catch { /* sem storage */ }
        if (Date.now() - last < 15_000) return;   // acabou de tentar: nao entra em loop
        const pass = await createMaintenancePass();
        const res = await fetch('/maintenance-pass', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: pass.token }),
        });
        if (res.ok && !cancelled) {
          try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* sem storage */ }
          window.location.reload();
        }
      } catch (err) {
        // 401 = nao e' da equipe (ou nao fez login): fica na pagina com o botao de login. Qualquer outro erro tambem.
        if (!(err instanceof ApiError)) return;
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const siteDown = Boolean(status?.maintenance);
  const custom = status ? localizedText(locale, status.message ?? '', status.messagePt) : '';
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-16">
      {/* Fundo: brilho pulsante, grade em movimento e brasas subindo */}
      <div className="maint-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="maint-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="maint-ember"
            style={{
              left: `${e.left}%`, width: e.size, height: e.size, animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s`,
              ['--maint-drift' as string]: `${e.drift}px`,
            }}
          />
        ))}
      </div>

      {/* Unicos controles da tela: idioma e tema (nada de menu nem links para o site) */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-1">
        <LanguageSelector />
        <ThemeToggle />
      </div>

      <main className="relative z-10 flex max-w-xl flex-col items-center text-center">
        {/* Logo flutuando dentro de aneis giratorios */}
        <div className="maint-rise relative mb-9 h-32 w-32" style={{ animationDelay: '.05s' }}>
          <div className="maint-halo" aria-hidden />
          <div className="maint-ring" aria-hidden />
          <div className="maint-ring-2" aria-hidden />
          {/* Contêiner absoluto que centraliza a logo (o NinLogo define o proprio position, entao nao da' para posiciona-lo direto) */}
          <div className="maint-float absolute inset-3 flex items-center justify-center">
            <NinLogo className="block h-full w-full drop-shadow-[0_0_18px_hsl(var(--primary)/0.55)]" />
          </div>
        </div>

        <span className="maint-rise mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary" style={{ animationDelay: '.2s' }}>
          <span className="maint-dot h-2 w-2 rounded-full bg-primary" />
          {t.badge}
        </span>

        <h1 className="maint-rise bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl" style={{ animationDelay: '.3s' }}>
          {siteDown ? t.siteTitle : t.title}
        </h1>
        <p className="maint-rise mt-4 max-w-md text-base text-muted-foreground" style={{ animationDelay: '.45s' }}>
          {siteDown ? (custom || t.siteText) : t.text}
        </p>

        <div className="maint-rise mt-8 flex items-center gap-3 text-primary" style={{ animationDelay: '.6s' }} aria-hidden>
          <Hammer className="maint-float h-5 w-5" />
          <div className="maint-bar-track"><div className="maint-bar-fill" /></div>
        </div>

        <div className="maint-rise mt-10 flex flex-col items-center gap-3" style={{ animationDelay: '.75s' }}>
          {siteDown ? (
            checking ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.staffChecking}</p>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/login"><LogIn className="mr-2 h-4 w-4" />{t.staffLogin}</Link>
                </Button>
                <p className="max-w-sm text-xs text-muted-foreground">{t.staffHint}</p>
              </>
            )
          ) : (
            <Button asChild size="lg">
              <Link href="/">{t.back}</Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
