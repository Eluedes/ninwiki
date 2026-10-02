// A pagina do mapa esta em MANUTENCAO (ver lib/maintenance.ts): mesmo que alguem chegue aqui sem passar pelo proxy.ts,
// este layout (Server Component) manda para /maintenance antes de mostrar qualquer coisa do mapa.
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

/** Redireciona toda visita ao mapa para a pagina de manutencao. */
export default function MapLayout({ children }: { children: ReactNode }) {
  void children;
  redirect('/maintenance');
}
