'use client';

// Botao do header que alterna entre os 4 temas de cor: Blood/Sangue
// (vermelho), Canary/Canarinho (verde), Gold/Ouro (amarelo) e Indigo/Anil (azul) - juntos
// formam as cores da bandeira do Brasil. Os nomes seguem o idioma escolhido. Mesmo padrao visual do
// LanguageSelector (dropdown com as opcoes e a atual em negrito).

import { useColorTheme, type ColorTheme } from '@/components/providers/color-theme-provider';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pontinho colorido exibido ao lado do nome de cada tema no menu -
// da' uma previa visual da cor sem precisar trocar de tema pra ver.
// Cores batem com o --primary de cada tema em app/globals.css.
const swatchClass: Record<ColorTheme, string> = {
  blood: 'bg-[#dc2626]',
  canarinho: 'bg-[#009739]',
  ouro: 'bg-[#e8b800]',
  anil: 'bg-[#0d4aa8]',
};

// Nomes dos temas no idioma escolhido (ingles e' o principal; a versao em portugues usa as cores da bandeira).
const themeLabels = {
  en: { blood: 'Blood', canarinho: 'Canary', ouro: 'Gold', anil: 'Indigo', title: 'Color theme' },
  pt: { blood: 'Sangue', canarinho: 'Canarinho', ouro: 'Ouro', anil: 'Anil', title: 'Tema de cor' },
} as const;

/** Botao que troca o tema de cor do site. */
export function ColorThemeToggle() {
  const { colorTheme, setColorTheme } = useColorTheme();
  const { locale } = useLanguage();
  const labels = themeLabels[locale === 'pt' ? 'pt' : 'en'];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={labels.title} title={labels.title}>
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(swatchClass) as ColorTheme[]).map((theme) => (
          <DropdownMenuItem
            key={theme}
            onClick={() => setColorTheme(theme)}
            className={cn('gap-2', colorTheme === theme && 'font-bold')}
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', swatchClass[theme])} />
            {labels[theme]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
