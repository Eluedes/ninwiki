'use client';

// Servidores do bot (painel; exige discord.links): so' LEITURA. Para cada servidor onde o bot esta' mostra o nome, o ID, a quantidade de membros
// e os cargos com os IDs (copiaveis) e, abrindo "Membros", a lista paginada de membros (nome, ID copiavel, cargos). Os dados vem do que o proprio bot informa a API (/bot/guilds-sync); nada aqui altera o bot.

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, listDiscordGuildMembers, listDiscordLinks, type ApiDiscordGuild, type ApiDiscordMembersPage } from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';

/** Botao que copia um ID para a area de transferencia (e mostra "Copiado" por 1,5 s). */
function CopyId({ value }: { value: string }) {
  const { dict } = useLanguage();
  const d = dict.discord;
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // sem permissao de area de transferencia: o ID continua visivel para copiar na mao
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={`${d.copyId}: ${value}`} title={d.copyId} className="inline-flex items-center gap-1 rounded px-1 text-xs text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      <span className="sr-only">{done ? d.copied : d.copyId}</span>
    </button>
  );
}

const PAGE_SIZE = 50;

/** Lista paginada dos membros de UM servidor (so' carrega ao abrir): busca por nome ou ID, ID copiavel, etiqueta Bot e cargos por nome. */
function MembersList({ guild }: { guild: ApiDiscordGuild }) {
  const { dict, locale } = useLanguage();
  const d = dict.discord;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{ key: string; page: ApiDiscordMembersPage } | null>(null);
  const [error, setError] = useState(false);
  const key = `${q}|${offset}`;
  const roleNames = useMemo(() => new Map(guild.roles.map((r) => [r.roleId, r.name])), [guild.roles]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // pequena espera para nao buscar a cada tecla
    const timer = setTimeout(() => {
      listDiscordGuildMembers(guild.guildId, { q: q.trim(), limit: PAGE_SIZE, offset })
        .then((page) => { if (alive) { setResult({ key, page }); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [open, guild.guildId, q, offset, key]);

  const page = result?.page ?? null;
  const loading = open && !error && result?.key !== key;
  const synced = page?.syncedAt ?? guild.membersSyncedAt;
  const partial = page?.partial ?? guild.membersPartial;

  return (
    <details className="rounded-lg border border-border" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">{fill(d.membersTitle, { n: guild.membersStored.toLocaleString() })}</summary>
      <div className="space-y-2 p-3">
        {!synced ? <p role="status" className="text-sm text-amber-500">{d.membersNotSynced}</p> : (
          <p className="text-xs text-muted-foreground">{fill(d.membersSyncedAt, { date: new Date(synced).toLocaleString(locale === 'pt' ? 'pt-BR' : 'en-US') })}</p>
        )}
        {partial && <p role="status" className="text-sm text-amber-500">{fill(d.membersPartial, { n: guild.membersStored.toLocaleString() })}</p>}
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder={d.memberSearch} aria-label={d.memberSearch} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
        {error && <p role="alert" className="text-sm text-destructive">{d.membersLoadError}</p>}
        <div className="max-h-96 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">{d.memberColumn}</th><th className="px-3 py-2">{d.memberIdColumn}</th><th className="px-3 py-2">{d.memberRolesColumn}</th></tr>
            </thead>
            <tbody>
              {page?.items.map((m) => (
                <tr key={m.discordId} className="border-t border-border align-top">
                  <td className="px-3 py-1.5">
                    <span className="font-medium">{m.displayName || m.username}</span>
                    {m.isBot && <span className="ml-1 rounded border border-primary/50 px-1 text-[10px] uppercase text-primary">{d.botTag}</span>}
                    {m.displayName && m.username && m.displayName !== m.username && <div className="text-xs text-muted-foreground">{m.username}</div>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5"><span className="font-mono">{m.discordId}</span> <CopyId value={m.discordId} /></td>
                  <td className="px-3 py-1.5 text-xs">{m.roles.length === 0 ? <span className="text-muted-foreground">{d.membersNoRoles}</span> : m.roles.map((id) => roleNames.get(id) ?? id).join(', ')}</td>
                </tr>
              ))}
              {page && page.items.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">{d.noMemberMatch}</td></tr>}
            </tbody>
          </table>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label={d.loading} />}
        {page && page.total > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{fill(d.membersPageInfo, { from: offset + 1, to: Math.min(offset + PAGE_SIZE, page.total), total: page.total.toLocaleString() })}</span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{d.prevPage}</Button>
              <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= page.total} onClick={() => setOffset(offset + PAGE_SIZE)}>{d.nextPage}</Button>
            </span>
          </div>
        )}
      </div>
    </details>
  );
}

/** Cartao de UM servidor: nome, ID, membros e a lista de cargos (com filtro). */
function GuildInfo({ guild }: { guild: ApiDiscordGuild }) {
  const { dict } = useLanguage();
  const d = dict.discord;
  const [filter, setFilter] = useState('');
  const roles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? guild.roles.filter((r) => r.name.toLowerCase().includes(q) || r.roleId.includes(q)) : guild.roles;
  }, [guild.roles, filter]);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={guild.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{guild.name}</h2>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${guild.active ? 'border-emerald-500/50 text-emerald-500' : 'border-amber-500/50 text-amber-500'}`}>
          {guild.active ? d.activeBadge : d.inactiveBadge}
        </span>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-1"><dt className="text-muted-foreground">{d.serverId}:</dt><dd className="font-mono">{guild.guildId}</dd><CopyId value={guild.guildId} /></div>
        <div><dd>{guild.memberCount > 0 ? fill(d.membersCount, { n: guild.memberCount.toLocaleString() }) : <span className="text-muted-foreground">{d.membersUnknown}</span>}</dd></div>
      </dl>
      <MembersList guild={guild} />
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">{fill(d.rolesTitle, { n: guild.roles.length })}</summary>
        <div className="space-y-2 p-3">
          {guild.roles.length === 0 ? <p className="text-sm text-muted-foreground">{d.noRoles}</p> : (
            <>
              <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={d.filterRoles} aria-label={d.filterRoles} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
              <div className="max-h-96 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2">{d.roleColumn}</th><th className="px-3 py-2">{d.roleIdColumn}</th></tr>
                  </thead>
                  <tbody>
                    {roles.map((r) => (
                      <tr key={r.roleId} className="border-t border-border">
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5"><span className="font-mono">{r.roleId}</span> <CopyId value={r.roleId} /></td>
                      </tr>
                    ))}
                    {roles.length === 0 && <tr><td colSpan={2} className="px-3 py-3 text-muted-foreground">{d.noRoleMatch}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </details>
    </section>
  );
}

/** Pagina /admin/bot. */
export default function BotServersPage() {
  const { dict } = useLanguage();
  const d = dict.discord;
  const [guilds, setGuilds] = useState<ApiDiscordGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    listDiscordLinks()
      .then((g) => { if (alive) { setGuilds(g); setError(null); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e instanceof ApiError ? e.message : d.adminLoadError); setLoading(false); } });
    return () => { alive = false; };
  }, [tick, d.adminLoadError]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl"><h1 className="text-2xl font-bold">{d.botTitle}</h1><p className="text-sm text-muted-foreground">{d.botSubtitle}</p></div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); setTick((n) => n + 1); }}><RefreshCw className="mr-1 h-4 w-4" />{d.adminRefresh}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label={d.loading} /> : guilds.length === 0 ? <p className="text-muted-foreground">{d.botEmpty}</p> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {guilds.map((g) => <GuildInfo key={g.guildId} guild={g} />)}
        </div>
      )}
    </div>
  );
}
