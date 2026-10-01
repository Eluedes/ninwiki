'use client';

// Provider de idioma (EN/PT). Usa React Context para disponibilizar o idioma atual e o dicionario de
// traducoes (lib/i18n.ts) para qualquer componente da arvore, sem passar por props.
//
// PADRAO: INGLES. Quem nunca escolheu (visitante novo, e o servidor ao renderizar) ve' em ingles. Quando a
// pessoa escolhe portugues, a escolha fica guardada no localStorage e vale nas proximas paginas e visitas
// (antes, cada carregamento de pagina voltava para ingles). Como no tema de cor, a leitura usa
// useSyncExternalStore: servidor e hidratacao sempre veem 'en', e o React troca para o valor salvo SEM erro de hydration.

import { createContext, useContext, useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { Locale } from '@/lib/types';
import { getDict, type Dictionary } from '@/lib/i18n';

const STORAGE_KEY = 'ninwiki-locale';

// Formato do valor exposto pelo Context: idioma atual, dicionario ja' resolvido e funcao para trocar de idioma.
interface LanguageContextValue {
  locale: Locale;
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
}

// undefined como valor inicial de proposito: assim detectamos (no useLanguage) uso fora do <LanguageProvider>.
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const listeners = new Set<() => void>();

/** Assina mudancas de idioma (usado pelo useSyncExternalStore). */
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener('storage', callback); // mudou em outra aba
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

/** Idioma salvo no navegador (ou 'en' se nunca escolheu ou o localStorage estiver indisponivel). */
function getSnapshot(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'pt' ? 'pt' : 'en';
  } catch {
    return 'en';
  }
}

/** Idioma usado na renderizacao do servidor: sempre ingles. */
function getServerSnapshot(): Locale {
  return 'en';
}

/** Deve envolver toda a aplicacao (ver app/layout.tsx) para que useLanguage() funcione em qualquer pagina. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Mantem o atributo lang="" do <html> em dia (acessibilidade/leitores de tela e SEO).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  /** Troca o idioma, grava a escolha e avisa quem esta' assinando. */
  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sem localStorage: vale so' ate' recarregar
    }
    listeners.forEach((l) => l());
  }, []);

  return <LanguageContext.Provider value={{ locale, dict: getDict(locale), setLocale }}>{children}</LanguageContext.Provider>;
}

/** Hook: idioma atual, dicionario de traducoes e a funcao para troca-lo. Uso tipico: const { dict } = useLanguage(); */
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  // Se cair aqui, algum componente chamou useLanguage() fora da arvore do LanguageProvider - erro de programacao.
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
