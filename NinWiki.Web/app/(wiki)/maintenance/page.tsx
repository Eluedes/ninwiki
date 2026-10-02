// Pagina de manutencao/construcao (rota /maintenance): para onde vao as paginas listadas em lib/maintenance.ts.
// Nao e' indexada pelos buscadores (noindex).
import type { Metadata } from 'next';
import { MaintenancePageClient } from '@/components/wiki/maintenance-page-client';

export const metadata: Metadata = { title: 'Under maintenance', robots: { index: false, follow: false } };

/** Pagina "em construcao". */
export default function MaintenancePage() {
  return <MaintenancePageClient />;
}
