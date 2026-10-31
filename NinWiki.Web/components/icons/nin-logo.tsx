'use client';

// Logo do Nin Codex: um LIVRO de capa preto couro com filete dourado e o emblema do jogo na capa
// (public/images/logo/nin-codex-livro.svg, gerado por NinWiki.Api/scripts/gerar_logo.py).
// O livro nao muda de cor com o tema de cor do site (o dourado e' fixo), entao e' uma unica imagem.
// O favicon e o avatar do bot usam so' o EMBLEMA do jogo (app/icon.png, app/favicon.ico).

import { useLanguage } from '@/components/providers/language-provider';

/** Logo (so' o livro). Use para espacos pequenos (login, painel, manutencao); o cabecalho e o rodape usam NinLockup. */
export function NinLogo({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-block', position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG pequeno e fixo; next/image nao otimiza SVG e nao traria beneficio */}
      <img src="/images/logo/nin-codex-livro.svg" alt="Nin Codex" className="block h-full w-full object-contain" />
    </span>
  );
}

/**
 * LOCKUP do cabecalho/rodape: livro grande + "NIN CODEX" (Cinzel 800, maiusculas, letras bem espacadas) + linha pequena
 * "WIKI · MAPA · FERRAMENTAS" (so' em telas >= md). `size="sm"` e' a versao do rodape. As cores herdam do texto do tema (claro/escuro).
 */
export function NinLockup({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const { dict } = useLanguage();
  const big = size === 'lg';
  return (
    <span className={`flex items-center ${big ? 'gap-2.5 md:gap-3.5' : 'gap-2.5'}`}>
      <NinLogo className={big ? 'h-9 w-7 md:h-12 md:w-10' : 'h-9 w-7'} />
      <span className="flex flex-col justify-center">
        <span className={`font-display font-extrabold uppercase leading-none ${big ? 'text-[15px] tracking-[0.1em] md:text-[22px] md:tracking-[0.12em]' : 'text-base tracking-[0.12em]'}`}>
          {dict.siteName}
        </span>
        {big && <span className="mt-1.5 hidden text-[10px] font-medium uppercase leading-none tracking-[0.3em] opacity-70 md:block">{dict.siteSubline}</span>}
      </span>
    </span>
  );
}
