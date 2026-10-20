'use client';

// Conteudo da pagina de manutencao (textos no idioma escolhido: ingles por padrao, portugues se o visitante escolheu).
//
// Dois usos:
//  - Pagina isolada em construcao (lib/maintenance.ts, ex.: /map): manutencao do SITE desligada -> aviso simples com "voltar ao inicio".
//  - Manutencao do SITE inteiro (ligada pelo S.Adm em /admin/maintenance): o proxy mostra esta pagina no lugar de qualquer pagina. Aqui a EQUIPE sai
//    dela: se ja' esta' logada, a pagina troca a sessao por um passe (API /site/pass), grava o cookie do passe (/maintenance-pass) e recarrega -
//    o site abre normalmente. Se nao esta' logada, o botao leva ao login (/login); depois do login a equipe volta ao site e passa por aqui de novo.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Hammer, Loader2, LogIn } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import { ApiError, createMaintenancePass, getSiteStatus, type ApiSiteStatus } from '@/lib/api-client';
import { localizedText } from '@/lib/localized';

const RELOAD_KEY = 'ninwiki-maint-reload';   // evita recarregar em loop se o passe nao for aceito

/** Aviso de manutencao, com a saida da equipe quando o site inteiro esta' em manutencao. */
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
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center animate-fade-in">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Hammer className="h-10 w-10" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{siteDown ? t.siteTitle : t.title}</h1>
      <p className="mt-3 text-muted-foreground">{siteDown ? (custom || t.siteText) : t.text}</p>
      {siteDown ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          {checking ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.staffChecking}</p>
          ) : (
            <>
              <Button asChild>
                <Link href="/login"><LogIn className="mr-1.5 h-4 w-4" />{t.staffLogin}</Link>
              </Button>
              <p className="max-w-sm text-xs text-muted-foreground">{t.staffHint}</p>
            </>
          )}
        </div>
      ) : (
        <Button asChild className="mt-8">
          <Link href="/">{t.back}</Link>
        </Button>
      )}
    </div>
  );
}
