'use client';

// Banco de imagens (rota /admin/media): toda imagem enviada ganha um ID que a equipe digita nos campos de imagem (img:12, #12 ou 12).
// Ver: uploads.create. Enviar (lote/arrastar e soltar): media.upload (padrao so' S.Adm). Renomear, categoria, apagar e importar da pasta: media.manage (a API confere de novo).
// 100 imagens por pagina, com filtro por categoria (weapon, gear...).

import { UploadProgressBar } from '@/components/admin/upload-progress';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, FolderSync, Images, Loader2, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ApiError, MEDIA_CATEGORIES, bulkDeleteMedia, bulkSetMediaCategory, deleteMedia, getMediaUsage, listMedia, renameMedia, renumberMedia, setMediaCategory, syncMedia, type ApiMedia,
} from '@/lib/api-client';
import { DropZone } from '@/components/admin/drop-zone';
import { useMediaUpload } from '@/components/admin/use-media-upload';

const PAGE = 100;

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
  const [page, setPage] = useState(0);                 // pagina atual (0 = primeira)
  const [categoryState, setCategory] = useState('none');    // filtro: 'none' = sem categoria (padrao) ou uma categoria. NAO ha' mais "Todas"; a busca por texto procura em todas as visiveis
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [restricted, setRestricted] = useState(false);     // a busca bateu com imagem 'closed' que este usuario nao pode ver
  const [uploadCat, setUploadCat] = useState('');       // categoria dos novos envios (arquivos 'categoria__nome' usam a propria)
  const [bulkCat, setBulkCat] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set()); // imagens marcadas para apagar em massa
  const fileRef = useRef<HTMLInputElement>(null);
  const { state: up, upload } = useMediaUpload();
  const manage = can('media.manage');
  const canUpload = can('media.upload');
  const canResetIds = can('media.reset_ids');
  // 'closed' e' privada: so' quem tem media.closed (S.Adm) ve o botao e a opcao; os outros nem sabem que existe
  const categories = MEDIA_CATEGORIES.filter((c) => (c === 'closed' ? can('media.closed') : can(`media.cat.${c}`)));
  const canNone = can('media.cat.none');   // 'Sem categoria' tambem pode ser trancada para um cargo
  // Categoria aberta: se estiver trancada para este cargo (ou o login ainda nao carregou), mostra a primeira que ele pode ver
  const visibleKeys = [...categories, ...(canNone ? ['none'] : [])];
  const category = visibleKeys.includes(categoryState) ? categoryState : (canNone ? 'none' : (visibleKeys[0] ?? 'none'));

  // Avisa antes de fechar a aba no meio de um envio em lote
  useEffect(() => {
    if (!up.busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [up.busy]);

  /** Carrega uma pagina (50 imagens) da busca, ja' filtrada pela categoria. */
  const load = useCallback(async (query: string, pageNo: number, cat: string) => {
    setLoading(true);
    try {
      const res = await listMedia(query, PAGE, pageNo * PAGE, query.trim() ? undefined : cat);   // com texto na busca: procura em todas as categorias visiveis
      setItems(res.items);
      setTotal(res.total);
      setCounts(res.counts ?? {});
      setRestricted(Boolean(res.restricted));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    document.title = `${t.title} - Admin · Nin Online Wiki`;
    const timer = setTimeout(() => { load(q, page, category); }, q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, page, category, load, t.title]);

  /** Envia as imagens escolhidas no seletor ou soltas na tela (varias de uma vez) e recarrega a lista. */
  async function sendFiles(files: File[]) {
    setError(null);
    setInfo(null);
    const created = await upload(files, uploadCat);
    if (created.length) { if (page !== 0) setPage(0); else await load(q, 0, category); }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length) void sendFiles(files);
  }

  async function handleSync() {
    setBusy('sync');
    setError(null);
    try {
      const { added } = await syncMedia();
      setInfo(t.syncDone.replace('{n}', String(added)));
      await load(q, 0, category);
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

  /** Marca/desmarca uma imagem. */
  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Apaga as marcadas: primeiro as livres; as que estao em uso so' com uma segunda confirmacao (mostrando onde). */
  async function handleBulkDelete() {
    const ids = [...selected];
    if (!ids.length || !window.confirm(t.confirmBulk.replace('{n}', String(ids.length)))) return;
    setBusy('bulk');
    setError(null);
    try {
      let result = await bulkDeleteMedia(ids);
      let removed = result.deleted;
      if (result.inUse.length > 0) {
        const where = result.inUse.slice(0, 3).map((x) => `#${x.id} → ${x.uses[0]?.kind}: ${x.uses[0]?.label}`).join('; ');
        if (window.confirm(t.confirmBulkForce.replace('{n}', String(result.inUse.length)).replace('{where}', where))) {
          result = await bulkDeleteMedia(result.inUse.map((x) => x.id), true);
          removed = [...removed, ...result.deleted];
        }
      }
      setItems((prev) => prev.filter((x) => !removed.includes(x.id)));
      setTotal((n) => Math.max(0, n - removed.length));
      setSelected(new Set());
      setInfo(t.bulkDone.replace('{n}', String(removed.length)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusy(null);
    }
  }

  /** Renumera os IDs a partir de 1 (so' S.Adm), depois de confirmar. */
  async function handleResetIds() {
    if (!window.confirm(t.resetIdsConfirm)) return;
    setBusy('reset');
    setError(null);
    try {
      const { renumbered } = await renumberMedia();
      setInfo(t.resetIdsDone.replace('{n}', String(renumbered)));
      setSelected(new Set());
      if (page !== 0) setPage(0); else await load(q, 0, category);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusy(null);
    }
  }

  /** Muda a categoria de UMA imagem (select no cartao). */
  async function handleSetCategory(m: ApiMedia, cat: string) {
    try {
      const updated = await setMediaCategory(m.id, cat);
      setItems((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      await load(q, page, category);   // atualiza tambem os contadores e o filtro
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    }
  }

  /** Aplica a categoria escolhida a todas as imagens marcadas. */
  async function handleBulkCategory() {
    const ids = [...selected];
    if (!ids.length || bulkCat === '') return;
    setBusy('bulk');
    setError(null);
    try {
      const target = bulkCat === 'none' ? '' : bulkCat;
      const { updated } = await bulkSetMediaCategory(ids, target);
      setSelected(new Set());
      setBulkCat('');
      setInfo(`${updated} ✓`);
      await load(q, page, category);
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
    <DropZone onFiles={sendFiles} label={t.dropHere} disabled={up.busy || !canUpload} className="min-h-[70vh] space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Images className="h-6 w-6 text-primary" />{t.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={t.search} className="pl-8" />
        </div>
        {canUpload && (
          <>
            {manage && <select value={uploadCat} onChange={(e) => setUploadCat(e.target.value)} aria-label={t.newUploadCategory} title={t.newUploadCategory}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">{t.newUploadCategory}: {t.uncategorized}</option>
              {categories.map((c) => <option key={c} value={c}>{t.newUploadCategory}: {t.categories[c]}</option>)}
            </select>}
            <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileRef.current?.click()} disabled={up.busy}>
              {up.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {up.busy ? t.progress.replace('{done}', String(up.done)).replace('{total}', String(up.total)) : t.upload}
            </Button>
          </>
        )}
        {manage && (
          <Button variant="outline" onClick={handleSync} disabled={busy === 'sync'}>
            {busy === 'sync' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FolderSync className="mr-1.5 h-4 w-4" />}
            {busy === 'sync' ? t.syncing : t.sync}
          </Button>
        )}
        {canResetIds && (
          <Button variant="outline" onClick={handleResetIds} disabled={busy === 'reset'}>
            {busy === 'reset' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{t.resetIds}
          </Button>
        )}
      </div>

      {up.busy && <UploadProgressBar loaded={up.loaded} total={up.totalBytes} detail={`${up.done}/${up.total} ${dict.admin.uploadProgress.files}`} />}

      {/* Filtro por categoria (com a quantidade de cada uma) */}
      <div className="flex flex-wrap gap-1.5">
        {[...categories.map((c) => ({ key: c, label: t.categories[c], n: counts[c] ?? 0 })),
          ...(canNone ? [{ key: 'none', label: t.uncategorized, n: counts[''] ?? 0 }] : [])].map((c) => (
          <button
            key={c.key || 'all'} type="button" onClick={() => { setCategory(c.key); setPage(0); setSelected(new Set()); }}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${category === c.key ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-card-foreground'}`}
          >
            {c.label} <span className="opacity-70">{c.n}</span>
          </button>
        ))}
      </div>

      {q.trim() && <p className="text-xs text-muted-foreground">{t.searchingAll}</p>}
      {restricted && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{t.restrictedNotice}
        </div>
      )}
      {!canUpload && <p className="text-xs text-muted-foreground">{t.noUploadPermission}</p>}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {up.errors.length > 0 && (
        <div className="space-y-0.5 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {up.errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}
      {up.failed.length > 0 && !up.busy && (
        <Button variant="outline" size="sm" onClick={() => void sendFiles(up.failed)}>{t.retryFailed.replace('{n}', String(up.failed.length))}</Button>
      )}
      {up.skipped > 0 && <p className="text-sm text-amber-400">{t.skipped.replace('{n}', String(up.skipped))}</p>}
      {info && <p className="text-sm text-emerald-400">{info}</p>}

      {/* Barra de selecao em massa (so' quem pode apagar) */}
      {manage && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set(items.map((m) => m.id)))}>{t.selectAll}</button>
          {selected.size > 0 && (
            <>
              <span className="font-semibold">{t.selected.replace('{n}', String(selected.size))}</span>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setSelected(new Set())}>{t.clearSel}</button>
              <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" aria-label={t.setCategory}>
                <option value="">{t.setCategory}</option>
                {categories.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
                <option value="none">{t.uncategorized}</option>
              </select>
              <Button size="sm" variant="outline" disabled={busy === 'bulk' || bulkCat === ''} onClick={handleBulkCategory}>{t.applyCategory}</Button>
              <Button size="sm" variant="destructive" disabled={busy === 'bulk'} onClick={handleBulkDelete}>
                {busy === 'bulk' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}{t.deleteSelected}
              </Button>
            </>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t.howTo} · {t.total.replace('{n}', String(total))}</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((m) => (
          <div key={m.id} className={`relative overflow-hidden rounded-xl border bg-card shadow-sm ${selected.has(m.id) ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}>
            {manage && (
              <input
                type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} aria-label={`${t.select} #${m.id}`}
                className="absolute left-2 top-2 z-10 h-5 w-5 cursor-pointer accent-[hsl(var(--primary))]"
              />
            )}
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
              {manage ? (
                <select value={m.category} onChange={(e) => void handleSetCategory(m, e.target.value)} aria-label={t.categoryOf}
                  className="h-7 w-full rounded border border-input bg-background px-1 text-[11px] text-muted-foreground">
                  <option value="">{t.uncategorized}</option>
                  {categories.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
                </select>
              ) : (
                m.category && <span className="inline-block rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{t.categories[m.category] ?? m.category}</span>
              )}
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
      {total > PAGE && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => { setPage((p) => Math.max(0, p - 1)); setSelected(new Set()); }}>{t.prev}</Button>
          <span className="text-sm text-muted-foreground">{t.pageOf.replace('{page}', String(page + 1)).replace('{pages}', String(Math.max(1, Math.ceil(total / PAGE))))}</span>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total || loading} onClick={() => { setPage((p) => p + 1); setSelected(new Set()); }}>{t.next}</Button>
        </div>
      )}
    </DropZone>
  );
}
