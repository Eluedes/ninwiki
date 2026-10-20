// Define o titulo da aba do navegador para esta secao (a pagina dela e' Client Component e nao pode exportar metadata).
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Maintenance - Admin' };

/** Layout transparente: so' existe para dar o titulo da aba; repassa o conteudo como veio. */
export default function SectionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
