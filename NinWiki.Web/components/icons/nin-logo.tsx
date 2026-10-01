// Logo do site: a arte enviada pelo mantenedor (shuriken com anel),
// recolorida em 4 variantes (uma por tema de cor) via processamento de
// imagem (deslocamento de matiz preservando saturacao/brilho - o
// mesmo desenho, so' muda a familia de cor do anel).
//
// Diferente da primeira tentativa (um SVG redesenhado do zero), aqui
// usamos a IMAGEM ORIGINAL de verdade - por isso sao 4 arquivos PNG
// (um por tema) em vez de um SVG com cores dinamicas. A troca entre
// eles acontece 100% via CSS, lendo o atributo data-color-theme no
// <html> (ver components/providers/color-theme-provider.tsx e as
// regras .nin-logo-img-* em app/globals.css) - nenhum JavaScript
// proprio aqui, e funciona corretamente mesmo antes do React montar.
//
// Arquivos em public/images/logo/nin-logo-{tema}.png.

export function NinLogo({ className }: { className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-block', position: 'relative' }}>
      {/* eslint-disable @next/next/no-img-element -- 4 variantes
          pequenas trocadas por CSS puro; next/image adicionaria complexidade
          (otimizacao/lazy-load) sem beneficio aqui, ja' que os arquivos
          ja' vem pre-otimizados (256x256, ~60KB cada). */}
      <img src="/images/logo/nin-logo-blood.png" alt="NinWiki" className="nin-logo-img nin-logo-img-blood" />
      <img src="/images/logo/nin-logo-canarinho.png" alt="NinWiki" className="nin-logo-img nin-logo-img-canarinho" />
      <img src="/images/logo/nin-logo-ouro.png" alt="NinWiki" className="nin-logo-img nin-logo-img-ouro" />
      <img src="/images/logo/nin-logo-anil.png" alt="NinWiki" className="nin-logo-img nin-logo-img-anil" />
      {/* eslint-enable @next/next/no-img-element */}
    </span>
  );
}
