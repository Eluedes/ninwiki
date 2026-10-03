'use client';

// Cartao do importador de noticias da Steam (aparece na lista de posts do blog para quem tem posts.publish, so' se o importador estiver ligado
// na API: STEAM_NEWS_APP_ID). Mostra o resultado da ultima conferencia e tem o botao "Importar agora".

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, getSteamNewsStatus, runSteamNewsImport, type ApiSteamStatus } from '@/lib/api-client';

/** Cartao "Notícias da Steam": estado, ultima conferencia e importar agora. Some se o importador estiver desligado. */
export function SteamImportCard({ onImported }: { onImported?: () => void }) {
  const { dict } = useLanguage();
  const t = dict.admin.steamImport;
  const [status, setStatus] = useState<ApiSteamStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSteamNewsStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status?.enabled) return null;
  const run = status.lastRun;

  /** Pede a' API para conferir a Steam agora e atualiza o cartao (e a lista de posts, se algo foi importado). */
  async function handleRun() {
    setBusy(true);
    setError(null);
    try {
      const next = await runSteamNewsImport();
      setStatus(next);
      if (next.lastRun?.imported) onImported?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-semibold">{t.title} <span className="font-normal text-muted-foreground">· app {status.appId}</span></p>
        <p className="text-muted-foreground">{t.desc}</p>
        <p className="text-xs text-muted-foreground">{status.mode === 'draft' ? t.draftMode : t.liveMode}</p>
        {run && (
          <p className="text-xs text-muted-foreground">
            {t.last}: {new Date(run.at).toLocaleString()} — {t.result.replace('{fetched}', String(run.fetched)).replace('{matched}', String(run.matched)).replace('{imported}', String(run.imported)).replace('{skipped}', String(run.skipped))}
            {run.titles.length > 0 && <> ({run.titles.join(', ')})</>}
          </p>
        )}
        {run && run.imported === 0 && run.seen && run.seen.length > 0 && (
          <div className="rounded border border-border bg-secondary/30 p-2 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold">{t.seenTitle}</p>
            {run.seen.map((s, i) => <p key={i} className="truncate">• {s.title} · {s.tags.length ? s.tags.join(', ') : t.noTags}</p>)}
          </div>
        )}
        {run?.errors.map((e) => <p key={e} className="text-xs text-destructive">{e}</p>)}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button variant="outline" onClick={handleRun} disabled={busy} className="shrink-0">
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
        {busy ? t.running : t.run}
      </Button>
    </div>
  );
}
