'use client';

// Pecas compartilhadas das telas de torneio e perfil: leitor logado, botao "Entrar com o Discord", selo de status e estilos.
// O leitor entra com o Discord (sessao PROPRIA, separada da equipe: so' prova quem e'; ver components/blog/post-engagement.tsx).

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { getReaderMe, readerLoginUrl, type ApiReader, type TournamentStatus } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** Estilo do <select> nativo (mesma aparencia do Input). */
export const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

/** Cartao de secao (estilo dossie: borda, fundo de card). */
export function Section({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm', className)}>
      {title && <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h2>}
      {children}
    </section>
  );
}

/** Leitor logado (ou null) e se a consulta ja' terminou. */
export function useReader(): { reader: ApiReader | null; loaded: boolean } {
  const [state, setState] = useState<{ reader: ApiReader | null; loaded: boolean }>({ reader: null, loaded: false });
  useEffect(() => {
    let alive = true;
    getReaderMe()
      .then((reader) => alive && setState({ reader, loaded: true }))
      .catch(() => alive && setState({ reader: null, loaded: true }));
    return () => { alive = false; };
  }, []);
  return state;
}

/** Botao "Entrar com o Discord": faz o login de leitor e volta para esta mesma pagina. */
export function LoginButton({ label }: { label?: string }) {
  const { dict } = useLanguage();
  const pathname = usePathname();
  return (
    <Button asChild size="sm">
      <a href={readerLoginUrl(pathname)}>{label ?? dict.tournaments.signIn}</a>
    </Button>
  );
}

const STATUS_STYLE: Record<TournamentStatus, string> = {
  draft: 'border-muted-foreground/40 bg-muted text-muted-foreground',
  open: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500',
  running: 'border-amber-500/40 bg-amber-500/10 text-amber-500',
  finished: 'border-sky-500/40 bg-sky-500/10 text-sky-500',
};

/** Selo colorido do estado do torneio. */
export function StatusBadge({ status }: { status: TournamentStatus }) {
  const { dict } = useLanguage();
  const t = dict.tournaments;
  const label = { draft: t.statusDraft, open: t.statusOpen, running: t.statusRunning, finished: t.statusFinished }[status];
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[status])}>{label}</span>;
}

/** Texto do modo de equipe: 1v1, 2v2, 3v3 ou "Personalizado 5v5". */
export function teamModeLabel(t: { teamMode: string; teamModeCustom: string }, size: number): string {
  const text = size <= 3 ? t.teamMode : t.teamModeCustom;
  return text.replace(/\{n\}/g, String(size));
}
