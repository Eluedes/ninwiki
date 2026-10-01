'use client';

// Wrapper fino em cima da biblioteca next-themes, que gerencia o
// tema claro/escuro (adiciona/remove a classe "dark" no <html>,
// persiste a escolha, evita "flash" de tema errado no carregamento).

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/** Provider do tema claro/escuro. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"       // alterna tema via classe CSS (class="dark"), nao via atributo data-*
      defaultTheme="dark"      // o wiki comeca sempre no tema escuro
      enableSystem={false}      // ignora a preferencia de tema do sistema operacional
      disableTransitionOnChange // evita uma transicao/flash visual estranho ao trocar de tema
    >
      {children}
    </NextThemesProvider>
  );
}
