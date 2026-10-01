'use client';

// Curtidas e comentarios de um post (so' no site publico). O leitor entra com o Discord (sessao PROPRIA, separada da
// equipe: ela so' prova quem e' e nao da' acesso ao painel). Visitante sem login ve' tudo, mas para curtir/comentar
// precisa entrar. Comentarios sao TEXTO SIMPLES: o React escapa tudo, nunca interpreta HTML.

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Heart, Loader2, LogOut, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ApiError, addComment, deleteOwnComment, getEngagement, getReaderMe, listComments, readerLoginUrl, readerLogout, setLike,
  type ApiComment, type ApiEngagement, type ApiReader,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const MAX_CHARS = 1000;

/** Botao "Entrar com o Discord": leva ao login de leitor e volta para esta mesma pagina. */
function LoginButton({ label }: { label: string }) {
  const pathname = usePathname();
  return (
    <Button asChild size="sm">
      <a href={readerLoginUrl(pathname)}>{label}</a>
    </Button>
  );
}

/** Curtir + comentarios do post `slug`. */
export function PostEngagement({ slug }: { slug: string }) {
  const { dict, locale } = useLanguage();
  const t = dict.blogx.public;
  const search = useSearchParams();
  const [reader, setReader] = useState<ApiReader | null>(null);
  const [engagement, setEngagement] = useState<ApiEngagement | null>(null);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [liking, setLiking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Erro vindo da volta do login com o Discord (?loginError=banned|rate_limited|...)
  const loginError = search.get('loginError');
  const loginErrorText = loginError === 'banned' ? t.errBanned : loginError === 'rate_limited' ? t.errRateLimited : loginError ? t.errGeneric : null;

  /** Carrega leitor, contagens e comentarios (cada um falha sozinho, sem derrubar o resto da pagina). */
  const load = useCallback(async () => {
    const [me, eng, list] = await Promise.allSettled([getReaderMe(), getEngagement(slug), listComments(slug)]);
    setReader(me.status === 'fulfilled' ? me.value : null);
    if (eng.status === 'fulfilled') setEngagement(eng.value);
    if (list.status === 'fulfilled') setComments(list.value);
    else setError(t.loadCommentsError);
  }, [slug, t.loadCommentsError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de dados externos (API)
    load();
  }, [load]);

  /** Curte ou descurte (precisa estar logado). */
  async function toggleLike() {
    if (!reader || !engagement || liking) return;
    setLiking(true);
    setError(null);
    try {
      setEngagement(await setLike(slug, !engagement.likedByMe));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.likeError);
    } finally {
      setLiking(false);
    }
  }

  /** Envia o comentario e o coloca no fim da lista. */
  async function submit() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await addComment(slug, text);
      setComments((prev) => [...prev, created]);
      setEngagement((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.commentError);
    } finally {
      setSending(false);
    }
  }

  /** Apaga o proprio comentario. */
  async function remove(id: string) {
    if (!window.confirm(t.confirmDeleteComment)) return;
    try {
      await deleteOwnComment(slug, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setEngagement((prev) => (prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.commentError);
    }
  }

  /** Sai da conta de leitor e recarrega o estado. */
  async function logout() {
    await readerLogout().catch(() => undefined);
    setReader(null);
    load();
  }

  return (
    <section className="mt-10 space-y-6 border-t border-border pt-6" aria-label={t.comments}>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={engagement?.likedByMe ? 'default' : 'outline'}
          size="sm"
          disabled={liking || !engagement}
          aria-pressed={engagement?.likedByMe ?? false}
          title={reader ? (engagement?.likedByMe ? t.unlike : t.like) : t.loginToLike}
          onClick={reader ? toggleLike : () => setError(t.loginToLike)}
        >
          <Heart className={cn('mr-1.5 h-4 w-4', engagement?.likedByMe && 'fill-current')} />
          {engagement?.likeCount ?? 0} {t.likes}
        </Button>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          {engagement?.commentCount ?? 0} {t.comments.toLowerCase()}
        </span>
        {reader && (
          <button type="button" onClick={logout} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <LogOut className="h-3 w-3" /> {t.logout}
          </button>
        )}
      </div>

      {loginErrorText && <p className="text-sm text-destructive">{loginErrorText}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <h2 className="mb-3 text-lg font-bold tracking-tight">{t.comments}</h2>
        {reader ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t.signedInAs} <strong>{reader.username}</strong></p>
            <Textarea
              rows={3}
              value={text}
              maxLength={MAX_CHARS}
              placeholder={t.commentPlaceholder}
              aria-label={t.writeComment}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{MAX_CHARS - text.length} {t.charsLeft} · {t.commentsRules}</span>
              <Button type="button" size="sm" disabled={sending || !text.trim()} onClick={submit}>
                {sending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {sending ? t.sending : t.send}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            <p className="text-sm text-muted-foreground">{t.loginToComment}</p>
            <LoginButton label={t.loginDiscord} />
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noComments}</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              {c.author.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.author.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border" />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded-full border border-border bg-secondary" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-card-foreground">{c.author.username}</span>
                  <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US')}</time>
                  {c.mine && (
                    <button type="button" onClick={() => remove(c.id)} className="ml-auto inline-flex items-center gap-1 hover:text-destructive" title={t.deleteComment}>
                      <Trash2 className="h-3 w-3" /> {t.deleteComment}
                    </button>
                  )}
                </div>
                {/* Texto simples: o React escapa o conteudo (nunca HTML) */}
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-card-foreground">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
