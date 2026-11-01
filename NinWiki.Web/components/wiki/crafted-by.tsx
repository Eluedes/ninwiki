'use client';

// Bloco "Feito por craft" da ficha de item/arma: mostra a(s) receita(s) das profissoes que PRODUZEM a entry (a API calcula em `craftedBy`,
// somente leitura). A linha da profissao leva a' pagina dela ja' na receita deste item; abaixo, nivel, bancada e os ingredientes (links).

import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiCraftedBy } from '@/lib/api-client';

/** Lista de receitas que fazem a entry (nao renderiza nada se nenhuma). `slug` = slug da entry, usado na ancora da receita. */
export function CraftedBy({ recipes, slug }: { recipes: ApiCraftedBy[]; slug: string }) {
  const { locale, dict } = useLanguage();
  if (recipes.length === 0) return null;
  const pt = locale === 'pt';
  return (
    <ul className="divide-y divide-border">
      {recipes.map((r) => (
        <li key={r.professionId} className="space-y-1.5 px-4 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/proficiencies/${r.professionId}#recipe-${slug}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
              <Hammer className="h-3.5 w-3.5" aria-hidden /> {r.professionIcon} {pt ? (r.professionNamePt ?? r.professionName) : r.professionName}
            </Link>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">{dict.lore.professionLevel} {r.level}</span>
            {r.workbench && <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{dict.lore.professionWorkbench}</span>}
          </div>
          {r.needs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {dict.lore.professionNeeds}:{' '}
              {r.needs.map((n, i) => {
                const label = `${n.qty}× ${pt ? (n.namePt ?? n.name) : n.name}`;
                return (
                  <span key={i}>
                    {i > 0 && ', '}
                    {n.slug ? <Link href={`/detail/${n.slug}`} className="text-card-foreground hover:text-primary hover:underline">{label}</Link> : label}
                  </span>
                );
              })}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
