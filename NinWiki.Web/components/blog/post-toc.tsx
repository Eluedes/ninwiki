// Indice automatico do post ("Neste post"): lista os titulos H2/H3 com link para a ancora de cada um.
// Sem JavaScript proprio: os links sao ancoras comuns (#id) e a pagina rola sozinha. Nao mostra nada com menos de 2 titulos.
'use client';

import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import type { TocItem } from '@/lib/blog-utils';

/** Indice (TOC) do post; some se houver menos de 2 titulos. */
export function PostToc({ items }: { items: TocItem[] }) {
  const { dict } = useLanguage();
  if (items.length < 2) return null;
  return (
    <nav aria-label={dict.blogx.public.contents} className="mt-6 rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-bold text-card-foreground">{dict.blogx.public.contents}</p>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.id} className={cn(item.level === 3 && 'ml-4')}>
            <a href={`#${item.id}`} className="text-muted-foreground transition-colors hover:text-primary">
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
