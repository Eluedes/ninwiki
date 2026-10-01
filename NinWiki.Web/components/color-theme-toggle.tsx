'use client';

// Botao do header que alterna entre os 4 temas de cor: Blood
// (vermelho), Canarinho (verde), Ouro (amarelo) e Anil (azul) - juntos
// formam as cores da bandeira do Brasil. Mesmo padrao visual do
// LanguageSelector (dropdown com as opcoes e a atual em negrito).

import { useColorTheme, type ColorTheme } from '@/components/providers/color-theme-provider';
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

const themeLabel: Record<ColorTheme, string> = {
  blood: 'Blood',
  canarinho: 'Canarinho',
  ouro: 'Ouro',
  anil: 'Anil',
};

/** Botao que troca o tema de cor do site. */
export function ColorThemeToggle() {
  const { colorTheme, setColorTheme } = useColorTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Trocar tema de cor" title="Tema de cor">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(themeLabel) as ColorTheme[]).map((theme) => (
          <DropdownMenuItem
            key={theme}
            onClick={() => setColorTheme(theme)}
            className={cn('gap-2', colorTheme === theme && 'font-bold')}
          >
            <span className={cn('h-2.5 w-2.5 rounded-full', swatchClass[theme])} />
            {themeLabel[theme]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
