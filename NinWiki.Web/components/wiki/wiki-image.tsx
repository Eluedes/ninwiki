'use client';

/**
 * Summary: renderiza a imagem de uma entrada do wiki e mantém o ícone
 * textual como fallback quando a entrada ainda não possui imagem ou quando
 * o arquivo não pôde ser carregado.
 *
 * O componente concentra essa decisão em um único lugar. Dessa forma,
 * CatalogCard, DetailPage e DetailSidebar não precisam repetir a mesma
 * lógica e os novos itens vindos da API podem começar sem imagem.
 */

import Image from 'next/image';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WikiImageProps {
  /** Caminho local ou URL devolvida pelo back-end. */
  src?: string | null;
  /** Texto alternativo para acessibilidade e SEO. */
  alt: string;
  /** Ícone temporário exibido quando não há imagem. */
  fallback: ReactNode;
  /** Classes do contêiner que definem tamanho, fundo e borda. */
  className?: string;
  /** Classes opcionais aplicadas somente à imagem. */
  imageClassName?: string;
}

/** Imagem com icone de reserva quando nao ha' imagem ou ela falha ao carregar. */
export function WikiImage({
  src,
  alt,
  fallback,
  className,
  imageClassName,
}: WikiImageProps) {
  const [hasError, setHasError] = useState(false);
  const showImage = Boolean(src) && !hasError;

  // A imagem já contém seu próprio fundo/borda. Não adicionamos padding
  // padrão para ela ocupar praticamente todo o quadrado.
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden', className)}>
      {showImage ? (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes="(max-width: 640px) 20vw, 180px"
          // image-rendering: pixelated - sem isso, o navegador suaviza
          // (blur) qualquer imagem que precise ser AUMENTADA de tamanho,
          // o que destroi a nitidez de pixel art (a maioria dos assets
          // do jogo sao sprites pequenos - 128x128, por exemplo -
          // exibidos num quadrado maior). object-contain sozinho nao
          // resolve isso, e' uma propriedade CSS separada.
          className={cn('object-contain [image-rendering:pixelated]', imageClassName)}
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="text-2xl leading-none" aria-hidden="true">
          {fallback}
        </span>
      )}
    </div>
  );
}