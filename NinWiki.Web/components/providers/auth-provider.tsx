'use client';

// Sessao do painel no lado do navegador: pergunta pra API "quem sou eu?"
// (GET /auth/me, usando o cookie httpOnly) e disponibiliza o usuario e suas
// permissoes pra qualquer componente via useAuth().
//
// O cookie em si o JavaScript nunca le' (e' httpOnly) - por isso a pergunta
// pra API. Se a API responder 401 em QUALQUER chamada (sessao expirou, a
// pessoa foi desativada ou mudou de cargo), o evento UNAUTHORIZED_EVENT
// derruba a sessao aqui e o guarda do layout manda pro login.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ApiError,
  UNAUTHORIZED_EVENT,
  getMe,
  logout as apiLogout,
  clearMaintenancePass,
  type ApiMe,
  type PermissionName,
} from '@/lib/api-client';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  me: ApiMe | null;
  // A pessoa logada tem esta permissao? (so' pra esconder/mostrar coisas na tela -
  // a API confere de novo em toda chamada)
  can: (permission: PermissionName) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Provider da sessao: pergunta a' API quem esta' logado e expoe can(permissao), logout e refresh. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<ApiMe | null>(null);

  const refresh = useCallback(async () => {
    try {
      const user = await getMe();
      setMe(user);
      setStatus('authenticated');
    } catch (err) {
      setMe(null);
      // 401 = nao logado (normal). Qualquer outro erro = API fora do ar: NAO
      // manda pro login (a pessoa continuaria logada, so' nao da' pra checar).
      setStatus(err instanceof ApiError && err.status === 401 ? 'anonymous' : 'error');
    }
  }, []);

  // Pergunta "quem sou eu?" ao montar. Escrito com .then (e nao chamando refresh()) porque setState
  // dentro de callback de promessa e' o jeito certo; refresh() continua servindo pra "tentar de novo".
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((user) => {
        if (cancelled) return;
        setMe(user);
        setStatus('authenticated');
      })
      .catch((err) => {
        if (cancelled) return;
        setMe(null);
        setStatus(err instanceof ApiError && err.status === 401 ? 'anonymous' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setMe(null);
      setStatus('anonymous');
      void clearMaintenancePass();   // sessao expirou/foi derrubada: o passe de manutencao tambem sai
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setMe(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      can: (permission) => me?.permissions.includes(permission) ?? false,
      refresh,
      logout,
    }),
    [status, me, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook: usuario logado, permissoes (can) e acoes de sessao. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
