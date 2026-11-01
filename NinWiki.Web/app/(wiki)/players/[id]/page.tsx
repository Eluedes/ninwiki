// Perfil publico de um jogador (rota /players/[id]); o id e' o UUID do leitor, nunca o Discord ID.
import type { Metadata } from 'next';
import { PlayerPageClient } from '@/components/tournaments/profile-pages';

export const metadata: Metadata = { title: 'Player' };

/** Pagina /players/[id]. */
export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerPageClient id={id} />;
}
