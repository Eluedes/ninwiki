'use client';

// "Nomes novos do jogo": le o arquivo de traducao em INGLES exportado do Nin Online (e, se quiser, o de Portugues para trazer o nome
// oficial) e lista os textos que parecem NOMES e que o wiki ainda nao tem (nem como rascunho da importacao). A pessoa filtra, marca e
// escolhe a categoria; os marcados viram RASCUNHOS pelo mesmo import em massa. Nada e' criado sem o clique em "Criar rascunhos".

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, bulkImportContentItems, findNewGameNames, type ApiNewName, type ApiNewNamesResult } from '@/lib/api-client';
import type { Category } from '@/lib/types';

const CATEGORIES: Category[] = ['items', 'weapons', 'mobs', 'missions', 'guides'];
const SHOW_LIMIT = 300;   // linhas na tela de uma vez (o filtro e "marcar todos" valem para a lista inteira)

/** Cartao "Nomes novos do arquivo do jogo". */
export function GameNamesFinder() {
  const { dict } = useLanguage();
  const t = dict.admin.gameNames;
  const [english, setEnglish] = useState<Record<string, string> | null>(null);
  const [portuguese, setPortuguese] = useState<Record<string, string> | null>(null);
  const [info, setInfo] = useState<string[]>([]);
  const [result, setResult] = useState<ApiNewNamesResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [hideJutsu, setHideJutsu] = useState(true);
  const [category, setCategory] = useState<Category>('items');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ created: number; skipped: number } | null>(null);

  /** Le os arquivos escolhidos (podem vir os dois juntos) e separa pelo campo "language". */
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setResult(null); setCreated(null); setError(null); setSelected(new Set()); setEnglish(null); setPortuguese(null); setInfo([]);
    const files = Array.from(e.target.files ?? []);
    const lines: string[] = [];
    let en: Record<string, string> | null = null;
    let pt: Record<string, string> | null = null;
    for (const f of files) {
      try {
        const data = JSON.parse(await f.text());
        if (data?.format !== 'nin-online-translation' || typeof data.translations !== 'object' || data.translations === null) throw new Error('format');
        const lang = String(data.language ?? '').toLowerCase();
        if (lang.includes('portuguese')) pt = data.translations; else en = data.translations;
        lines.push(`${f.name} — ${data.language} · ${Object.keys(data.translations).length.toLocaleString()}`);
      } catch {
        setError(t.invalidFile);
        return;
      }
    }
    if (!en && pt) en = pt;   // so' o de Portugues: as chaves tambem sao os textos em ingles
    setEnglish(en); setPortuguese(pt); setInfo(lines);
  }

  /** Pede a lista de nomes novos. */
  async function find() {
    if (!english) return;
    setBusy(true); setError(null); setCreated(null);
    try {
      const res = await findNewGameNames(english, portuguese);
      setResult(res);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo<ApiNewName[]>(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return result.candidates.filter((c) => (!hideJutsu || c.hint !== 'jutsu') && (!q || c.name.toLowerCase().includes(q) || (c.namePt ?? '').toLowerCase().includes(q)));
  }, [result, query, hideJutsu]);

  /** Marca/desmarca um nome. */
  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }

  /** Cria os marcados como rascunho (mesmo import em massa; duplicados sao pulados pela API). */
  async function createDrafts() {
    if (!result || selected.size === 0) return;
    if (!window.confirm(t.confirm.replace('{n}', String(selected.size)).replace('{category}', t.categories[category]))) return;
    setBusy(true); setError(null);
    try {
      const picked = result.candidates.filter((c) => selected.has(c.name));
      let made = 0, skipped = 0;
      for (let i = 0; i < picked.length; i += 5000) {
        const r = await bulkImportContentItems(picked.slice(i, i + 5000).map((c) => ({ name: c.name, namePt: c.namePt, category })));
        made += r.created; skipped += r.skippedDuplicates;
      }
      setCreated({ created: made, skipped });
      const gone = new Set(picked.map((c) => c.name));
      setResult({ ...result, candidates: result.candidates.filter((c) => !gone.has(c.name)) });
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-semibold text-card-foreground">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">
        <FileJson className="h-4 w-4" />{t.chooseFiles}
        <input type="file" accept="application/json,.json" multiple className="hidden" onChange={handleFiles} />
      </label>
      {info.length > 0 && <ul className="text-sm text-muted-foreground">{info.map((l) => <li key={l}>{l}</li>)}</ul>}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>
      )}
      {english && (
        <Button variant="outline" onClick={find} disabled={busy}>
          {busy && !result && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{t.find}
        </Button>
      )}

      {created && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{t.created.replace('{n}', String(created.created)).replace('{s}', String(created.skipped))}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t.summary.replace('{total}', result.totalStrings.toLocaleString()).replace('{names}', result.nameLike.toLocaleString())
              .replace('{have}', result.alreadyInWiki.toLocaleString()).replace('{new}', result.candidates.length.toLocaleString())}
            {result.truncated ? ` ${t.truncated}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={hideJutsu} onChange={(e) => setHideJutsu(e.target.checked)} />{t.hideJutsu}
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => setSelected(new Set(visible.map((c) => c.name)))}>{t.selectShown} ({visible.length})</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t.clear}</Button>
          </div>
          <ul className="max-h-96 divide-y divide-border overflow-auto rounded-lg border border-border">
            {visible.slice(0, SHOW_LIMIT).map((c) => (
              <li key={c.name}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-secondary/50">
                  <input type="checkbox" checked={selected.has(c.name)} onChange={() => toggle(c.name)} />
                  <span className="min-w-0 flex-1 truncate">{c.name}{c.namePt && c.namePt !== c.name ? <span className="text-muted-foreground"> — {c.namePt}</span> : null}</span>
                  {c.hint && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t.hints[c.hint]}</span>}
                </label>
              </li>
            ))}
            {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t.empty}</li>}
          </ul>
          {visible.length > SHOW_LIMIT && <p className="text-xs text-muted-foreground">{t.moreHidden.replace('{n}', String(visible.length - SHOW_LIMIT))}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
            </select>
            <Button onClick={createDrafts} disabled={busy || selected.size === 0}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{t.createDrafts} ({selected.size})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t.note}</p>
        </div>
      )}
    </div>
  );
}
