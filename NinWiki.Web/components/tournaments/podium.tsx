'use client';

// Podio do torneio (aba "Podio"): 3 degraus no estilo classico (1o no centro, 2o a esquerda, 3o a direita; empate no 3o mostra os dois).
// Usa a `placement` das inscricoes (campeao 1, finalista 2, semifinalistas 3). Torneio nao encerrado = podio "por vir" esmaecido.
// A ordem no DOM e' 1o-2o-3o (leitores de tela); a ordem visual vem do `order` do CSS.

import Link from 'next/link';
import { Crown, Medal, Trophy } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import type { ApiEntry } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { cn } from '@/lib/utils';

/** Estilo de cada degrau: cor do cartao, do degrau e altura (mais alto = melhor colocado). */
const STEP = {
  1: { card: 'border-amber-500/60 bg-amber-500/10', block: 'h-24 from-amber-400 to-amber-600 text-white', icon: 'text-amber-600 dark:text-amber-400', order: 'order-2', delay: '[animation-delay:300ms]' },
  2: { card: 'border-slate-400/60 bg-slate-400/10', block: 'h-16 from-slate-300 to-slate-500 text-white', icon: 'text-slate-500 dark:text-slate-300', order: 'order-1', delay: '[animation-delay:150ms]' },
  3: { card: 'border-orange-700/50 bg-orange-700/10', block: 'h-11 from-orange-500 to-orange-800 text-white', icon: 'text-orange-700 dark:text-orange-400', order: 'order-3', delay: '[animation-delay:0ms]' },
} as const;

/** Avatar redondo (ou inicial do nome; "?" quando o lugar ainda esta' vazio). */
function Avatar({ entry, size }: { entry?: ApiEntry; size: string }) {
  if (entry?.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar externo do Discord
    return <img src={entry.avatarUrl} alt="" className={cn('shrink-0 rounded-full object-cover', size)} />;
  }
  return <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary', size)}>{entry ? entry.displayName.charAt(0).toUpperCase() : '?'}</span>;
}

/** Um degrau do podio com 0, 1 ou mais competidores (empate). */
function PodiumStep({ place, entries, detail, pending }: { place: 1 | 2 | 3; entries: ApiEntry[]; detail: (e: ApiEntry) => string; pending: boolean }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const s = STEP[place];
  const Icon = place === 1 ? Crown : Medal;
  const list: (ApiEntry | undefined)[] = entries.length ? entries : [undefined];
  return (
    <li aria-label={fill(d.place, { n: place })} className={cn('flex min-w-0 flex-col justify-end animate-in fade-in slide-in-from-bottom-6 duration-700 fill-mode-both motion-reduce:animate-none', s.order, s.delay)}>
      <div className="space-y-2">
        {list.map((e, i) => (
          <div key={e?.id ?? i} className={cn('flex flex-col items-center gap-1 rounded-xl border px-1.5 py-3 text-center shadow-sm sm:px-3', s.card, !e && 'border-dashed')}>
            <Icon className={cn('h-5 w-5 sm:h-6 sm:w-6', place === 1 && 'h-7 w-7 sm:h-8 sm:w-8', s.icon)} aria-hidden />
            <Avatar entry={e} size={place === 1 ? 'h-14 w-14 text-xl sm:h-16 sm:w-16' : 'h-10 w-10 text-base sm:h-12 sm:w-12'} />
            {e ? (
              e.readerId
                ? <Link href={`/players/${e.readerId}`} className="w-full break-words text-xs font-bold leading-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm">{e.displayName}</Link>
                : <span className="w-full break-words text-xs font-bold leading-tight sm:text-sm">{e.displayName}</span>
            ) : <span className="w-full text-xs text-muted-foreground">{pending ? '?' : d.podiumTbd}</span>}
            {e && detail(e) && <span className="w-full truncate text-[11px] text-muted-foreground sm:text-xs">{detail(e)}</span>}
            {entries.length > 1 && place === 3 && i === 0 && <span className="sr-only">{d.podiumThird}</span>}
          </div>
        ))}
      </div>
      {/* degrau */}
      <div aria-hidden className={cn('mt-2 flex items-start justify-center rounded-t-lg bg-gradient-to-b pt-2 text-2xl font-black shadow-inner', s.block)}>{place}</div>
    </li>
  );
}

/** Podio completo. `finished` = torneio encerrado (senao mostra a versao esmaecida com a mensagem "por vir"). */
export function Podium({ entries, finished, detail }: { entries: ApiEntry[]; finished: boolean; detail: (e: ApiEntry) => string }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const at = (n: number) => (finished ? entries.filter((e) => e.placement === n) : []);
  return (
    <section aria-label={d.podiumLabel} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      {!finished && <p className="mb-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Trophy className="h-4 w-4 shrink-0" aria-hidden />{d.podiumPending}</p>}
      <ol className={cn('mx-auto grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-4', !finished && 'opacity-40 grayscale')}>
        <PodiumStep place={1} entries={at(1)} detail={detail} pending={!finished} />
        <PodiumStep place={2} entries={at(2)} detail={detail} pending={!finished} />
        <PodiumStep place={3} entries={at(3)} detail={detail} pending={!finished} />
      </ol>
    </section>
  );
}
