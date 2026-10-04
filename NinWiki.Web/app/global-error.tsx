'use client';

// Ultima rede de seguranca: se ate' o layout raiz quebrar, o Next.js mostra esta tela (ela substitui a pagina inteira,
// entao precisa ter <html> e <body> proprios e NAO pode depender dos providers de idioma/tema - por isso o texto e'
// fixo em ingles, o idioma padrao do site). O erro tambem e' reportado para a equipe.

import { useEffect } from 'react';
import { reloadOnStaleChunk, reportClientError } from '@/lib/report-error';

/** Tela de erro total do site (quando nem o layout raiz funciona). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (reloadOnStaleChunk(error)) return; // versao antiga do site apos deploy: recarrega em vez de reportar
    reportClientError(`${error.name}: ${error.message}`, 'render', error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#0b0b10', color: '#e5e5ea', textAlign: 'center', padding: '6rem 1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Something went wrong</h1>
        <p style={{ opacity: 0.7 }}>The team was notified. Please try again in a moment.</p>
        <button onClick={reset} style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', borderRadius: 6, border: 0, cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
