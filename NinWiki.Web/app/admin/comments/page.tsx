'use client';

// Moderacao dos comentarios do blog (painel; exige comments.moderate): lista os comentarios mais recentes com o
// autor e o post, e deixa esconder/mostrar, apagar e banir/desbanir o leitor. Tudo e' registrado no log de auditoria.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Ban, Eye, EyeOff, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ApiError, deleteCommentModeration, listModerationComments, setCommentHidden, setReaderBanned, type ApiModerationComment,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** Pagina de moderacao de comentarios. */
export default function CommentsModerationPage() {
  const { dict, locale } = useLanguage();
  const t = dict.blogx.moderation;
  const [items, setItems] = useState<ApiModerationComment[]>([]);
  const [query, setQuery] = useState('');
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Recarrega a lista (com o filtro e a busca atuais). */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listModerationComments(onlyHidden, query));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [onlyHidden, query, t.loadError]);

  useEffect(() => {
    // pequena espera ao digitar na busca, para nao chamar a API a cada tecla
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  /** Roda uma acao de moderacao, mostra o erro se houver e recarrega a lista. */
  async function act(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.actionError);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
          {t.refresh}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={t.search} value={query} maxLength={60} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked)} />
          {t.onlyHidden}
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {!loading && items.length === 0 && !error && <p className="py-10 text-center text-sm text-muted-foreground">{t.empty}</p>}

      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className={cn('rounded-xl border border-border bg-card p-4 shadow-sm', c.hidden && 'opacity-70')}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-card-foreground">{c.readerName}</span>
              <span className="font-mono">({t.discordId}: {c.readerDiscordId})</span>
              {c.readerBanned && <span className="rounded bg-red-900/30 px-1.5 py-0.5 font-semibold text-red-400">{t.bannedBadge}</span>}
              {c.hidden && (
                <span className="rounded bg-amber-900/30 px-1.5 py-0.5 font-semibold text-amber-400">
                  {t.hiddenBadge}{c.hiddenBy ? ` · ${t.hiddenBy} ${c.hiddenBy}` : ''}
                </span>
              )}
              <span>{new Date(c.createdAt).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US')}</span>
              <span>
                {t.onPost}{' '}
                <Link href={`/blog/${c.postSlug}`} className="text-primary hover:underline" target="_blank">{c.postTitle}</Link>
              </span>
            </div>
            {/* Texto simples: o React escapa tudo, nunca interpreta HTML */}
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-card-foreground">{c.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline" size="sm" disabled={busyId === c.id}
                onClick={() => act(c.id, () => setCommentHidden(c.id, !c.hidden))}
              >
                {c.hidden ? <Eye className="mr-1.5 h-4 w-4" /> : <EyeOff className="mr-1.5 h-4 w-4" />}
                {c.hidden ? t.show : t.hide}
              </Button>
              <Button
                variant="outline" size="sm" disabled={busyId === c.id}
                onClick={() => {
                  if (window.confirm(t.confirmDelete)) act(c.id, () => deleteCommentModeration(c.id));
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t.delete}
              </Button>
              <Button
                variant="outline" size="sm" disabled={busyId === c.id}
                onClick={() => {
                  if (c.readerBanned || window.confirm(t.confirmBan.replace('{name}', c.readerName))) {
                    act(c.id, () => setReaderBanned(c.readerId, !c.readerBanned));
                  }
                }}
              >
                <Ban className="mr-1.5 h-4 w-4" />
                {c.readerBanned ? t.unban : t.ban}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
