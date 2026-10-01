// components/ui/toaster.tsx
// Componente que renderiza a LISTA de toasts ativos usando o hook useToast
// (hooks/use-toast.ts) e os componentes de toast.tsx. Assim como toast.tsx, nao
// e' o sistema de toast usado ativamente no projeto (que e' o sonner.tsx) - os
// dois sistemas coexistem no codigo, mas so' um esta' realmente montado no
// app/layout.tsx.

'use client';

import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
