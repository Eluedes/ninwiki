// Pagina de um torneio (rota /tournaments/[id]). Carregada no navegador porque a resposta depende de quem esta' logado.
import type { Metadata } from 'next';
import { TournamentPageClient } from '@/components/tournaments/tournament-page-client';

export const metadata: Metadata = { title: 'Tournament' };

/** Pagina /tournaments/[id]. */
export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TournamentPageClient id={id} />;
}
