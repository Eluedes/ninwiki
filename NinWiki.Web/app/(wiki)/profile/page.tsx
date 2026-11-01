// Meu perfil (rota /profile): o leitor logado edita nome no jogo, vila e rank.
import type { Metadata } from 'next';
import { MyProfileClient } from '@/components/tournaments/profile-pages';

export const metadata: Metadata = { title: 'My profile' };

/** Pagina /profile. */
export default function ProfilePage() {
  return <MyProfileClient />;
}
