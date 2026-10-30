'use client';

// Card grande usado na home para navegar ate' uma area do site.
// O destino e' configurado explicitamente em lib/data.ts e nao e'
// derivado automaticamente do nome da categoria. A imagem tambem vem dos
// dados; se ela faltar, WikiImage usa o icone Lucide como fallback.

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Bug,
  Package,
  BookOpen,
  Sparkles,
  Sword,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryInfo, Locale } from '@/lib/types';
import { WikiImage } from '@/components/wiki/wiki-image';

// Mesma ideia do news-card.tsx: os dados guardam o nome do icone como
// string, e este mapa resolve para o componente de icone de verdade.
const iconMap: Record<string, LucideIcon> = {
  Bug,
  Package,
  BookOpen,
  Sparkles,
  Sword,
  ScrollText,
};

interface WikiButtonProps {
  category: CategoryInfo;
  locale: Locale;
}

/** Botao grande de categoria da pagina inicial. */
export function WikiButton({ category, locale }: WikiButtonProps) {
  const Icon = iconMap[category.icon] ?? Bug;

  return (
    <Link href={category.href} className="group block">
      <div
        className={cn(
          'flex items-center gap-4 rounded-xl border border-border bg-card p-4',
          'shadow-sm transition-all duration-200',
          'hover:border-primary/40 hover:shadow-md hover:scale-[1.02]'
        )}
      >
        <WikiImage
          src={category.image}
          alt={category.title[locale]}
          fallback={
            <Icon className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
          }
          className="h-20 w-20 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold tracking-tight text-card-foreground">
            {category.title[locale]}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
            {category.description[locale]}
          </p>
        </div>
      </div>
    </Link>
  );
}
