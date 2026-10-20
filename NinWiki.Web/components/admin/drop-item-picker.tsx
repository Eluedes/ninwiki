'use client';

// Busca um item do catalogo pra ligar a um drop (dropped_item_id) -
// busca com debounce contra GET /content-items?search=..., em TODAS
// as categorias (decisao com o Rafael: mob pode dropar outro mob,
// item de missao, etc, entao a busca nao fica restrita so' a
// Item/Arma). Selecionar um resultado chama onLink com o item
// inteiro (id + name), pra' quem usa esse componente conseguir
// preencher o campo de nome do drop automaticamente tambem.

import { useState, useEffect } from 'react';
import { listContentItems, type ApiContentItemSummary } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { Link2, X, Loader2 } from 'lucide-react';

interface DropItemPickerProps {
  linkedId: string | null | undefined;
  onLink: (item: ApiContentItemSummary) => void;
  onUnlink: () => void;
  /** Se vier, so' mostra resultados dessas categorias (ex.: ['mobs'] para o NPC de uma arma). */
  onlyCategories?: string[];
}

/** Busca uma entry do catalogo para ligar a um drop de mob. */
export function DropItemPicker({ linkedId, onLink, onUnlink, onlyCategories }: DropItemPickerProps) {
  const { dict } = useLanguage();
  const t = dict.admin.dropPicker;
  const categoryLabels: Record<string, string> = {
    mobs: t.categoryMobs, items: t.categoryItems, weapons: t.categoryWeapons,
    missions: t.categoryMissions, guides: t.categoryGuides,
  };
  const [query, setQuery] = useState('');
  const [rawResults, setResults] = useState<ApiContentItemSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  // Sem texto digitado nao ha' resultado a mostrar (derivado - sem limpar estado dentro de efeito).
  const results = query.trim() ? rawResults.filter((r) => !onlyCategories || onlyCategories.includes(r.category)) : [];

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    // Debounce simples de 300ms - espera a pessoa parar de digitar
    // antes de bater na API, em vez de uma requisicao por tecla.
    // (o "buscando..." e' ligado na digitacao - ver onChange do campo.)
    const timeout = setTimeout(() => {
      listContentItems(undefined, undefined, query)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  // Ja' ligado a um item - mostra um "selo" verde em vez do campo de
  // busca. Clicar nele desliga (volta pro campo de busca).
  if (linkedId) {
    return (
      <button
        type="button"
        onClick={onUnlink}
        title={t.linkedTitle}
        className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-900/20 px-2 py-1.5 text-xs text-emerald-400 transition-colors hover:border-red-600/40 hover:bg-red-900/20 hover:text-red-400"
      >
        <Link2 className="h-3 w-3" /> {t.linked} <X className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSearching(e.target.value.trim().length > 0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // onMouseDown+preventDefault no botao do resultado (abaixo)
        // evita que esse blur feche a lista ANTES do clique registrar -
        // sem isso, clicar num resultado nunca funcionaria (o campo
        // perde foco e a lista some antes do onClick disparar).
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t.searchPlaceholder}
        className="w-40 rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && (searching || results.length > 0 || query.trim()) && (
        <div className="absolute z-10 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {searching && (
            <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {t.searching}
            </div>
          )}
          {!searching &&
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onLink(item);
                  setQuery('');
                  setResults([]);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-secondary"
              >
                <span className="truncate text-popover-foreground">{item.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {categoryLabels[item.category] ?? item.category}
                </span>
              </button>
            ))}
          {!searching && results.length === 0 && query.trim() && (
            <p className="p-2 text-xs text-muted-foreground">{t.noResults}</p>
          )}
        </div>
      )}
    </div>
  );
}
