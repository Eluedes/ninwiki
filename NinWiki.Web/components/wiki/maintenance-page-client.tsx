'use client';

// Conteudo da pagina de manutencao (textos no idioma escolhido: ingles por padrao, portugues se o visitante escolheu).

import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';

/** Aviso "esta pagina esta em construcao" com botao para voltar ao inicio. */
export function MaintenancePageClient() {
  const { dict } = useLanguage();
  const t = dict.maintenance;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center animate-fade-in">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Hammer className="h-10 w-10" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mt-3 text-muted-foreground">{t.text}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t.back}</Link>
      </Button>
    </div>
  );
}
