'use client';

// Dropdown do header para trocar entre Portugues e Ingles.

import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import type { Locale } from '@/lib/types';

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <DropdownMenu>
      {/* asChild: em vez do DropdownMenuTrigger renderizar seu proprio
          elemento (um <button> por padrao), ele "empresta" o comportamento
          de abrir o menu para o <Button> filho, evitando um botao dentro
          de outro botao no HTML final. */}
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Globe className="h-4 w-4" />
          <span className="uppercase text-xs font-semibold">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setLocale('en' as Locale)}
          className={locale === 'en' ? 'font-bold' : ''}
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLocale('pt' as Locale)}
          className={locale === 'pt' ? 'font-bold' : ''}
        >
          Português
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
