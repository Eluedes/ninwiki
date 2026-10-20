'use client';

// Comparador lado a lado de DOIS itens/armas: cada lado tem um seletor com busca (so' itens e armas publicados); abaixo uma tabela
// com tipo, raridade, nivel, dados da arma, stack e os atributos (uniao das duas listas). Linhas em que os dois lados diferem ficam
// destacadas. A escolha mora na URL (?a=&b=), entao o link da comparacao pode ser compartilhado.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { WikiImage } from '@/components/wiki/wiki-image';
import { rarityConfig } from '@/lib/data';
import { itemTypeLabels } from '@/lib/item-types';
import { cn, signedValue } from '@/lib/utils';
import { listContentItems, type ApiContentItem, type ApiContentItemSummary } from '@/lib/api-client';

type Side = 'a' | 'b';

/** Seletor de UM lado: mostra a entry escolhida (com X para trocar) ou uma busca por nome. */
function Picker({ entry, onPick, onClear }: { entry: ApiContentItem | null; onPick: (slug: string) => void; onClear: () => void }) {
  const { dict, locale } = useLanguage();
  const t = dict.compare;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiContentItemSummary[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    // espera ao digitar para nao chamar a API a cada tecla; so' itens e armas entram na comparacao
    const timer = setTimeout(async () => {
      try {
        const found = await listContentItems(undefined, 'published', query.trim());
        setResults(found.filter((e) => e.category === 'items' || e.category === 'weapons'));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (entry) {
    const name = locale === 'pt' ? (entry.namePt ?? entry.name) : entry.name;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <WikiImage src={entry.image} alt="" fallback={entry.icon} className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Link href={`/detail/${entry.slug}`} className="block truncate font-semibold hover:underline">{name}</Link>
          <span className={cn('text-xs font-semibold', rarityConfig[entry.rarity].color)}>{rarityConfig[entry.rarity].label}</span>
        </div>
        <button type="button" onClick={onClear} title={t.change} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-card-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }
  const shown = query.trim().length >= 2 ? results : [];
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="pl-8" placeholder={t.search} value={query} maxLength={60} onChange={(e) => setQuery(e.target.value)} />
      {shown.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onPick(r.slug)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
                <span>{r.icon}</span>
                <span className="truncate">{locale === 'pt' ? (r.namePt ?? r.name) : r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && shown.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{t.noResults}</p>}
    </div>
  );
}

/** Pagina de comparacao (as duas entries ja' vem do servidor; null = lado vazio). */
export function CompareClient({ a, b }: { a: ApiContentItem | null; b: ApiContentItem | null }) {
  const { dict } = useLanguage();
  const t = dict.compare;
  const router = useRouter();

  /** Troca um lado na URL (mantem o outro). */
  function setSide(side: Side, slug: string | null) {
    const params = new URLSearchParams();
    const next = { a: a?.slug ?? null, b: b?.slug ?? null, [side]: slug };
    if (next.a) params.set('a', next.a);
    if (next.b) params.set('b', next.b);
    router.push(`/compare${params.size ? `?${params}` : ''}`);
  }

  const typeLabels = itemTypeLabels(dict.admin.contentEditor);
  // Linhas da tabela: [rotulo, valor de A, valor de B]; so' entram as que ao menos um lado tem.
  const rows: [string, string, string][] = [];
  const add = (label: string, va: string | null | undefined, vb: string | null | undefined) => {
    if (va || vb) rows.push([label, va || '—', vb || '—']);
  };
  if (a || b) {
    add(dict.detail.itemType, a?.itemType ? (typeLabels[a.itemType] ?? a.itemType) : (a?.category === 'weapons' ? dict.nav.weapons : null),
        b?.itemType ? (typeLabels[b.itemType] ?? b.itemType) : (b?.category === 'weapons' ? dict.nav.weapons : null));
    add(dict.admin.contentEditor.rarity, a ? rarityConfig[a.rarity].label : null, b ? rarityConfig[b.rarity].label : null);
    add(dict.detail.level, a?.levelUnknown ? '???' : a?.level ? String(a.level) : null, b?.levelUnknown ? '???' : b?.level ? String(b.level) : null);
    add(dict.detail.weaponType, a?.weaponType, b?.weaponType);
    add(dict.detail.baseDamage, a?.weaponBaseDamage, b?.weaponBaseDamage);
    add(dict.detail.specialAbility, a?.weaponSpecialAbility, b?.weaponSpecialAbility);
    add(dict.detail.attackSpeed, a?.weaponSpeed, b?.weaponSpeed);
    add(dict.detail.knockbackDistance, a?.weaponKnockbackDistance, b?.weaponKnockbackDistance);
    add(dict.detail.statReq, (a?.weaponRequirement ?? '').split('\n').filter(Boolean).join(' · '), (b?.weaponRequirement ?? '').split('\n').filter(Boolean).join(' · '));
    add(dict.detail.maxStack, a?.maxStack != null ? String(a.maxStack) : null, b?.maxStack != null ? String(b.maxStack) : null);
    // Atributos: uniao dos rotulos das duas entries, na ordem em que aparecem
    const labels = [...new Set([...(a?.attributes ?? []), ...(b?.attributes ?? [])].map((x) => x.label))];
    for (const label of labels) {
      const va = a?.attributes.find((x) => x.label === label)?.value;
      const vb = b?.attributes.find((x) => x.label === label)?.value;
      add(label, va ? signedValue(va) : null, vb ? signedValue(vb) : null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/catalog/items" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        {dict.detail.back}
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t.subtitle}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Picker entry={a} onPick={(s) => setSide('a', s)} onClear={() => setSide('a', null)} />
        <Picker entry={b} onPick={(s) => setSide('b', s)} onClear={() => setSide('b', null)} />
      </div>

      {a && b && rows.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          {rows.map(([label, va, vb]) => (
            <div key={label} className={cn('grid grid-cols-[1fr_1fr_1fr] items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0', va !== vb && 'bg-primary/5')}>
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold">{va}</span>
              <span className="font-semibold">{vb}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">{t.pickBoth}</p>
      )}
    </div>
  );
}
