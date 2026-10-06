// 404 do site publico (dentro do layout da wiki: cabecalho e rodape). Disparado por notFound() nas paginas de detalhe.
import { PageNotFound } from '@/components/lore/page-not-found';

export default function NotFound() {
  return <PageNotFound />;
}
