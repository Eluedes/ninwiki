'use client';

// Escuta erros de JavaScript que NAO foram tratados em lugar nenhum (window "error" e "unhandledrejection") e os
// reporta para a API (ver lib/report-error.ts). Fica no layout raiz e nao desenha nada na tela.
//
// Ignora ruido que nao e' bug nosso: "Script error." (script de outra origem, sem detalhe), "ResizeObserver loop"
// (aviso inofensivo do navegador) e erros vindos de extensoes do navegador.

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-error';

const NOISE = /ResizeObserver loop|^Script error\.?$|Non-Error promise rejection/i;

/** Componente invisivel que reporta erros de JavaScript nao tratados. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (NOISE.test(event.message) || /^(chrome|moz|safari)-extension:/.test(event.filename || '')) return;
      reportClientError(`${event.message}${event.lineno ? ` (${event.filename?.split('/').pop()}:${event.lineno})` : ''}`, 'runtime');
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
      if (NOISE.test(message)) return;
      reportClientError(`Unhandled promise rejection: ${message}`, 'runtime');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
