// Pagina de catalogo (rota /catalog/[category]): busca as entries
// PUBLICADAS da categoria na API real. Server Component assincrono -
// a parte interativa (busca por texto, secoes recolhidas) fica em
// components/wiki/catalog-page-client.tsx.

import { listContentItems, listAttributes, listProfessions, listNinjaRanks, listStoryArcs, listSummons } from '@/lib/api-client';
import { CatalogPageClient } from '@/components/wiki/catalog-page-client';
import type { Category } from '@/lib/types';

// Lista de categorias aceitas nesta rota - usada para validar o
// parametro de URL antes de usa-la. "masteries" NAO entra aqui -
// masteries tem sua propria rota (/masteries), nunca viveu dentro de
// content_items (nem no banco real, nem no mock antigo era usado de
// verdade por aqui - nenhum link do site aponta pra /catalog/masteries).
const validCategories: Category[] = [
  'mobs',
  'items',
  'guides',
  'weapons',
  'missions',
];

/** Catalogo publico de uma categoria (Server Component: busca na API). */
export default async function CatalogPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: rawCategory } = await params;

  // Validacao defensiva: se alguem acessar uma URL com categoria
  // invalida (ex: /catalog/xyz), cai silenciosamente em 'mobs' em vez
  // de quebrar a pagina. Poderia ser melhorado no futuro para mostrar
  // uma pagina 404 de verdade nesse caso.
  const category = validCategories.includes(rawCategory as Category) ? (rawCategory as Category) : 'mobs';

  // status: 'published' - o catalogo publico NUNCA mostra rascunho
  // (isso incluiria os milhares de stubs da importacao em massa que
  // ainda nao foram revisados um por um).
  const items = await listContentItems(category, 'published');

  // Os "extras" de Guia (Atributos/Profissoes/Ranks/Arcos/Summons) so'
  // sao buscados quando a categoria for realmente 'guides' - nas
  // outras 4 categorias, essas 5 requisicoes nem acontecem.
  const [guideAttributes, professions, ninjaRanks, storyArcs, summons] =
    category === 'guides'
      ? await Promise.all([listAttributes(), listProfessions(), listNinjaRanks(), listStoryArcs(), listSummons()])
      : [[], [], [], [], []];

  return (
    <CatalogPageClient
      items={items}
      category={category}
      guideAttributes={guideAttributes}
      professions={professions}
      ninjaRanks={ninjaRanks}
      storyArcs={storyArcs}
      summons={summons}
    />
  );
}

// Busca da API a cada acesso: sem isso o Next pre-renderiza a pagina no build
// (quebra se a API estiver fora do ar) e o conteudo nunca mais atualiza.
export const dynamic = 'force-dynamic';
