'use client';

// Bloco de demonstracao (GIF) de um jutsu, com fallback gracioso quando
// o arquivo referenciado em campo `gif` do jutsu ainda
// nao existe em public/images/jutsus/. Sem isso, um `gif` apontando
// para um arquivo inexistente mostrava o icone de imagem quebrada do
// navegador na pagina de detalhe do jutsu - extraido para componente
// proprio (mesmo padrao de components/wiki/wiki-image.tsx) porque a
// pagina em si e' Server Component e onError precisa rodar no cliente.

import { useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/components/providers/language-provider';

/** GIF animado de um jutsu (some sozinho se o arquivo falhar). */
export function JutsuGif({ src, alt }: { src: string; alt: string }) {
  const { dict } = useLanguage();
  const [hasError, setHasError] = useState(false);

  // Se o arquivo nao existir (404) ou falhar ao carregar por qualquer
  // motivo, o bloco inteiro deixa de ser renderizado - o jutsu volta a
  // mostrar so' os dados textuais, do jeito que ficaria se `gif` nunca
  // tivesse sido preenchido.
  if (hasError) return null;

  return (
    <div className="dossier-panel p-4">
      <h2 className="mb-3 font-display text-lg font-bold text-ink-100">{dict.lore.demo}</h2>
      <div className="relative aspect-video overflow-hidden rounded-md border border-ink-700 bg-ink-950">
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-contain"
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
}
