'use client';

// Banco de imagens (rota /admin/media): toda imagem enviada ganha um ID que a equipe digita nos campos de imagem (img:12, #12 ou 12).
// Ver e enviar: uploads.create. Renomear, apagar e importar da pasta: media.manage (a API confere de novo).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, FolderSync, Images, Loader2, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ApiError, deleteMedia, getMediaUsage, listMedia, renameMedia, syncMedia, uploadMedia, type ApiMedia,
} from '@/lib/api-client';

const PAGE = 60;

/** Copia um texto para a area de transferencia (sem erro se o navegador nao deixar). */
async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Tela do banco de imagens: grade com ID, busca, envio, copiar ID/endereco, renomear, apagar e importar da pasta. */
export default function MediaPage() {
  const { dict } = useLanguage();
  const { can } = useAuth();
  const t = dict.admin.mediaPage;
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ApiMedia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // 'upload' | 'sync' | 'del-<id>'
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const manage = can('media.manage');

  /** Carrega a primeira pagina da busca (ou acrescenta a proxima). */
  const load = useCallback(async (query: string, offset: number) => {
    setLoading(true);
    try {
      const page = await listMedia(query, PAGE, offset);
      setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
      setTotal(page.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    document.title = `${t.title} - Admin · Nin Online Wiki`;
    const timer = setTimeout(() => { load(q, 0); }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, load, t.title]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy('upload');
    setError(null);
    try {
      for (const f of files) await uploadMedia(f);
      await load(q, 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSync() {
    setBusy('sync');
    setError(null);
    try {
      const { added } = await syncMedia();
      setInfo(t.syncDone.replace('{n}', String(added)));
      await load(q, 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusy(null);
    }
  }

  async function handleRename(m: ApiMedia) {
    const name = window.prompt(t.renamePrompt.replace('{id}', String(m.id)), m.name);
    if (name === null) return;
    try {
      const updated = await renameMedia(m.id, name);
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    }
  }

  async function handleDelete(m: ApiMedia) {
    if (!window.confirm(t.confirmDelete.replace('{id}', String(m.id)))) return;
    setBusy(`del-${m.id}`);
    setError(null);
    try {
      try {
        await deleteMedia(m.id);
      } catch (err) {
        // Em uso (409): mostra onde e pergunta se apaga mesmo assim.
        if (!(err instanceof ApiError) || err.status !== 409) throw err;
        const uses = await getMediaUsage(m.id).catch(() => []);
        const where = uses.slice(0, 5).map((u) => `${u.kind}: ${u.label}`).join('; ') || err.message;
        if (!window.confirm(t.confirmForce.replace('{id}', String(m.id)).replace('{uses}', where))) return;
        await deleteMedia(m.id, true);
      }
      setItems((prev) => prev.filter((x) => x.id !== m.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy(key: string, text: string) {
    if (await copy(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Images className="h-6 w-6 text-primary" />{t.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="pl-8" />
        </div>
        <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleUpload} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}>
          {busy === 'upload' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
          {busy === 'upload' ? t.uploading : t.upload}
        </Button>
        {manage && (
          <Button variant="outline" onClick={handleSync} disabled={busy === 'sync'}>
            {busy === 'sync' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FolderSync className="mr-1.5 h-4 w-4" />}
            {busy === 'sync' ? t.syncing : t.sync}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {info && <p className="text-sm text-emerald-400">{info}</p>}
      <p className="text-xs text-muted-foreground">{t.howTo} · {t.total.replace('{n}', String(total))}</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((m) => (
          <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex aspect-square items-center justify-center bg-secondary/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de arquivo do proprio servidor de uploads */}
              <img src={m.url} alt={m.name || `#${m.id}`} loading="lazy" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
            </div>
            <div className="space-y-1.5 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-sm font-bold text-primary">#{m.id}</span>
                <span className="text-[11px] text-muted-foreground">{m.width}×{m.height} · {Math.max(1, Math.round(m.bytes / 1024))} KB</span>
              </div>
              <p className="truncate text-xs text-card-foreground" title={m.name}>{m.name || <span className="text-muted-foreground">{t.unnamed}</span>}</p>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => handleCopy(`id-${m.id}`, `img:${m.id}`)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-card-foreground">
                  {copied === `id-${m.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}{copied === `id-${m.id}` ? t.copied : t.copyId}
                </button>
                <button type="button" onClick={() => handleCopy(`url-${m.id}`, m.url)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-card-foreground">
                  {copied === `url-${m.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}{copied === `url-${m.id}` ? t.copied : t.copyUrl}
                </button>
                {manage && (
                  <>
                    <button type="button" title={t.rename} onClick={() => handleRename(m)} className="rounded border border-border p-1 text-muted-foreground hover:text-card-foreground"><Pencil className="h-3 w-3" /></button>
                    <button type="button" title={t.delete} disabled={busy === `del-${m.id}`} onClick={() => handleDelete(m)} className="rounded border border-border p-1 text-muted-foreground hover:text-red-400">
                      {busy === `del-${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      {!loading && items.length === 0 && !error && <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>}
      {!loading && items.length < total && (
        <div className="flex justify-center"><Button variant="outline" onClick={() => load(q, items.length)}>{t.loadMore}</Button></div>
      )}
    </div>
  );
}
