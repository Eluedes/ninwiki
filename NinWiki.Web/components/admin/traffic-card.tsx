'use client';

// Cartao "Acessos ao site" da Visao Geral: grafico de visualizacoes/visitantes por dia, paises que
// mais acessam (bandeira + barra + %) e paginas mais vistas. Dado real de /analytics/summary
// (so' quem tem analytics.view). Contagem anonima - ver NinWiki.Api/app/api/analytics.py.

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Globe2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { getTrafficSummary, type ApiTrafficSummary } from '@/lib/api-client';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

const RANGES = [7, 30, 90] as const;

/** Codigo ISO de 2 letras -> emoji de bandeira (ex.: BR -> bandeira do Brasil). */
function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code) || code === 'ZZ') return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Nome do pais no idioma da interface (usa Intl, sem tabela propria). */
function countryName(code: string, locale: string, unknown: string): string {
  if (code === 'ZZ') return unknown;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Cartao de acessos (grafico + paises + paginas) da Visao Geral do painel. */
export function TrafficCard() {
  const { dict, locale } = useLanguage();
  const t = dict.admin.analytics;
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<ApiTrafficSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getTrafficSummary(days)
      .then((d) => { if (alive) { setData(d); setError(false); } })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [days]);

  const config = {
    views: { label: t.views, color: 'var(--primary)' },
    visitors: { label: t.visitors, color: 'var(--chart-2, #38bdf8)' },
  } satisfies ChartConfig;

  const empty = data !== null && data.totalViews === 0;
  const maxShare = Math.max(1, ...(data?.countries.map((c) => c.share) ?? [1]));

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Globe2 className="h-5 w-5 text-primary" />{t.title}</h2>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-colors', days === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {r} {t.days}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t.loadError}</p>
      ) : !data ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-3 flex gap-6">
              <div><p className="text-2xl font-bold tabular-nums">{data.totalViews.toLocaleString(locale)}</p><p className="text-xs text-muted-foreground">{t.views}</p></div>
              <div><p className="text-2xl font-bold tabular-nums">{data.totalVisitors.toLocaleString(locale)}</p><p className="text-xs text-muted-foreground">{t.visitors}</p></div>
            </div>
            {empty ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
                <p className="text-sm font-semibold">{t.noData}</p>
                <p className="text-xs text-muted-foreground">{t.noDataHint}</p>
              </div>
            ) : (
              <ChartContainer config={config} className="h-48 w-full">
                <AreaChart data={data.series} margin={{ left: 0, right: 8, top: 4 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.15} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={6} minTickGap={24}
                    tickFormatter={(v: string) => new Date(`${v}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })} />
                  <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="views" type="monotone" stroke="var(--color-views)" fill="var(--color-views)" fillOpacity={0.2} strokeWidth={2} />
                  <Area dataKey="visitors" type="monotone" stroke="var(--color-visitors)" fill="var(--color-visitors)" fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold">{t.countries}</h3>
              <div className="space-y-2">
                {data.countries.slice(0, 8).map((c) => (
                  <div key={c.code} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2"><span className="text-base leading-none">{flagOf(c.code)}</span><span className="truncate">{countryName(c.code, locale, t.unknown)}</span></span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{c.views.toLocaleString(locale)} · {Math.round(c.share)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${(c.share / maxShare) * 100}%` }} /></div>
                  </div>
                ))}
                {data.countries.length === 0 && <p className="text-xs text-muted-foreground">{t.noData}</p>}
              </div>
            </div>
            {data.pages.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t.pages}</h3>
                <div className="space-y-1">
                  {data.pages.slice(0, 5).map((p) => (
                    <div key={p.path} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-mono text-muted-foreground">{p.path}</span>
                      <span className="shrink-0 tabular-nums">{p.views.toLocaleString(locale)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground/70">{t.credit}</p>
    </div>
  );
}
