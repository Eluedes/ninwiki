'use client';

// Provider do TEMA DE CORES do site (diferente do provider claro/escuro
// em theme-provider.tsx, que so' controla luminosidade). Isso controla
// a PALETA de destaque (cor dos botoes, links, foco, e o anel do logo)
// - quatro temas, nomeados com a mesma brasilidade: "blood" (o vermelho
// original), "canarinho" (verde), "ouro" (amarelo) e "anil" (azul).
//
// Funciona aplicando o atributo data-color-theme="..." no <html>. As
// variaveis CSS (--primary, --ring) sao redefinidas em app/globals.css
// dentro de seletores [data-color-theme="..."] para cada tema - "blood"
// nao precisa de seletor proprio, ele E' o valor padrao ja existente
// em :root/.dark.
//
// A escolha fica guardada no localStorage e e' lida com useSyncExternalStore:
// no servidor (e na hidratacao) o valor e' sempre 'blood'; assim que o navegador
// assume, o React troca pro valor salvo SEM erro de hydration (o jeito que o React
// recomenda pra ler uma fonte externa como o localStorage).

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

export type ColorTheme = 'blood' | 'canarinho' | 'ouro' | 'anil';

const VALID_THEMES: ColorTheme[] = ['blood', 'canarinho', 'ouro', 'anil'];

const STORAGE_KEY = 'ninwiki-color-theme';

interface ColorThemeContextValue {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ColorThemeContext = createContext<ColorThemeContextValue | undefined>(undefined);

const listeners = new Set<() => void>();

/** Assina mudancas do tema de cor (usado pelo useSyncExternalStore). */
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener('storage', callback); // mudou em outra aba
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

/** Tema de cor atual no navegador. */
function getSnapshot(): ColorTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return VALID_THEMES.includes(saved as ColorTheme) ? (saved as ColorTheme) : 'blood';
  } catch {
    return 'blood'; // localStorage indisponivel (ex: navegacao privada restrita)
  }
}

/** Tema de cor padrao usado na renderizacao do servidor. */
function getServerSnapshot(): ColorTheme {
  return 'blood';
}

/** Troca o tema de cor, grava a escolha e avisa quem esta' assinando. */
function setColorTheme(theme: ColorTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // sem localStorage: o tema vale so' ate' recarregar
  }
  listeners.forEach((l) => l());
}

/** Provider do tema de cor (Blood, Canarinho, Ouro, Anil) para o site todo. */
export function ColorThemeProvider({ children }: { children: ReactNode }) {
  const colorTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Toda vez que o tema muda, aplica o atributo no <html>.
  useEffect(() => {
    document.documentElement.setAttribute('data-color-theme', colorTheme);
  }, [colorTheme]);

  return <ColorThemeContext.Provider value={{ colorTheme, setColorTheme }}>{children}</ColorThemeContext.Provider>;
}

/** Hook: tema de cor atual e a funcao para troca-lo. */
export function useColorTheme() {
  const ctx = useContext(ColorThemeContext);
  if (!ctx) throw new Error('useColorTheme must be used within ColorThemeProvider');
  return ctx;
}
