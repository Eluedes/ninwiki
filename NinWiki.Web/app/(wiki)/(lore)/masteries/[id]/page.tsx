// Pagina de detalhe de uma Mastery (rota /masteries/[id]) - Server
// Component assincrono, so' busca da API real e repassa pro Client
// Component (MasteryPageClient) que faz a renderizacao de verdade,
// consciente de idioma (ver comentario la' pro motivo completo de
// precisar ser Client Component).

import Link from 'next/link';
import { getMastery, listJutsus, listAttributes, ApiError } from '@/lib/api-client';
import { MasteryPageClient } from '@/components/lore/mastery-page-client';

export default async function MasteryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // getMastery devolve 404 (via ApiError) quando o id da URL nao
  // existe no banco - trata isso como "nao encontrada", igual o mock
  // fazia antes quando masteryById() devolvia undefined.
  let mastery;
  try {
    mastery = await getMastery(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return (
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <p className="text-ink-300">Mastery não encontrada.</p>
          <Link href="/masteries" className="btn-ghost mt-4">Voltar para Masteries</Link>
        </div>
      );
    }
    throw err;
  }

  const [masteryJutsus, attributes] = await Promise.all([
    listJutsus(mastery.id),
    listAttributes(),
  ]);

  return <MasteryPageClient mastery={mastery} masteryJutsus={masteryJutsus} attributes={attributes} />;
}
