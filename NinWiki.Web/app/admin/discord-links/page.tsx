'use client';

// Ligacao Discord -> perfil (painel; exige discord.links): para cada servidor onde o bot esta', escolhe a VILA do servidor e, quando o nome do cargo
// nao e' igual ao do rank, o RANK de cada cargo. Quem decide vila/rank de cada jogador e' a API (app/core/discord_profile.py); o bot so' informa fatos.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ApiError, listDiscordLinks, listNinjaRanks, listVillages, saveDiscordLinks, type ApiDiscordGuild, type ApiNinjaRank, type ApiVillage,
} from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { localizedName } from '@/lib/localized';

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

/** Cartao de UM servidor: vila + tabela cargo -> rank, com o proprio botao Salvar. */
function GuildCard({ guild, villages, ranks, onSaved }: { guild: ApiDiscordGuild; villages: ApiVillage[]; ranks: ApiNinjaRank[]; onSaved: (g: ApiDiscordGuild) => void }) {
  const { dict, locale } = useLanguage();
  const d = dict.discord;
  const [villageId, setVillageId] = useState(guild.villageId ?? '');
  const [roleRanks, setRoleRanks] = useState<Record<string, string>>(() => Object.fromEntries(guild.roles.map((r) => [r.roleId, r.ninjaRankId ?? ''])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const saved = await saveDiscordLinks(guild.guildId, { villageId: villageId || null, roles: guild.roles.map((r) => ({ roleId: r.roleId, ninjaRankId: roleRanks[r.roleId] || null })) });
      onSaved(saved);
      setMsg({ ok: true, text: d.adminSaved });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : d.adminSaveError });
    } finally {
      setBusy(false);
    }
  }

  const sortedRanks = [...ranks].sort((a, b) => a.order - b.order);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={guild.name}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{guild.name}</h2>
        <span className="text-xs text-muted-foreground">{fill(d.readersCount, { n: guild.readers })}</span>
      </div>
      {!guild.active && <p className="text-sm text-amber-500">{d.inactive}</p>}
      <div className="max-w-xs space-y-1">
        <label htmlFor={`v-${guild.guildId}`} className="text-sm font-medium">{d.guildVillage}</label>
        <select id={`v-${guild.guildId}`} className={selectClass} value={villageId} onChange={(e) => setVillageId(e.target.value)}>
          <option value="">{d.noVillage}</option>
          {villages.map((v) => <option key={v.id} value={v.id}>{localizedName(locale, v.name, v.namePt)}</option>)}
        </select>
      </div>
      {guild.roles.length === 0 ? <p className="text-sm text-muted-foreground">{d.noRoles}</p> : (
        <div className="max-h-96 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">{d.roleColumn}</th><th className="px-3 py-2">{d.rankColumn}</th></tr>
            </thead>
            <tbody>
              {guild.roles.map((r) => (
                <tr key={r.roleId} className="border-t border-border">
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5">
                    <select aria-label={`${d.rankColumn}: ${r.name}`} className={selectClass} value={roleRanks[r.roleId] ?? ''} onChange={(e) => setRoleRanks({ ...roleRanks, [r.roleId]: e.target.value })}>
                      <option value="">{d.byName}</option>
                      {sortedRanks.map((k) => <option key={k.id} value={k.id}>{localizedName(locale, k.name, k.namePt)}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg && <p role="status" className={msg.ok ? 'text-sm font-medium text-emerald-500' : 'text-sm font-medium text-destructive'}>{msg.text}</p>}
      <Button onClick={save} disabled={busy}>{busy ? d.saving : d.save}</Button>
    </section>
  );
}

/** Pagina /admin/discord-links. */
export default function DiscordLinksPage() {
  const { dict } = useLanguage();
  const d = dict.discord;
  const [guilds, setGuilds] = useState<ApiDiscordGuild[]>([]);
  const [villages, setVillages] = useState<ApiVillage[]>([]);
  const [ranks, setRanks] = useState<ApiNinjaRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([listDiscordLinks(), listVillages(), listNinjaRanks()])
      .then(([g, v, r]) => { if (alive) { setGuilds(g); setVillages(v); setRanks(r); setError(null); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e instanceof ApiError ? e.message : d.adminLoadError); setLoading(false); } });
    return () => { alive = false; };
  }, [tick, d.adminLoadError]);

  const replace = useCallback((g: ApiDiscordGuild) => setGuilds((all) => all.map((x) => (x.guildId === g.guildId ? g : x))), []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl"><h1 className="text-2xl font-bold">{d.adminTitle}</h1><p className="text-sm text-muted-foreground">{d.adminSubtitle}</p></div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); setTick((n) => n + 1); }}><RefreshCw className="mr-1 h-4 w-4" />{d.adminRefresh}</Button>
      </div>
      <p className="max-w-2xl rounded-lg border border-border bg-muted/40 p-3 text-sm">{d.adminRules}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label={d.loading} /> : guilds.length === 0 ? <p className="text-muted-foreground">{d.adminEmpty}</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {guilds.map((g) => <GuildCard key={g.guildId} guild={g} villages={villages} ranks={ranks} onSaved={replace} />)}
        </div>
      )}
    </div>
  );
}
