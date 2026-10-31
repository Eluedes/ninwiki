// Formulario publico para virar voluntario do projeto (rota /volunteer). Fica FORA do menu: o link vai no aviso da Home
// (painel > Aviso da Home > link "/volunteer"). Server Component fino: so' o titulo da aba; a tela e' o Client Component.

import { VolunteerForm } from '@/components/volunteer/volunteer-form';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Volunteer' };

/** Pagina /volunteer. */
export default function VolunteerPage() {
  return <VolunteerForm />;
}
