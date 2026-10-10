// Define o titulo da aba do navegador para esta secao (as paginas dela sao Client Components e nao podem exportar metadata).
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Official translations - Admin' };

/** Layout transparente: so' existe para dar o titulo da aba; repassa o conteudo como veio. */
export default function SectionLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
