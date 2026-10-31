// Layout raiz do Next.js App Router - envolve TODA pagina do site
// (publico e admin). E' aqui que ficam as coisas que precisam existir
// em toda pagina: fonte, providers de tema/idioma, metadata de SEO.

import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter, Cinzel, Playfair_Display, Lora, Oswald, Bebas_Neue, Caveat, Fira_Code } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { LanguageProvider } from '@/components/providers/language-provider';
import { ColorThemeProvider } from '@/components/providers/color-theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ErrorReporter } from '@/components/error-reporter';

// next/font/google baixa e otimiza a fonte Inter no momento do build,
// evitando uma requisicao externa ao Google Fonts no navegador do usuario.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Fontes extras oferecidas no editor de texto (cada uma vira uma variavel CSS usada pelo texto publico).
const cinzel = Cinzel({ subsets: ['latin'], variable: '--font-cinzel', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' });
const oswald = Oswald({ subsets: ['latin'], variable: '--font-oswald', display: 'swap' });
const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat', display: 'swap' });
const fira = Fira_Code({ subsets: ['latin'], variable: '--font-fira', display: 'swap' });
const fontVars = [inter, cinzel, playfair, lora, oswald, bebas, caveat, fira].map((f) => f.variable).join(' ');

// Metadata usada pelo Next.js para gerar as tags <title> e <meta description>
// automaticamente - importante para SEO e para o preview ao compartilhar o link.
export const metadata: Metadata = {
  // base dos enderecos absolutos (og:image, canonical...): NEXT_PUBLIC_SITE_URL, ex: https://wiki.seudominio.com
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  // title.template: cada pagina define so' o seu nome (ex: "Fire Trap") e a aba mostra "Fire Trap · Nin Codex"
  title: { default: 'Nin Codex', template: '%s · Nin Codex' },
  description: 'The definitive encyclopedia of the Nin Online MMORPG — mobs, items, weapons, masteries, guides and missions.',
  // Cartao de compartilhamento padrao (Discord, WhatsApp, X): o livro + "NIN CODEX" (gerado por NinWiki.Api/scripts/gerar_logo.py).
  // Favicon e icones vem sozinhos de app/favicon.ico, app/icon.png e app/apple-icon.png (convencao do Next.js).
  openGraph: { type: 'website', siteName: 'Nin Codex', title: 'Nin Codex', images: [{ url: '/images/logo/og-nin-codex.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'Nin Codex', images: ['/images/logo/og-nin-codex.png'] },
};

/** Layout raiz de todas as paginas: fonte, tema, idioma e avisos. Async: le' o nonce da CSP (proxy.ts), o que tambem faz toda pagina ser gerada a cada pedido (o nonce e' novo a cada um). */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // suppressHydrationWarning: necessario porque o ThemeProvider
    // (next-themes) adiciona a classe "dark"/"light" no <html> DIRETO
    // no navegador, depois que o React ja' montou. Sem essa prop, o
    // React reclamaria (em desenvolvimento) que o HTML do servidor
    // nao bate com o do cliente - um aviso falso-positivo nesse caso
    // especifico, entao e' seguro suprimir so' aqui.
    <html lang="en" suppressHydrationWarning className={fontVars} data-color-theme="laranja">
      <body className={inter.className}>
        {/* Ordem dos providers importa: ThemeProvider por fora,
            LanguageProvider e ColorThemeProvider por dentro - nenhum
            dos tres depende do outro hoje, mas manter uma ordem
            consistente evita confusao se um dia um precisar ler o
            valor do outro. */}
        <ThemeProvider nonce={nonce}>
          <ColorThemeProvider>
            <LanguageProvider>
              {children}
              {/* Reporta erros de JavaScript nao tratados para a equipe (nao desenha nada) */}
              <ErrorReporter />
              {/* Toaster (sonner): renderiza as notificacoes toast; montado uma unica vez aqui na raiz. */}
              <Toaster />
            </LanguageProvider>
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
