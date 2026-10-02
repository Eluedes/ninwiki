// Layout do grupo de rotas (wiki) - o Next.js App Router usa parenteses
// em torno do nome da pasta "(wiki)" para agrupar rotas sem afetar a
// URL (ou seja, isso NAO cria um segmento "/wiki/" na URL, e' so'
// organizacao de arquivos). Toda pagina publica (home, catalogo,
// detalhe) herda este layout com Header + Footer fixos.
// O painel /admin fica FORA deste grupo, por isso tem seu proprio
// layout (app/admin/layout.tsx) sem o Header/Footer do site publico.

import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { PageHitBeacon } from '@/components/wiki/page-hit-beacon';

/** Layout do site publico: cabecalho, conteudo e rodape. */
export default function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // min-h-screen + flex-col + flex-1 no <main>: garante que o Footer
    // fique sempre no rodape da tela, mesmo em paginas com pouco
    // conteudo (o <main> "empurra" o footer para baixo ocupando todo
    // o espaco sobrando).
    <div className="flex min-h-screen flex-col">
      <PageHitBeacon />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
