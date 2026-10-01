'use client';

// ============================================================================
// SISTEMA DE NOTIFICACOES TOAST (padrao gerado pelo shadcn/ui)
// ============================================================================
// Este arquivo implementa um "mini Redux" fora do React: o estado dos
// toasts (lista de notificacoes ativas) vive numa variavel de modulo
// (`memoryState`, la' embaixo), nao num useState comum. Isso permite
// chamar toast({...}) de QUALQUER lugar do codigo (inclusive fora de
// componentes React, como dentro de uma funcao async de callback),
// sem precisar passar a funcao toast por props.
//
// O padrao e': dispatch(action) muda o memoryState via reducer(), e
// entao avisa todos os componentes inscritos (`listeners`) para
// re-renderizarem com o novo estado. E' o mesmo principio do Redux,
// so' que artesanal, sem biblioteca externa.
// Inspired by react-hot-toast library
import * as React from 'react';

import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

// So' permite 1 toast visivel por vez (o mais novo substitui o anterior
// na fila - ver o .slice(0, TOAST_LIMIT) no reducer).
const TOAST_LIMIT = 1;
// Atraso (em ms) ate' um toast dispensado ser removido da memoria de
// vez. 1_000_000 ms (~16 min) e' propositalmente longo - na pratica,
// o toast some da TELA rapido (via CSS de animacao), esse delay so'
// controla quando ele sai do ARRAY de estado.
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

let count = 0;

/** Gera um id incremental para cada aviso (toast). */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType['ADD_TOAST'];
      toast: ToasterToast;
    }
  | {
      type: ActionType['UPDATE_TOAST'];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType['DISMISS_TOAST'];
      toastId?: ToasterToast['id'];
    }
  | {
      type: ActionType['REMOVE_TOAST'];
      toastId?: ToasterToast['id'];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: 'REMOVE_TOAST',
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

/** Regras de estado dos avisos (toasts): adicionar, atualizar, fechar e remover. */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

// Lista de funcoes "setState" de cada componente que chamou useToast().
// E' o mecanismo de pub/sub: toda vez que o estado muda, TODOS os
// componentes inscritos sao avisados e re-renderizam.
const listeners: Array<(state: State) => void> = [];

// O estado "de verdade" mora aqui, fora do React. Cada useState() dos
// componentes e' so' uma COPIA local que e' sincronizada via listeners.
let memoryState: State = { toasts: [] };

// Aplica uma acao ao estado global e propaga a mudanca para todo
// componente inscrito via listeners.
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, 'id'>;

// Funcao publica usada em qualquer lugar do app: toast({ title: '...' }).
// Gera um id unico, dispara a acao ADD_TOAST, e devolve controles
// (dismiss/update) para quem chamou poder atualizar aquele toast especifico depois.
function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: 'UPDATE_TOAST',
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

// Hook usado pelos componentes (ex: components/ui/toaster.tsx) para
// LER o estado atual dos toasts e ficar re-renderizando quando ele mudar.
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    // Inscreve este componente na lista de listeners ao montar...
    listeners.push(setState);
    return () => {
      // ...e desinscreve ao desmontar, para nao vazar memoria (chamar
      // setState de um componente que ja' saiu de tela).
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

export { useToast, toast };
