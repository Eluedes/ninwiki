'use client';

// Tela de erro de QUALQUER pagina do site (Next.js "error boundary"): quando algo quebra ao montar a pagina - inclusive
// quando a API esta' fora do ar e um Server Component falha - o visitante ve' esta mensagem amigavel (no idioma dele)
// em vez de uma tela branca, e o erro e' reportado para a equipe (painel /admin/errors + Discord).

import { useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';
import { reportClientError } from '@/lib/report-error';

/** Mensagem de erro de pagina, com "tentar de novo" e "voltar ao inicio". */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { dict } = useLanguage();
  useEffect(() => {
    reportClientError(`${error.name}: ${error.message}`, 'render', error.digest);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{dict.siteError.title}</h1>
      <p className="mt-3 text-muted-foreground">{dict.siteError.text}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          {dict.siteError.retry}
        </button>
        <Link href="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">
          {dict.siteError.home}
        </Link>
      </div>
    </div>
  );
}
