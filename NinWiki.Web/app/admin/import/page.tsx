'use client';

// Importacao de JSON em massa - item #6 do roadmap. Cria VARIAS
// entries de Conteudo de uma vez, todas como RASCUNHO, a partir de um
// arquivo JSON com so' nome + categoria (sem inventar nivel/descricao -
// isso continua exigindo revisao humana depois, ver POST
// /content-items/bulk-import no backend pro detalhe completo).
//
// Pensado pro fluxo real do Rafael: extrair nomes de um dump do jogo
// (ex: arquivo de localizacao), montar esse JSON simples, e subir aqui
// em vez de clicar "+ Nova entry" centenas de vezes.

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertTriangle, FileJson } from 'lucide-react';
import { bulkImportContentItems, ApiError, type BulkImportEntry, type BulkImportResult } from '@/lib/api-client';
import type { Category } from '@/lib/types';
import type { Dictionary } from '@/lib/i18n';

const VALID_CATEGORIES: Category[] = ['mobs', 'items', 'weapons', 'missions', 'guides'];

// Valida a FORMA do JSON antes de mandar pra API - pega erro de
// digitacao no arquivo (ex: "categoria" em vez de "category", ou um
// valor de categoria que nao existe) e mostra na hora, em vez de
// deixar a API devolver um 422 generico dificil de entender.
function validateEntries(raw: unknown, t: Dictionary['admin']['import']): { entries: BulkImportEntry[] } | { error: string } {
  if (typeof raw !== 'object' || raw === null || !('entries' in raw)) {
    return { error: t.errNeedsEntries };
  }
  const entries = (raw as { entries: unknown }).entries;
  if (!Array.isArray(entries)) {
    return { error: t.errEntriesArray };
  }
  if (entries.length === 0) {
    return { error: t.errEntriesEmpty };
  }
  if (entries.length > 5000) {
    return { error: t.errTooMany.replace('{count}', String(entries.length)) };
  }
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (typeof e !== 'object' || e === null) {
      return { error: t.errItemNotObject.replace('{index}', String(i + 1)) };
    }
    const obj = e as Record<string, unknown>;
    if (typeof obj.name !== 'string' || obj.name.trim() === '') {
      return { error: t.errNameMissing.replace('{index}', String(i + 1)) };
    }
    if (typeof obj.category !== 'string' || !VALID_CATEGORIES.includes(obj.category as Category)) {
      return {
        error: t.errInvalidCategory
          .replace('{index}', String(i + 1))
          .replace('{name}', String(obj.name))
          .replace('{categories}', VALID_CATEGORIES.join(', ')),
      };
    }
  }
  return { entries: entries as BulkImportEntry[] };
}

/** Importacao de JSON em massa. */
export default function BulkImportPage() {
  const { dict } = useLanguage();
  const t = dict.admin.import;
  const [fileName, setFileName] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [pendingEntries, setPendingEntries] = useState<BulkImportEntry[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setApiError(null);
    setParseError(null);
    setPendingEntries(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const validated = validateEntries(raw, t);
      if ('error' in validated) {
        setParseError(validated.error);
        return;
      }
      setPendingEntries(validated.entries);
      setEntryCount(validated.entries.length);
    } catch {
      setParseError(t.invalidJson);
    }
  }

  async function handleImport() {
    if (!pendingEntries) return;
    setImporting(true);
    setApiError(null);
    try {
      const res = await bulkImportContentItems(pendingEntries);
      setResult(res);
      setPendingEntries(null);
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : t.importError);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/content" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t.description}</p>

        <div className="mt-4 rounded-lg bg-secondary/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-card-foreground">
            <FileJson className="h-3.5 w-3.5" /> {t.formatTitle}
          </p>
          <pre className="overflow-x-auto text-xs text-muted-foreground">{`{
  "entries": [
    { "name": "Fire Larva", "category": "mobs", "mobType": "monster" },
    { "name": "Chakra Pill", "category": "items" },
    { "name": "Academy Scrolls", "category": "missions" }
  ]
}`}</pre>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t.acceptedCategories}: {VALID_CATEGORIES.join(', ')}. <code className="text-[11px]">mobType</code>/
            <code className="text-[11px]">itemType</code> são opcionais.
          </p>
        </div>

        <div className="mt-5">
          <input type="file" accept="application/json" onChange={handleFileChange} className="hidden" id="bulk-import-file" />
          <label htmlFor="bulk-import-file">
            <Button type="button" variant="outline" asChild>
              <span className="cursor-pointer">
                <Upload className="mr-1.5 h-4 w-4" />
                {t.chooseFile}
              </span>
            </Button>
          </label>
          {fileName && <span className="ml-3 text-sm text-muted-foreground">{fileName}</span>}
        </div>

        {parseError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{parseError}</p>
          </div>
        )}

        {pendingEntries && entryCount !== null && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-card-foreground">
              <strong>{entryCount}</strong> {entryCount === 1 ? t.entryReady : t.entriesReady}.
            </p>
            <Button type="button" onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {importing ? t.importing : t.importButton.replace('{count}', String(entryCount))}
            </Button>
          </div>
        )}

        {apiError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{apiError}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-900/30 bg-emerald-900/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="text-sm">
              <p className="font-semibold text-card-foreground">
                {result.created} {result.created === 1 ? t.entryCreated : t.created}.
              </p>
              {result.skippedDuplicates > 0 && (
                <p className="text-muted-foreground">
                  {result.skippedDuplicates} {result.skippedDuplicates === 1 ? t.entrySkipped : t.skipped}.
                </p>
              )}
              <Link href="/admin/content" className="mt-1.5 inline-block text-primary hover:underline">
                {t.viewInList}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
