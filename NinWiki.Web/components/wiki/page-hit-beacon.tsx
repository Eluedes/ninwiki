'use client';

// Sinal de "pagina aberta" do site publico: a cada troca de rota manda o caminho (sem query, sem
// cookie, sem identificacao) para a API contar os acessos. Falhas sao ignoradas de proposito -
// contagem nunca pode atrapalhar a navegacao. O painel (/admin) nao usa este componente.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { sendPageHit } from '@/lib/api-client';

/** Componente invisivel que registra cada pagina publica aberta. */
export function PageHitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) sendPageHit(pathname);
  }, [pathname]);
  return null;
}
