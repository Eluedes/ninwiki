'use client';

// Escolhe um JUTSU do catalogo para ligar a um ataque de mob (Jutsu / Attacks): digita para buscar pelo nome (ou pelo id) e clica no resultado.
// Ligado, o selo verde mostra que o ataque aponta para o jutsu (clicar no selo desliga). A lista de jutsus e' carregada uma vez, na primeira busca.

import { useState } from 'react';
import { Link2, Loader2, X } from 'lucide-react';
import { listJutsus, type ApiJutsu } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';

/** Campo de busca de jutsu (ou o selo "ligado" quando `linkedId` existe). */
export function JutsuPicker({ linkedId, onLink, onUnlink }: { linkedId: string | null | undefined; onLink: (jutsu: ApiJutsu) => void; onUnlink: () => void }) {
  const { dict } = useLanguage();
  const t = dict.admin.jutsuPicker;
  const [all, setAll] = useState<ApiJutsu[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  /** Carrega a lista de jutsus na primeira vez que a pessoa clica no campo. */
  function ensureLoaded() {
    if (all || loading) return;
    setLoading(true);
    listJutsus().then(setAll).catch(() => setAll([])).finally(() => setLoading(false));
  }

  if (linkedId) {
    return (
      <button
        type="button" onClick={onUnlink} title={t.linkedTitle}
        className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-900/20 px-2 py-1.5 text-xs text-emerald-400 transition-colors hover:border-red-600/40 hover:bg-red-900/20 hover:text-red-400"
      >
        <Link2 className="h-3 w-3" /> {t.linked} <X className="h-3 w-3" />
      </button>
    );
  }

  const q = query.trim().toLowerCase();
  const results = q && all ? all.filter((j) => `${j.name} ${j.namePt ?? ''} ${j.id}`.toLowerCase().includes(q)).slice(0, 12) : [];

  return (
    <div className="relative shrink-0">
      <input
        type="text" value={query} placeholder={t.placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { ensureLoaded(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-44 rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && q && (
        <div className="absolute right-0 z-10 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {loading && <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {t.loading}</div>}
          {!loading && results.map((j) => (
            <button
              key={j.id} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onLink(j); setQuery(''); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-secondary"
            >
              <span className="truncate text-popover-foreground">{j.name}</span>
              <span className="shrink-0 text-muted-foreground">{j.masteryId}</span>
            </button>
          ))}
          {!loading && results.length === 0 && <p className="p-2 text-xs text-muted-foreground">{t.noResults}</p>}
        </div>
      )}
    </div>
  );
}
