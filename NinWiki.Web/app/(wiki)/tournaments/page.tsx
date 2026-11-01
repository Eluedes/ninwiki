// Lista publica de torneios (rota /tournaments). A tela e' o Client Component (depende de quem esta' logado).
import type { Metadata } from 'next';
import { TournamentsPageClient } from '@/components/tournaments/tournaments-page-client';

export const metadata: Metadata = { title: 'Tournaments' };

/** Pagina /tournaments. */
export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const { mine } = await searchParams;   // o link "Meus torneios" do menu do usuario abre /tournaments?mine=1
  return <TournamentsPageClient initialMine={Boolean(mine)} />;
}
