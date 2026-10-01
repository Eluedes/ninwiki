// components/ui/skeleton.tsx
// Bloco cinza pulsante usado como placeholder de carregamento ("esqueleto" do
// conteudo que ainda vai aparecer). Nao esta' em uso ainda porque hoje nao ha
// nenhum carregamento assincrono de verdade (tudo e' sincrono, vindo de
// lib/data.ts).

import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
