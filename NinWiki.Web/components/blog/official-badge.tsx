'use client';

// Selo "post oficial da Hitspark" para as miniaturas/capas dos posts importados da Steam (`post.isSteam`).
// E' so' um overlay: nao altera a imagem gravada no banco. Fica no canto do contêiner pai (que precisa ser `relative`).
// A logo (marca laranja + palavra branca) foi montada a partir das camadas da animacao de abertura do jogo
// (graphics/intro/HitsparkMarkBody + HitsparkWordmark, palavra recolorida para branco). Para trocar a logo, troque so' o arquivo abaixo.

import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/language-provider';

export const HITSPARK_LOGO = '/images/blog/hitspark-logo.webp';   // 480x122, fundo transparente (unico ponto para trocar a imagem)

/** `size`: 'sm' para miniaturas pequenas (80px), 'md' para capas de card, 'lg' para o banner do topo do post. */
export function OfficialBadge({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { dict } = useLanguage();
  const label = dict.blog.official;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded-md bg-black/60 shadow-sm ring-1 ring-white/15 backdrop-blur-sm',
        size === 'sm' ? 'w-[72%] p-[3px]' : size === 'md' ? 'w-[32%] p-1.5' : 'w-[28%] max-w-[220px] p-2',
        className
      )}
    >
      {/* Largura/altura fixas (proporcao 480x122): reserva o espaco e nao causa layout shift. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HITSPARK_LOGO} alt="" width={480} height={122} loading="lazy" decoding="async" className="block h-auto w-full" />
    </span>
  );
}
