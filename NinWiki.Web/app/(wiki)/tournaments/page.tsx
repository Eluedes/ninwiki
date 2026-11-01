// Lista publica de torneios (rota /tournaments). A tela e' o Client Component (depende de quem esta' logado).
import type { Metadata } from 'next';
import { TournamentsPageClient } from '@/components/tournaments/tournaments-page-client';

export const metadata: Metadata = { title: 'Tournaments' };

/** Pagina /tournaments. */
export default function TournamentsPage() {
  return <TournamentsPageClient />;
}
