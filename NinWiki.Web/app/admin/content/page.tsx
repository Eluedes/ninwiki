// Lista de TODO o conteudo (sem filtro de categoria). O dia a dia usa as paginas por categoria do menu (/admin/content/<categoria>),
// que mostram a mesma lista ja' filtrada: o componente e' o mesmo (components/admin/content-list.tsx).
import { ContentList } from '@/components/admin/content-list';

/** Pagina "todo o conteudo" do painel. */
export default function ContentAllPage() {
  return <ContentList />;
}
