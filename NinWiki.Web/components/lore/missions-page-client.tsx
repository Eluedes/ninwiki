'use client';

// Lista de Missoes (rota /missions): busca por nome/NPC e filtros por regiao, tipo, rank, faixa de nivel e "so' repetiveis". O Server Component
// app/(wiki)/(lore)/missions/page.tsx entrega os cartoes ja' resumidos (lib/missions.ts le' o json); aqui e' so' a parte interativa e o idioma.

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollText, Search, Repeat, Swords } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import type { MissionArea, MissionType } from '@/lib/missions';

/** O que o cartao da lista mostra de cada missao. */
export interface MissionCard {
  id: string; name: string; level: number | null; rank: string | null; type: MissionType; areas: MissionArea[];
  npc: string | null; summary: string; exp: string | null; partial: boolean;
}

// Faixas de nivel do filtro: [rotulo, minimo, maximo]. Missao sem nivel so' aparece quando nenhuma faixa esta' marcada.
const LEVEL_BANDS: [string, number, number][] = [['1-19', 1, 19], ['20-39', 20, 39], ['40-59', 40, 59], ['60+', 60, 9999]];
const TYPES: MissionType[] = ['daily', 'repeatable', 'story', 'side'];
const AREAS: MissionArea[] = ['leaf', 'sand', 'mist', 'takumi', 'land-of-spirits', 'land-of-iron'];

/** Botao-chip de filtro (clicar de novo desliga). */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('rounded-full px-3 py-1.5 text-sm font-medium transition-colors', active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80')}
    >
      {children}
    </button>
  );
}

/** Pagina de lista das missoes. */
export function MissionsPageClient({ missions }: { missions: MissionCard[] }) {
  const { dict } = useLanguage();
  const t = dict.lore.missionsx;
  const [q, setQ] = useState('');
  const [type, setType] = useState<MissionType | null>(null);
  const [area, setArea] = useState<MissionArea | null>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [band, setBand] = useState<number | null>(null);
  const [repeatable, setRepeatable] = useState(false);

  const ranks = useMemo(() => [...new Set(missions.map((m) => m.rank).filter((r): r is string => !!r))].sort(), [missions]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return missions.filter((m) => {
      if (needle && !(m.name.toLowerCase().includes(needle) || (m.npc ?? '').toLowerCase().includes(needle))) return false;
      if (type && m.type !== type) return false;
      if (area && !m.areas.includes(area)) return false;
      if (rank && m.rank !== rank) return false;
      if (repeatable && m.type !== 'daily' && m.type !== 'repeatable') return false;
      if (band !== null) {
        const [, lo, hi] = LEVEL_BANDS[band];
        if (m.level === null || m.level < lo || m.level > hi) return false;
      }
      return true;
    });
  }, [missions, q, type, area, rank, band, repeatable]);

  const filtering = !!(q || type || area || rank || band !== null || repeatable);
  const clear = () => { setQ(''); setType(null); setArea(null); setRank(null); setBand(null); setRepeatable(false); };
  const label = 'mr-1 w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        breadcrumbs={[{ label: dict.lore.home, href: '/' }, { label: t.crumb }]}
        icon={<ScrollText className="h-7 w-7" />}
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="pl-9" aria-label={t.searchPlaceholder} />
      </div>

      {/* Filtros: um grupo por linha, com rotulo; no celular as linhas quebram sozinhas */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={label}>{t.filterType}</span>
          {TYPES.map((k) => <Chip key={k} active={type === k} onClick={() => setType(type === k ? null : k)}>{t.types[k]}</Chip>)}
          <Chip active={repeatable} onClick={() => setRepeatable(!repeatable)}>{t.repeatableOnly}</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={label}>{t.filterArea}</span>
          {AREAS.map((k) => <Chip key={k} active={area === k} onClick={() => setArea(area === k ? null : k)}>{t.areas[k]}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={label}>{t.filterLevel}</span>
          {LEVEL_BANDS.map(([text], i) => <Chip key={text} active={band === i} onClick={() => setBand(band === i ? null : i)}>{text}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={label}>{t.filterRank}</span>
          {ranks.map((r) => <Chip key={r} active={rank === r} onClick={() => setRank(rank === r ? null : r)}>{r}</Chip>)}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
        <span>{t.results.replace('{n}', String(shown.length))} · {t.sortLevel}</span>
        {filtering && <button type="button" onClick={clear} className="text-primary hover:underline">{t.clear}</button>}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Search className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">{t.noResults}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <Link key={m.id} href={`/missions/${m.id}`} className="group dossier-panel flex flex-col gap-2 p-4 transition-colors hover:border-primary/50">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {m.type === 'daily' || m.type === 'repeatable' ? <Repeat className="h-5 w-5" /> : <Swords className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold leading-snug text-ink-100 group-hover:text-primary">{m.name}</p>
                  {m.npc && <p className="truncate text-xs text-muted-foreground">{m.npc}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">{m.level !== null ? t.levelFmt.replace('{n}', String(m.level)) : t.levelUnknown}</span>
                {m.rank && <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">{t.rankFmt.replace('{r}', m.rank)}</span>}
                <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">{t.types[m.type]}</span>
                {m.exp && <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">{m.exp} {t.exp}</span>}
              </div>
              {m.summary && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{m.summary}</p>}
              {m.partial && <p className="mt-auto text-[11px] italic text-muted-foreground/70">{t.partial}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
