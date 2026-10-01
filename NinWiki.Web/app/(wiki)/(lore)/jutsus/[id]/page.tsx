// Pagina de detalhe de um Jutsu (rota /jutsus/[id]) - Server Component
// assincrono, so' busca da API real e repassa pro Client Component
// (JutsuPageClient) que faz a renderizacao de verdade, consciente de
// idioma (mesmo padrao de app/(wiki)/(lore)/masteries/[id]/page.tsx -
// useLanguage e' um hook de React, nao funciona aqui).

import Link from 'next/link';
import { getJutsu, getMastery, ApiError } from '@/lib/api-client';
import { JutsuPageClient } from '@/components/lore/jutsu-page-client';

export default async function JutsuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let jutsu;
  try {
    jutsu = await getJutsu(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return (
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <p className="text-ink-300">Jutsu não encontrado.</p>
          <Link href="/masteries" className="btn-ghost mt-4">Voltar para Masteries</Link>
        </div>
      );
    }
    throw err;
  }

  // mastery e' opcional aqui de proposito (mesmo motivo de antes: se
  // por algum motivo a mastery do jutsu nao carregar, a pagina ainda
  // mostra o jutsu em si, so' sem a cor de destaque/link da mastery).
  const mastery = await getMastery(jutsu.masteryId).catch(() => undefined);
  const path = mastery?.paths.find((p) => p.id === jutsu.pathId);

  return <JutsuPageClient jutsu={jutsu} mastery={mastery} path={path} />;
}
