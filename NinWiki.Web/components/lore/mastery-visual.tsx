'use client';

// Visual de uma mastery (icone/imagem com a cor dela) reutilizado nas paginas e cards de lore.

import Image from 'next/image';
import { useState } from 'react';
import { MasteryIcon } from '@/components/lore/mastery-icon';

/**
 * Renderiza a imagem local da mastery quando disponível e mantém o
 * ícone antigo como fallback para registros que ainda não têm imagem.
 */
export function MasteryVisual({
  image,
  icon,
  alt,
  className,
}: {
  image?: string | null;
  icon: string;
  alt: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!image || imageFailed) {
    return <MasteryIcon icon={icon} className={className} />;
  }

  return (
    <Image
      src={image}
      alt={alt}
      width={180}
      height={116}
      className={`object-contain ${className ?? ''}`}
      onError={() => setImageFailed(true)}
    />
  );
}