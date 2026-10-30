'use client';

// Importacao das traducoes OFICIAIS do jogo (painel; exige translation.import): a pessoa escolhe o arquivo .json "Brazilian Portuguese"
// exportado do Nin Online, ve' o que mudaria (preview, nada e' gravado) e so' entao aplica. Tudo no navegador ate' o clique: o arquivo
// e' lido aqui e so' o dicionario (texto em ingles -> traducao) vai para a API.

import { formatDateTime, formatNumber } from '@/lib/utils';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileJson, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, importOfficialTranslations, type ApiTranslationResult } from '@/lib/api-client';

interface LoadedFile { name: string; language: string; count: number; exportedAt: string; translations: Record<string, string> }

/** Pagina de importacao das traducoes oficiais. */
export default function TranslationsPage() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.translationsPage;
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<ApiTranslationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  /** Le o arquivo escolhido e confere o formato (so' arquivos "nin-online-translation" em Portugues). */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    setResult(null); setDone(null); setError(null); setFile(null);
    if (!picked) return;
    try {
      const data = JSON.parse(await picked.text());
      if (data?.format !== 'nin-online-translation' || typeof data.translations !== 'object' || data.translations === null) {
        setError(t.invalidFile);
        return;
      }
      const language = String(data.language ?? '');
      if (!language.toLowerCase().includes('portuguese')) {
        setError(t.wrongLanguage);
        return;
      }
      setFile({ name: picked.name, language, count: Object.keys(data.translations).length, exportedAt: String(data.exportedAtUtc ?? ''), translations: data.translations });
    } catch {
      setError(t.loadError);
    }
  }

  /** Pede o preview (apply=false) ou grava (apply=true) e mostra o resultado. */
  async function run(apply: boolean) {
    if (!file) return;
    if (apply && result && !window.confirm(t.confirmApply.replace('{n}', String(result.totalChanges)))) return;
    setBusy(true); setError(null); setDone(null);
    try {
      const res = await importOfficialTranslations(apply, { translations: file.translations, language: file.language, overwrite });
      setResult(res);
      if (apply) setDone(res.totalChanges);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">
          <FileJson className="h-4 w-4" />
          {t.chooseFile}
          <input type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
        </label>
        {file && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-card-foreground">{file.name}</span> — {t.fileInfo
              .replace('{language}', file.language).replace('{count}', formatNumber(file.count, locale))
              .replace('{date}', file.exportedAt ? formatDateTime(file.exportedAt, locale) : '?')}
          </p>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}
        {file && (
          <>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setResult(null); setDone(null); }} />
              <span><span className="font-medium">{t.overwrite}</span><br /><span className="text-xs text-muted-foreground">{t.overwriteHint}</span></span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => run(false)} disabled={busy}>
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{busy ? t.working : t.preview}
              </Button>
              {result && !result.applied && result.totalChanges > 0 && (
                <Button onClick={() => run(true)} disabled={busy}>{t.apply} ({result.totalChanges})</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t.howTo}</p>
          </>
        )}
      </div>

      {done !== null && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />{t.applied.replace('{n}', String(done))}
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">{t.resultTitle}</h2>
          {result.totalChanges === 0 && <p className="text-sm text-muted-foreground">{t.nothing}</p>}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-4 gap-2 bg-secondary/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{t.colType}</span><span className="text-right">{t.colRecords}</span><span className="text-right">{t.colChanges}</span><span className="text-right">{t.colNoMatch}</span>
            </div>
            {result.breakdown.map((b) => (
              <div key={b.entity} className="grid grid-cols-4 gap-2 border-t border-border px-3 py-2 text-sm">
                <span>{t.types[b.entity] ?? b.entity}</span>
                <span className="text-right tabular-nums">{b.records}</span>
                <span className="text-right font-semibold tabular-nums">{b.changes}</span>
                <span className="text-right tabular-nums text-muted-foreground">{b.unmatched}</span>
              </div>
            ))}
          </div>

          {result.samples.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{t.samples}</h3>
              <ul className="space-y-2">
                {result.samples.map((s, i) => (
                  <li key={i} className="rounded-lg border border-border p-3 text-sm">
                    <div className="mb-1 text-xs text-muted-foreground">{t.types[s.entity] ?? s.entity} · {s.label} · {t.fields[s.field] ?? s.field}</div>
                    {s.old && <div className="break-words text-muted-foreground line-through">{s.old}</div>}
                    <div className="break-words font-medium">{s.new}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.breakdown.some((b) => b.unmatchedNames.length > 0) && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">{t.noMatchNames}</summary>
              <div className="mt-2 space-y-2">
                {result.breakdown.filter((b) => b.unmatchedNames.length > 0).map((b) => (
                  <p key={b.entity}><span className="font-medium">{t.types[b.entity] ?? b.entity}:</span> <span className="text-muted-foreground">{b.unmatchedNames.join(' · ')}{b.unmatched > b.unmatchedNames.length ? ' …' : ''}</span></p>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
