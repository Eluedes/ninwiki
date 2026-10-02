'use client';

// Quadro de avisos da equipe (Visao Geral do painel).
//   - Quem tem notices.view le os avisos e baixa os arquivos.
//   - Quem tem notices.manage (Adm / S.Adm por padrao) posta, edita, apaga e anexa arquivos.
// A API e' quem decide: esconder os botoes aqui e' so' experiencia de uso.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, Megaphone, Paperclip, Pencil, Pin, Plus, Trash2, X } from 'lucide-react';
import {
  ApiError, createNotice, deleteNotice, deleteNoticeFile, listNotices, noticeFileUrl, updateNotice, uploadNoticeFile,
  type ApiNotice,
} from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Limite de tamanho por arquivo (igual ao MAX_NOTICE_FILE_MB padrao da API); a API confere de novo.
const MAX_FILE_MB = 200;

/** Tamanho de arquivo legivel (B, KB, MB). */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface FormState {
  id: string | null; // null = aviso novo
  title: string;
  body: string;
  pinned: boolean;
  newFiles: File[];
}

/** Quadro de avisos da equipe: lista, formulario de postar/editar e anexos para baixar. */
export function NoticeBoard() {
  const { dict, locale } = useLanguage();
  const { can } = useAuth();
  const t = dict.admin.noticeBoard;
  const canManage = can('notices.manage');
  const [notices, setNotices] = useState<ApiNotice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null); // "nome.zip (45%)" enquanto um arquivo sobe
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    listNotices()
      .then((n) => { setNotices(n); setError(null); })
      .catch((err) => setError(err instanceof ApiError ? err.message : t.loadError));
  }, [t.loadError]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ id: null, title: '', body: '', pinned: false, newFiles: [] });
  }

  function openEdit(n: ApiNotice) {
    setForm({ id: n.id, title: n.title, body: n.body, pinned: n.pinned, newFiles: [] });
  }

  /**
   * Salva o aviso e envia os arquivos. O aviso aparece na lista ASSIM que e' salvo (antes dos arquivos subirem), cada arquivo
   * mostra o progresso e qualquer falha vira mensagem - a tela nunca fica girando sem fim.
   */
  async function submit() {
    if (!form || !form.title.trim()) return;
    const tooBig = form.newFiles.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setError(t.fileTooBig.replace('{name}', tooBig.name).replace('{mb}', String(MAX_FILE_MB)));
      return;
    }
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    try {
      const payload = { title: form.title.trim(), body: form.body, pinned: form.pinned };
      const saved = form.id ? await updateNotice(form.id, payload) : await createNotice(payload);
      load(); // o aviso ja' aparece na lista, mesmo que os anexos demorem
      for (const file of form.newFiles) {
        setProgress(`${file.name} (0%)`);
        try {
          await uploadNoticeFile(saved.id, file, (pct) => setProgress(`${file.name} (${pct}%)`));
        } catch (err) {
          failures.push(`${file.name}: ${err instanceof ApiError ? err.message : t.uploadError}`);
        }
      }
      setForm(null);
      if (failures.length) setError(failures.join(' | '));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setProgress(null);
      setBusy(false);
      load();
    }
  }

  async function remove(n: ApiNotice) {
    if (!window.confirm(t.confirmDelete.replace('{title}', n.title))) return;
    try {
      await deleteNotice(n.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    }
  }

  async function removeFile(n: ApiNotice, fileId: string) {
    try {
      const updated = await deleteNoticeFile(n.id, fileId);
      setNotices((list) => list?.map((x) => (x.id === n.id ? updated : x)) ?? list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    }
  }

  const editing = form?.id ? notices?.find((n) => n.id === form.id) : undefined;

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Megaphone className="h-5 w-5 text-primary" />
            {t.title}
          </h2>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        {canManage && !form && (
          <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />{t.newNotice}</Button>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">{error}</p>}

      {form && (
        <div className="mb-4 space-y-3 rounded-lg border border-primary/30 bg-secondary/20 p-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t.titleLabel}</label>
            <Input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">{t.bodyLabel}</label>
            <Textarea rows={5} value={form.body} maxLength={5000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            {t.pin}
          </label>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInput} type="file" multiple className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setForm((f) => (f ? { ...f, newFiles: [...f.newFiles, ...picked] } : f));
                  if (fileInput.current) fileInput.current.value = '';
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                <Paperclip className="mr-1.5 h-4 w-4" />{t.attachFiles}
              </Button>
              <span className="text-xs text-muted-foreground">{t.maxInfo}</span>
            </div>
            <ul className="space-y-1">
              {editing?.files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.filename}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                  <button type="button" title={t.removeFile} onClick={() => editing && removeFile(editing, f.id)}
                    className="text-muted-foreground hover:text-red-400"><X className="h-4 w-4" /></button>
                </li>
              ))}
              {form.newFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-primary">
                  <Paperclip className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                  <button type="button" title={t.removeFile}
                    onClick={() => setForm((cur) => (cur ? { ...cur, newFiles: cur.newFiles.filter((_, j) => j !== i) } : cur))}
                    className="text-muted-foreground hover:text-red-400"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !form.title.trim()} onClick={submit}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {busy ? (progress ? `${t.uploading} ${progress}` : t.saving) : t.save}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setForm(null)}>{t.cancel}</Button>
          </div>
        </div>
      )}

      {notices === null && !error ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : notices?.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <div className="space-y-3">
          {notices?.map((n) => (
            <article key={n.id} className={cn('rounded-lg border p-4', n.pinned ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/20')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-semibold text-card-foreground">
                    {n.pinned && <Pin className="h-4 w-4 shrink-0 text-primary" aria-label={t.pinned} />}
                    <span className="break-words">{n.title}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {n.authorName ? ` · ${t.by} ${n.authorName}` : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" title={t.edit} onClick={() => openEdit(n)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-card-foreground"><Pencil className="h-4 w-4" /></button>
                    <button type="button" title={t.delete} onClick={() => remove(n)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-red-900/20 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {n.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-card-foreground/90">{n.body}</p>}
              {n.files.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {n.files.map((f) => (
                    <li key={f.id}>
                      <a href={noticeFileUrl(f.id)} download
                        className="inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-primary transition-colors hover:border-primary/50">
                        <Download className="h-4 w-4 shrink-0" />
                        <span className="truncate">{f.filename}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatSize(f.size)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
