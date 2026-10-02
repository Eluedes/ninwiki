'use client';

// Anuncio da Home (editado em /admin/announcement). Sem mensagem: nao desenha nada. O visitante pode fechar; se o texto mudar, volta a aparecer.

import { useState, useSyncExternalStore } from 'react';
import { Megaphone, PartyPopper, AlertTriangle, CalendarDays, Info, X } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiAnnouncement, AnnouncementLevel } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const STYLE: Record<AnnouncementLevel, { box: string; icon: typeof Info }> = {
  info: { box: 'border-sky-500/40 bg-sky-500/10 text-sky-100', icon: Megaphone },
  success: { box: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100', icon: PartyPopper },
  warning: { box: 'border-amber-500/50 bg-amber-500/10 text-amber-100', icon: AlertTriangle },
  event: { box: 'border-violet-500/40 bg-violet-500/10 text-violet-100', icon: CalendarDays },
};
const DISMISS_KEY = 'ninwiki-announcement-dismissed';

/** Identificador curto do texto (muda quando o anuncio muda, para voltar a aparecer). */
function fingerprint(a: ApiAnnouncement): string {
  const text = `${a.message}|${a.linkUrl}|${a.updatedAt ?? ''}`;
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return String(h);
}

/** Le (com seguranca) qual anuncio o visitante ja' fechou neste navegador. */
function readDismissed(): string {
  try { return localStorage.getItem(DISMISS_KEY) ?? ''; } catch { return ''; }
}
const subscribe = (cb: () => void) => { window.addEventListener('storage', cb); return () => window.removeEventListener('storage', cb); };

/** Faixa de anuncio no topo da Home (nada se `announcement.active` for falso). */
export function AnnouncementBanner({ announcement }: { announcement: ApiAnnouncement | null }) {
  const { locale, dict } = useLanguage();
  const [closedNow, setClosedNow] = useState(false);
  const stored = useSyncExternalStore(subscribe, readDismissed, () => '');
  if (!announcement || !announcement.active || closedNow) return null;
  const print = fingerprint(announcement);
  if (stored === print) return null;

  const style = STYLE[announcement.level] ?? STYLE.info;
  const Icon = style.icon;
  const text = locale === 'pt' && announcement.messagePt ? announcement.messagePt : announcement.message;
  const href = announcement.linkUrl;
  const external = href.startsWith('https://');

  /** Fecha o anuncio e lembra (so' neste navegador) que este texto ja' foi visto. */
  function close() {
    setClosedNow(true);
    try { localStorage.setItem(DISMISS_KEY, print); } catch { /* sem storage: so' fecha agora */ }
  }

  return (
    <div role="status" className={cn('mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm', style.box)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed">
        {text}
        {href && (
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="ml-2 whitespace-nowrap font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {announcement.linkLabel || dict.announcement.learnMore} →
          </a>
        )}
      </p>
      <button type="button" onClick={close} aria-label={dict.announcement.dismiss} title={dict.announcement.dismiss} className="shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
