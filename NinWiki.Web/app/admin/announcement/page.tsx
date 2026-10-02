'use client';

// Anuncio da pagina inicial (rota /admin/announcement): a mensagem que aparece no topo da Home. Vazio = a Home fica sem nada.
// A seguranca esta' na API (PUT/DELETE /announcement exigem announcement.manage; link so' https:// ou caminho do site).

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Megaphone, Trash2 } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { AnnouncementBanner } from '@/components/wiki/announcement-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ApiError, clearAnnouncement, getAnnouncement, saveAnnouncement,
  type AnnouncementLevel, type ApiAnnouncement,
} from '@/lib/api-client';

const LEVELS: AnnouncementLevel[] = ['info', 'success', 'warning', 'event'];

/** Tela do anuncio da Home: editar mensagem, link e estilo; ver a previa; publicar ou remover. */
export default function AnnouncementAdminPage() {
  const { dict } = useLanguage();
  const t = dict.admin.announcementPage;
  const [current, setCurrent] = useState<ApiAnnouncement | null>(null);
  const [message, setMessage] = useState('');
  const [messagePt, setMessagePt] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [level, setLevel] = useState<AnnouncementLevel>('info');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Copia o anuncio recebido da API para os campos do formulario. */
  function fill(a: ApiAnnouncement) {
    setCurrent(a);
    setMessage(a.message);
    setMessagePt(a.messagePt ?? '');
    setLinkUrl(a.linkUrl);
    setLinkLabel(a.linkLabel);
    setLevel(a.level);
  }

  useEffect(() => {
    document.title = `${t.title} - Admin · Nin Online Wiki`;
    getAnnouncement().then(fill).catch(() => setError(t.loadError));
  }, [t.title, t.loadError]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      fill(await saveAnnouncement({ message, messagePt: messagePt.trim() || null, linkUrl, linkLabel, level }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t.confirmClear)) return;
    setBusy(true);
    setError(null);
    try {
      fill(await clearAnnouncement());
      setSaved(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setBusy(false);
    }
  }

  if (!current && !error) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;

  const preview: ApiAnnouncement | null = message.trim()
    ? { active: true, message: message.trim(), messagePt: messagePt.trim() || null, linkUrl, linkLabel, level, updatedAt: 'preview', updatedBy: null }
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Megaphone className="h-6 w-6 text-primary" />{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {current?.active ? (current.updatedBy ? t.updatedBy.replace('{name}', current.updatedBy) : '') : t.none}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-1">
          <label className="text-sm font-semibold">{t.message}</label>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600} rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t.messageHint}</span><span>{t.counter.replace('{n}', String(message.length))}</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">{t.messagePt}</label>
          <textarea
            value={messagePt} onChange={(e) => setMessagePt(e.target.value)} maxLength={600} rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">{t.messagePtHint}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-1">
            <label className="text-sm font-semibold">{t.link}</label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} maxLength={300} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">{t.linkHint}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold">{t.linkLabel}</label>
            <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} maxLength={60} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold">{t.level}</label>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button
                key={l} type="button" onClick={() => setLevel(l)}
                className={`rounded-md border px-3 py-1.5 text-sm ${level === l ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-card-foreground'}`}
              >
                {t.levels[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? t.saving : t.save}
          </Button>
          {current?.active && (
            <Button type="button" variant="outline" disabled={busy} onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" />{t.clear}
            </Button>
          )}
          {saved && <span className="flex items-center gap-1 text-sm text-emerald-400"><Check className="h-4 w-4" />{t.saved}</span>}
        </div>
      </form>

      {preview && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.preview}</p>
          <AnnouncementBanner key={`${preview.message}${preview.level}`} announcement={preview} />
        </div>
      )}
    </div>
  );
}
