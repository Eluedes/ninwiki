'use client';

// Janela "Escolher imagem do banco de imagens": grade com miniaturas, busca por nome ou ID, envio de imagens novas e clique para escolher.
// Usada pelo campo de imagem (ImageUploadField) e pelo botao de imagem do editor do blog.

import { UploadProgressBar } from '@/components/admin/upload-progress';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError, listMedia, type ApiMedia } from '@/lib/api-client';
import { DropZone } from '@/components/admin/drop-zone';
import { useMediaUpload } from '@/components/admin/use-media-upload';

const PAGE = 48;

/** Janela de escolha de imagem do banco: devolve a imagem clicada em `onPick`. */
export function MediaPickerDialog({ open, onOpenChange, onPick }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (media: ApiMedia) => void;
}) {
  const { dict } = useLanguage();
  const t = dict.admin.mediaPage;
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ApiMedia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { state: up, upload } = useMediaUpload();
  const { can } = useAuth();
  const canUpload = can('media.upload');   // enviar pelo banco de imagens: so' quem tem media.upload (padrao S.Adm); escolher uma imagem existente e' livre
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Carrega a primeira pagina da busca atual (ou acrescenta a proxima). */
  const load = useCallback(async (query: string, offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const page = await listMedia(query, PAGE, offset);
      setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
      setTotal(page.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  // Busca com pequena espera (nao consulta a API a cada tecla).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { load(q, 0); }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, q, load]);

  /** Envia as imagens escolhidas no seletor ou soltas na janela (varias de uma vez) e recarrega a grade. */
  async function sendFiles(files: File[]) {
    setError(null);
    const created = await upload(files);
    if (created.length) await load(q, 0);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length) void sendFiles(files);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t.pickTitle}</DialogTitle></DialogHeader>
        <DropZone onFiles={sendFiles} label={t.dropHere} disabled={up.busy || !canUpload} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="pl-8" />
          </div>
          {canUpload && (
            <>
              <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleUpload} />
              <Button type="button" variant="outline" disabled={up.busy} onClick={() => fileRef.current?.click()}>
                {up.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                {up.busy ? t.progress.replace('{done}', String(up.done)).replace('{total}', String(up.total)) : t.upload}
              </Button>
            </>
          )}
        </div>
        {up.busy && <UploadProgressBar loaded={up.loaded} total={up.totalBytes} detail={`${up.done}/${up.total} ${dict.admin.uploadProgress.files}`} />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {up.errors.map((e) => <p key={e} className="text-sm text-destructive">{e}</p>)}
        {up.skipped > 0 && <p className="text-sm text-amber-400">{t.skipped.replace('{n}', String(up.skipped))}</p>}

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((m) => (
            <button
              key={m.id} type="button" onClick={() => { onPick(m); onOpenChange(false); }} title={`${t.pick} #${m.id}`}
              className="group overflow-hidden rounded-lg border border-border bg-secondary/20 text-left transition-colors hover:border-primary"
            >
              <div className="flex aspect-square items-center justify-center bg-secondary/30">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de arquivo do proprio servidor de uploads */}
                <img src={m.url} alt={m.name || `#${m.id}`} loading="lazy" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-xs font-bold text-primary">#{m.id}</p>
                <p className="truncate text-[11px] text-muted-foreground">{m.name || t.unnamed}</p>
              </div>
            </button>
          ))}
        </div>
        {!loading && items.length === 0 && !error && <p className="py-8 text-center text-sm text-muted-foreground">{t.empty}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t.total.replace('{n}', String(total))}</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loading && items.length < total && (
            <Button type="button" variant="outline" size="sm" onClick={() => load(q, items.length)}>{t.loadMore}</Button>
          )}
        </div>
        </DropZone>
      </DialogContent>
    </Dialog>
  );
}
