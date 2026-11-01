// Criar torneio (rota /tournaments/new): exige login de leitor (a tela mostra o botao do Discord se nao houver).
import type { Metadata } from 'next';
import { TournamentForm } from '@/components/tournaments/tournament-form';

export const metadata: Metadata = { title: 'New tournament' };

/** Pagina /tournaments/new. */
export default function NewTournamentPage() {
  return <TournamentForm />;
}
