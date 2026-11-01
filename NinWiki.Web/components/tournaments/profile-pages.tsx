'use client';

// Perfil do jogador: pagina publica (/players/[id]) e "meu perfil" (/profile, editavel so' pelo dono, que entra com o Discord).
// So' mostra dados publicos (nome no jogo, vila, rank, avatar/nome do Discord, historico de torneios); nunca o Discord ID.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Trophy, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ApiError, getMyProfile, getPlayer, listNinjaRanks, listVillages, updateMyProfile, type ApiHistoryItem, type ApiNinjaRank, type ApiPlayerProfile, type ApiVillage,
} from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { localizedName } from '@/lib/localized';
import { profileSchema } from '@/lib/validation';
import { formatDate } from '@/lib/utils';
import { LoginButton, Section, StatusBadge, selectClass, useReader } from './shared';

/** Texto do resultado de uma participacao (campeao, "3o lugar" ou "participou"). */
function resultLabel(d: ReturnType<typeof useLanguage>['dict']['tournaments'], h: ApiHistoryItem): string {
  return h.placement === 1 ? d.resultChampion : h.placement ? fill(d.resultPlace, { n: h.placement }) : d.resultPlayed;
}

/** Cartao do perfil: avatar, nomes, vila/rank, totais, trofeus e historico. */
function ProfileView({ p }: { p: ApiPlayerProfile }) {
  const { dict, locale } = useLanguage();
  const d = dict.tournaments;
  const stats: [string, number][] = [[d.statTournaments, p.stats.tournaments], [d.statWins, p.stats.wins], [d.statLosses, p.stats.losses], [d.statTitles, p.stats.titles]];
  return (
    <div className="space-y-5">
      <Section>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar externo do Discord */}
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-16 w-16 rounded-full" /> : <UserRound className="h-16 w-16 text-muted-foreground" aria-hidden />}
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{p.gameName || p.username}</h2>
            <p className="text-sm text-muted-foreground">{d.discordName}: {p.username}</p>
            <p className="text-sm text-muted-foreground">
              {[p.village && localizedName(locale, p.village.name, p.village.namePt), p.ninjaRank && localizedName(locale, p.ninjaRank.name, p.ninjaRank.namePt)].filter(Boolean).join(' - ')}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border p-3 text-center"><dd className="text-2xl font-bold tabular-nums">{value}</dd><dt className="text-xs uppercase text-muted-foreground">{label}</dt></div>
          ))}
        </dl>
      </Section>
      {p.trophies.length > 0 && (
        <Section title={d.trophiesTitle}>
          <ul className="flex flex-wrap gap-2">
            {p.trophies.map((h) => <li key={h.tournamentId}><Link href={`/tournaments/${h.tournamentId}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-500 hover:underline"><Trophy className="h-4 w-4" aria-hidden />{h.name}</Link></li>)}
          </ul>
        </Section>
      )}
      <Section title={d.historyTitle}>
        {p.history.length === 0 ? <p className="text-sm text-muted-foreground">{d.noHistory}</p> : (
          <ul className="space-y-2">
            {p.history.map((h) => (
              <li key={h.tournamentId} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Link href={`/tournaments/${h.tournamentId}`} className="font-medium hover:underline">{h.name}</Link>
                <StatusBadge status={h.status} />
                <span className="text-muted-foreground">{resultLabel(d, h)} - {fill(d.wl, { w: h.wins, l: h.losses })}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(h.date, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** Pagina publica /players/[id]. */
export function PlayerPageClient({ id }: { id: string }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const [p, setP] = useState<ApiPlayerProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading');
  useEffect(() => {
    let alive = true;
    getPlayer(id).then((res) => { if (alive) { setP(res); setState('ok'); } }).catch(() => alive && setState('notfound'));
    return () => { alive = false; };
  }, [id]);
  if (state === 'loading') return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="loading" /></div>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={p ? (p.gameName || p.username) : d.playerNotFound} breadcrumbs={[{ label: d.title, href: '/tournaments' }, { label: p ? (p.gameName || p.username) : '-' }]} />
      {p ? <ProfileView p={p} /> : <p className="text-muted-foreground">{d.playerNotFound}</p>}
    </div>
  );
}

/** Pagina /profile: edita o proprio perfil (nome no jogo, vila, rank) e mostra como os outros veem. */
export function MyProfileClient() {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const { locale } = useLanguage();
  const { reader, loaded } = useReader();
  const [p, setP] = useState<ApiPlayerProfile | null>(null);
  const [villages, setVillages] = useState<ApiVillage[]>([]);
  const [ranks, setRanks] = useState<ApiNinjaRank[]>([]);
  const [form, setForm] = useState({ gameName: '', villageId: '', ninjaRankId: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reader) return;
    let alive = true;
    Promise.all([getMyProfile(), listVillages().catch(() => []), listNinjaRanks().catch(() => [])]).then(([me, v, r]) => {
      if (!alive) return;
      setP(me); setVillages(v); setRanks(r);
      setForm({ gameName: me.gameName ?? '', villageId: me.village?.id ?? '', ninjaRankId: me.ninjaRank?.id ?? '' });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [reader]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) { setMsg({ ok: false, text: d.errTooLong }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const res = await updateMyProfile({ gameName: parsed.data.gameName || null, villageId: parsed.data.villageId || null, ninjaRankId: parsed.data.ninjaRankId || null });
      setP(res);
      setMsg({ ok: true, text: d.saved });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : d.saveError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={d.profileTitle} subtitle={d.profileSubtitle} breadcrumbs={[{ label: d.title, href: '/tournaments' }, { label: d.profileTitle }]} />
      {loaded && !reader ? (
        <Section><p className="text-sm text-muted-foreground">{d.signInProfile}</p><LoginButton /></Section>
      ) : (
        <div className="space-y-5">
          <form onSubmit={save} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="space-y-1.5">
              <label htmlFor="p-name" className="text-sm font-medium">{d.gameNameLabel}</label>
              <Input id="p-name" maxLength={40} value={form.gameName} placeholder={d.gameNamePlaceholder} onChange={(e) => setForm({ ...form, gameName: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="p-village" className="text-sm font-medium">{d.villageLabel}</label>
                <select id="p-village" className={selectClass} value={form.villageId} onChange={(e) => setForm({ ...form, villageId: e.target.value })}>
                  <option value="">{d.noneOption}</option>
                  {villages.map((v) => <option key={v.id} value={v.id}>{localizedName(locale, v.name, v.namePt)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="p-rank" className="text-sm font-medium">{d.rankLabel}</label>
                <select id="p-rank" className={selectClass} value={form.ninjaRankId} onChange={(e) => setForm({ ...form, ninjaRankId: e.target.value })}>
                  <option value="">{d.noneOption}</option>
                  {[...ranks].sort((a, b) => a.order - b.order).map((r) => <option key={r.id} value={r.id}>{localizedName(locale, r.name, r.namePt)}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{d.privacyNote}</p>
            {msg && <p role="status" className={msg.ok ? 'text-sm font-medium text-emerald-500' : 'text-sm font-medium text-destructive'}>{msg.text}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !p}>{busy ? d.saving : d.save}</Button>
              {p && <Button asChild variant="outline"><Link href={`/players/${p.id}`}>{d.viewPublic}</Link></Button>}
            </div>
          </form>
          {p ? <ProfileView p={p} /> : reader && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-label="loading" />}
        </div>
      )}
    </div>
  );
}
