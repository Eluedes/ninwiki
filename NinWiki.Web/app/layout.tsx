// Layout raiz do Next.js App Router - envolve TODA pagina do site
// (publico e admin). E' aqui que ficam as coisas que precisam existir
// em toda pagina: fonte, providers de tema/idioma, metadata de SEO.

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { LanguageProvider } from '@/components/providers/language-provider';
import { ColorThemeProvider } from '@/components/providers/color-theme-provider';
import { Toaster } from '@/components/ui/sonner';

// next/font/google baixa e otimiza a fonte Inter no momento do build,
// evitando uma requisicao externa ao Google Fonts no navegador do usuario.
const inter = Inter({ subsets: ['latin'] });

// Metadata usada pelo Next.js para gerar as tags <title> e <meta description>
// automaticamente - importante para SEO e para o preview ao compartilhar o link.
export const metadata: Metadata = {
  title: 'Nin Online Brasil Wiki',
  description: 'The definitive encyclopedia of the Nin Online MMORPG — mobs, items, weapons, masteries, guides and missions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: necessario porque o ThemeProvider
    // (next-themes) adiciona a classe "dark"/"light" no <html> DIRETO
    // no navegador, depois que o React ja' montou. Sem essa prop, o
    // React reclamaria (em desenvolvimento) que o HTML do servidor
    // nao bate com o do cliente - um aviso falso-positivo nesse caso
    // especifico, entao e' seguro suprimir so' aqui.
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Ordem dos providers importa: ThemeProvider por fora,
            LanguageProvider e ColorThemeProvider por dentro - nenhum
            dos tres depende do outro hoje, mas manter uma ordem
            consistente evita confusao se um dia um precisar ler o
            valor do outro. */}
        <ThemeProvider>
          <ColorThemeProvider>
            <LanguageProvider>
              {children}
              {/* Toaster: renderiza as notificacoes toast (ver
                  hooks/use-toast.ts) - precisa estar montado uma unica
                  vez aqui na raiz, nao dentro de cada pagina. */}
              <Toaster />
            </LanguageProvider>
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
