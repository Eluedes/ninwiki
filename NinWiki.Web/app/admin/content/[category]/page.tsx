// Lista de conteudo de UMA categoria (Monstros, Itens, Armas, Missoes, Guias), uma entrada no menu do painel cada.
// A categoria vem do endereco (/admin/content/mobs...); endereco que nao e' categoria responde 404.
import { notFound } from 'next/navigation';
import { ContentList } from '@/components/admin/content-list';
import type { Category } from '@/lib/types';

const CATEGORIES: Category[] = ['mobs', 'items', 'weapons', 'missions', 'guides'];

/** Pagina de uma categoria do conteudo; `key` faz a lista recarregar quando troca de categoria. */
export default async function ContentCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!CATEGORIES.includes(category as Category)) notFound();
  return <ContentList key={category} category={category as Category} />;
}
