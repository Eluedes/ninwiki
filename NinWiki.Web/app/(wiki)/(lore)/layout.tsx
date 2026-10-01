// Layout compartilhado das paginas "dossie shinobi": Masteries, Jutsus,
// Vilas e Mapa. Fica ANINHADO dentro do layout de (wiki) - ou seja,
// o Header/Footer do site continuam aparecendo (definidos em
// app/(wiki)/layout.tsx), e este layout so' adiciona o fundo escuro +
// a fonte Cinzel para o CONTEUDO dessas paginas especificas.
//
// O grupo de rotas "(lore)" (nome entre parenteses) nao aparece na URL -
// e' so' para agrupar estas 4 secoes sob um layout comum, sem afetar
// as rotas finais (/masteries, /jutsus/[id], /village, /map).

import { Cinzel, Cinzel_Decorative } from 'next/font/google';

// next/font/google baixa a fonte no build e expõe como variavel CSS,
// em vez do site inteiro depender de uma requisicao ao Google Fonts
// no navegador do usuario (mesma ideia do Inter em app/layout.tsx).
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  variable: '--font-cinzel',
});

const cinzelDecorative = Cinzel_Decorative({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-cinzel-decorative',
});

/** Layout das paginas de lore (masteries, vilas, mapa). */
export default function LoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // .shinobi-theme (definida em app/globals.css) aplica o fundo
    // escuro com gradientes - as variaveis de fonte sao expostas aqui
    // e consumidas pelo tailwind.config.ts (fontFamily.display/stamp).
    <div className={`shinobi-theme ${cinzel.variable} ${cinzelDecorative.variable}`}>
      {children}
    </div>
  );
}
