'use client';

// Provider de idioma (PT/EN). Usa React Context para disponibilizar o
// idioma atual e o dicionario de traducoes (lib/i18n.ts) para qualquer
// componente da arvore, sem precisar passar por props manualmente.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Locale } from '@/lib/types';
import { getDict, type Dictionary } from '@/lib/i18n';

// Formato do valor exposto pelo Context: idioma atual, dicionario ja'
// resolvido para esse idioma, e funcao para trocar de idioma.
interface LanguageContextValue {
  locale: Locale;
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
}

// undefined como valor inicial de proposito: assim conseguimos detectar
// (no useLanguage abaixo) se algum componente tentou usar o hook fora
// do <LanguageProvider>, o que seria um erro de uso.
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// Deve envolver toda a aplicacao (ver app/layout.tsx) para que
// useLanguage() funcione em qualquer pagina/componente filho.
export function LanguageProvider({ children }: { children: ReactNode }) {
  // Nota: comeca sempre em 'en', independente do idioma do navegador
  // ou de uma preferencia salva - toda visita reinicia em ingles.
  // Se quiser lembrar a escolha do usuario, isso precisaria persistir
  // em localStorage/cookie (nao implementado ainda).
  const [locale, setLocaleState] = useState<Locale>('en');

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    // Atualiza o atributo lang="" do <html>, importante para
    // acessibilidade (leitores de tela) e SEO.
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, dict: getDict(locale), setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook usado por qualquer componente que precise ler o idioma atual
// ou o dicionario de traducoes. Uso tipico: const { dict } = useLanguage();
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  // Se cair aqui, e' porque algum componente chamou useLanguage() fora
  // da arvore do LanguageProvider - erro de programacao, nao de runtime
  // esperado, por isso lanca excecao em vez de devolver um valor padrao.
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
