'use client';

// Tela "pagina nao encontrada" do site publico, no idioma do visitante. Usada por app/(wiki)/not-found.tsx: as paginas de vila, mastery,
// jutsu e entry chamam notFound() quando o item nao existe, assim a resposta e' um 404 DE VERDADE (e nao uma pagina "vazia" com status 200,
// que o Google guardaria como se existisse).

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';

/** Mensagem de 404 + link para o inicio, no idioma atual. */
export function PageNotFound() {
  const { dict } = useLanguage();
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center">
      <p className="text-5xl font-bold text-ink-500">404</p>
      <p className="mt-3 text-ink-300">{dict.lore.pageNotFound}</p>
      <Link href="/" className="btn-ghost mt-5">{dict.lore.backHome}</Link>
    </div>
  );
}
