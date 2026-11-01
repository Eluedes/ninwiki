'use client';

// Painel do ORGANIZADOR (so' aparece para quem criou o torneio): detalhes e estado, inscritos, fases (com o montador de chaves) e
// encerramento. Toda acao chama a API, que devolve o torneio inteiro atualizado (onChange). A API e' quem nega de verdade; aqui e' so' conforto.

import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Shuffle, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ApiError, addGuestEntry, createPhase, deletePhase, deleteTournament, phaseAction, removeEntry, reorderEntries, startPhase, tournamentAction, updateTournament,
  type ApiPhase, type ApiTournament, type PhaseFormat,
} from '@/lib/api-client';
import { fill } from '@/lib/i18n-tournaments';
import { phaseSchema, tournamentSchema } from '@/lib/validation';
import { ImportEntriesDialog } from './import-entries-dialog';
import { Section, selectClass, teamModeLabel } from './shared';

/** Executa uma acao do organizador mostrando "ocupado" e o erro da API (se houver). */
function useRunner(onChange: (t: ApiTournament) => void) {
  const { dict } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<ApiTournament | void>, then?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res) onChange(res);
      then?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : dict.tournaments.actionError);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

/** Converte "2026-11-01T20:00" (datetime-local) em ISO, ou o inverso para preencher o campo. */
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

/** Detalhes (nome, descricao, data, visibilidade) e o estado do torneio. */
function Details({ t, run, busy }: { t: ApiTournament; run: ReturnType<typeof useRunner>['run']; busy: boolean }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description);
  const [startsAt, setStartsAt] = useState(toLocalInput(t.startsAt));
  const [visibility, setVisibility] = useState(t.visibility);
  const [invalid, setInvalid] = useState<string | null>(null);
  const errText = (k: string) => (k === 'required' ? d.errRequired : k === 'tooShort' ? d.errTooShort : d.errTooLong);
  function save() {
    const parsed = tournamentSchema.safeParse({ name, description, startsAt, visibility });
    if (!parsed.success) { setInvalid(errText(parsed.error.issues[0].message)); return; }
    setInvalid(null);
    run(() => updateTournament(t.id, { name: parsed.data.name, description, visibility, startsAt: toIso(startsAt), clearStartsAt: !startsAt }));
  }
  const locked = t.status === 'finished';
  return (
    <Section title={d.detailsTitle}>
      <div className="space-y-1.5">
        <label htmlFor="o-name" className="text-sm font-medium">{d.nameLabel}</label>
        <Input id="o-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="o-desc" className="text-sm font-medium">{d.descLabel}</label>
        <Textarea id="o-desc" rows={4} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="o-date" className="text-sm font-medium">{d.startsAtLabel}</label>
          <Input id="o-date" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="o-vis" className="text-sm font-medium">{d.visibilityLabel}</label>
          <select id="o-vis" className={selectClass} value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'unlisted')}>
            <option value="public">{d.visibilityPublic}</option>
            <option value="unlisted">{d.visibilityUnlisted}</option>
          </select>
        </div>
      </div>
      {invalid && <p className="text-xs font-medium text-destructive">{invalid}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={busy}>{busy ? d.saving : d.save}</Button>
        {!locked && t.status === 'draft' && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => updateTournament(t.id, { status: 'open' }))}>{d.openRegistration}</Button>}
        {!locked && t.status === 'open' && (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => updateTournament(t.id, { status: 'running' }))}>{d.closeRegistration}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => updateTournament(t.id, { status: 'draft' }))}>{d.backToDraft}</Button>
          </>
        )}
      </div>
    </Section>
  );
}

/** Interruptor "Visivel ao publico / Oculto": o organizador esconde o torneio enquanto ainda arruma fases e inscritos (a API grava na hora). */
function VisibilitySwitch({ t, run, busy }: { t: ApiTournament; run: ReturnType<typeof useRunner>['run']; busy: boolean }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const hidden = t.organizerHidden;
  return (
    <Section title={d.visibleLabel}>
      <div className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm ${hidden ? 'border-amber-500/40 bg-amber-500/10' : 'border-primary/30 bg-primary/5'}`}>
        {hidden ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
        <span className="flex-1 font-medium">{hidden ? d.visibleOff : d.visibleOn}</span>
        <Button size="sm" variant={hidden ? 'default' : 'outline'} disabled={busy} onClick={() => run(() => updateTournament(t.id, { organizerHidden: !hidden }))}>{hidden ? d.makeVisible : d.makeHidden}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{hidden ? d.hiddenByYouNotice : d.visibleHint}</p>
    </Section>
  );
}

/** Inscritos: convidado sem conta, importar lista, remover e ordem das sementes. */
function Entries({ t, run, busy }: { t: ApiTournament; run: ReturnType<typeof useRunner>['run']; busy: boolean }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const [guest, setGuest] = useState('');
  const [importing, setImporting] = useState(false);
  const editable = t.status === 'draft' || t.status === 'open';
  function move(i: number, delta: number) {
    const ids = t.entries.map((e) => e.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    run(() => reorderEntries(t.id, ids));
  }
  return (
    <Section title={fill(d.entriesTitle, { n: t.entries.length })}>
      {!editable && <p className="text-xs text-muted-foreground">{d.entriesLocked}</p>}
      {editable && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (guest.trim()) run(() => addGuestEntry(t.id, guest.trim()), () => setGuest('')); }}>
          <Input value={guest} maxLength={60} placeholder={d.guestPlaceholder} aria-label={d.addGuest} onChange={(e) => setGuest(e.target.value)} />
          <Button type="submit" size="sm" disabled={busy || !guest.trim()}><Plus className="mr-1 h-4 w-4" />{d.add}</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setImporting(true)}><Upload className="mr-1 h-4 w-4" />{d.importList}</Button>
        </form>
      )}
      {editable && <ImportEntriesDialog t={t} open={importing} onClose={() => setImporting(false)} onImported={(res) => run(async () => res)} />}
      <ol className="space-y-1">
        {t.entries.map((e, i) => (
          <li key={e.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
            <span className="w-6 text-right tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{e.displayName}{!e.readerId && <span className="ml-2 text-xs text-muted-foreground">({d.guest})</span>}{e.teamGroup != null && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{e.teamName ?? fill(d.teamN, { n: e.teamGroup })}</span>}</span>
            {editable && (
              <>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={d.moveUp} disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={d.moveDown} disabled={busy || i === t.entries.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={d.remove} disabled={busy} onClick={() => run(() => removeEntry(t.id, e.id))}><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}

type Draft = { name: string; entryIds: string[] };

/** Montador de chave de UMA fase: escolhe os competidores (equipes) a partir dos inscritos e gera a chave. */
function Builder({ t, phase, blocked, run, busy }: { t: ApiTournament; phase: ApiPhase; blocked: boolean; run: ReturnType<typeof useRunner>['run']; busy: boolean }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const size = phase.teamSize;
  const [teams, setTeams] = useState<Draft[]>([]);
  const empty = () => ({ name: '', entryIds: Array<string>(size).fill('') });
  const nameOf = (id: string) => t.entries.find((e) => e.id === id)?.displayName ?? '';
  /** Preenche com os sugeridos (vencedores da fase anterior; na primeira, todos). As EQUIPES vindas da importacao da lista que tem exatamente `size` integrantes
   *  ja' entram prontas (com o nome, se houver); o resto e' agrupado de `size` em `size`. */
  function suggest() {
    const all = phase.suggestedEntryIds && phase.suggestedEntryIds.length ? phase.suggestedEntryIds : t.entries.map((e) => e.id);
    const out: Draft[] = [];
    const taken = new Set<string>();
    if (size > 1) {
      const groups = new Map<number, string[]>();
      for (const id of all) {
        const g = t.entries.find((e) => e.id === id)?.teamGroup;
        if (g != null) groups.set(g, [...(groups.get(g) ?? []), id]);
      }
      for (const members of groups.values()) {
        if (members.length !== size) continue;
        out.push({ name: t.entries.find((e) => e.id === members[0])?.teamName ?? '', entryIds: members });
        members.forEach((m) => taken.add(m));
      }
    }
    const ids = all.filter((id) => !taken.has(id));
    for (let i = 0; i < ids.length; i += size) out.push({ name: '', entryIds: Array.from({ length: size }, (_, k) => ids[i + k] ?? '') });
    setTeams(out);
  }
  function shuffle() {
    const flat = teams.flatMap((x) => x.entryIds).filter(Boolean).sort(() => Math.random() - 0.5);
    setTeams(teams.map((x, i) => ({ ...x, entryIds: Array.from({ length: size }, (_, k) => flat[i * size + k] ?? '') })));
  }
  const used = teams.flatMap((x) => x.entryIds).filter(Boolean);
  const valid = teams.length >= 2 && teams.every((x) => x.entryIds.every(Boolean)) && new Set(used).size === used.length;
  const setMember = (ti: number, mi: number, v: string) => setTeams(teams.map((x, i) => (i === ti ? { ...x, entryIds: x.entryIds.map((e, k) => (k === mi ? v : e)) } : x)));
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <h4 className="text-sm font-semibold">{d.buildTitle}</h4>
      <p className="text-xs text-muted-foreground">{d.buildHint}</p>
      {blocked && <p className="text-xs font-medium text-amber-500">{d.previousFirst}</p>}
      <p className="text-xs text-muted-foreground">{d.suggestHint}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={suggest} disabled={busy || blocked}>{d.suggestFill}</Button>
        <Button size="sm" variant="outline" onClick={() => setTeams([...teams, empty()])} disabled={busy || blocked}><Plus className="mr-1 h-4 w-4" />{d.addTeam}</Button>
        <Button size="sm" variant="outline" onClick={shuffle} disabled={busy || blocked || teams.length < 2}><Shuffle className="mr-1 h-4 w-4" />{d.shuffle}</Button>
      </div>
      <ol className="space-y-2">
        {teams.map((tm, ti) => (
          <li key={ti} className="space-y-1.5 rounded-md border border-border p-2">
            <div className="flex items-center gap-2">
              <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{ti + 1}</span>
              {size > 1 && <Input value={tm.name} maxLength={60} placeholder={tm.entryIds.filter(Boolean).map(nameOf).join(' & ') || d.teamName} aria-label={d.teamName} onChange={(e) => setTeams(teams.map((x, i) => (i === ti ? { ...x, name: e.target.value } : x)))} />}
              <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" aria-label={d.removeFromList} onClick={() => setTeams(teams.filter((_, i) => i !== ti))}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {tm.entryIds.map((v, mi) => (
                <select key={mi} className={selectClass} value={v} aria-label={d.pickMember} onChange={(e) => setMember(ti, mi, e.target.value)}>
                  <option value="">{d.pickMember}</option>
                  {t.entries.map((e) => <option key={e.id} value={e.id} disabled={used.includes(e.id) && e.id !== v}>{e.displayName}</option>)}
                </select>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {teams.length > 0 && !valid && <p className="text-xs text-muted-foreground">{teams.length < 2 ? d.needTwo : fill(d.needMembers, { n: size })}</p>}
      <Button size="sm" disabled={busy || blocked || !valid} onClick={() => run(() => startPhase(t.id, phase.id, teams.map((x) => ({ name: x.name || undefined, entryIds: x.entryIds }))))}>{d.startPhase}</Button>
    </div>
  );
}

/** Fases: criar, apagar, montar a chave, desfazer, concluir e reabrir. */
function Phases({ t, run, busy }: { t: ApiTournament; run: ReturnType<typeof useRunner>['run']; busy: boolean }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'1' | '2' | '3' | 'custom'>('1');
  const [custom, setCustom] = useState(4);
  const [format, setFormat] = useState<PhaseFormat>('single_elimination');
  const [invalid, setInvalid] = useState<string | null>(null);
  const fmt = (f: PhaseFormat) => (f === 'round_robin' ? d.formatRoundRobin : d.formatSingle);
  function add() {
    const parsed = phaseSchema.safeParse({ name, teamSize: mode === 'custom' ? custom : Number(mode), format });
    if (!parsed.success) { setInvalid(parsed.error.issues[0].message === 'required' ? d.errRequired : d.errTooLong); return; }
    setInvalid(null);
    run(() => createPhase(t.id, parsed.data), () => setName(''));
  }
  const finished = t.status === 'finished';
  return (
    <Section title={d.phasesTitle}>
      <p className="text-xs text-muted-foreground">{d.phasesHint}</p>
      {t.phases.map((p, i) => {
        const blocked = t.phases.slice(0, i).some((o) => o.status !== 'finished');
        return (
          <div key={p.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{p.position}. {p.name}</h3>
              <span className="text-xs text-muted-foreground">{teamModeLabel(d, p.teamSize)} - {fmt(p.format)} - {p.status === 'setup' ? d.phaseSetup : p.status === 'running' ? d.phaseRunning : d.phaseFinished}</span>
              <div className="ml-auto flex flex-wrap gap-2">
                {p.status === 'setup' && <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => confirm(d.confirmDeletePhase) && run(() => deletePhase(t.id, p.id))}><Trash2 className="mr-1 h-4 w-4" />{d.deletePhase}</Button>}
                {p.status === 'running' && !finished && (
                  <>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => confirm(d.confirmReset) && run(() => phaseAction(t.id, p.id, 'reset'))}>{d.resetBracket}</Button>
                    <Button size="sm" disabled={busy} onClick={() => run(() => phaseAction(t.id, p.id, 'finish'))}>{d.finishPhase}</Button>
                  </>
                )}
                {p.status === 'finished' && !finished && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => phaseAction(t.id, p.id, 'reopen'))}>{d.reopenPhase}</Button>}
              </div>
            </div>
            {p.status === 'running' && <p className="text-xs text-muted-foreground">{d.resultHint} {d.correctionHint}</p>}
            {p.status === 'setup' && !finished && <Builder key={`${p.id}-${t.entries.length}`} t={t} phase={p} blocked={blocked} run={run} busy={busy} />}
          </div>
        );
      })}
      {!finished && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <h3 className="text-sm font-semibold">{d.newPhase}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="ph-name" className="text-xs font-medium">{d.phaseName}</label>
              <Input id="ph-name" value={name} maxLength={60} placeholder={d.phaseNamePlaceholder} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ph-mode" className="text-xs font-medium">{d.teamSizeLabel}</label>
              <select id="ph-mode" className={selectClass} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                <option value="1">1v1</option><option value="2">2v2</option><option value="3">3v3</option><option value="custom">{d.teamSizeCustom}</option>
              </select>
              {mode === 'custom' && <Input type="number" min={1} max={10} value={custom} aria-label={d.teamSizeCustom} onChange={(e) => setCustom(Number(e.target.value))} />}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ph-format" className="text-xs font-medium">{d.formatLabel}</label>
              <select id="ph-format" className={selectClass} value={format} onChange={(e) => setFormat(e.target.value as PhaseFormat)}>
                <option value="single_elimination">{d.formatSingle}</option><option value="round_robin">{d.formatRoundRobin}</option>
              </select>
            </div>
          </div>
          {invalid && <p className="text-xs font-medium text-destructive">{invalid}</p>}
          <Button size="sm" onClick={add} disabled={busy}><Plus className="mr-1 h-4 w-4" />{d.createPhase}</Button>
        </div>
      )}
    </Section>
  );
}

/** Painel completo do organizador. */
export function OrganizerPanel({ tournament: t, onChange, onDeleted }: { tournament: ApiTournament; onChange: (t: ApiTournament) => void; onDeleted: () => void }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const { busy, error, run } = useRunner(onChange);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{d.panelTitle}</h2>
        <p className="text-xs text-muted-foreground">{d.panelHint}</p>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />}
      <VisibilitySwitch t={t} run={run} busy={busy} />
      <Details t={t} run={run} busy={busy} />
      <Entries t={t} run={run} busy={busy} />
      <Phases t={t} run={run} busy={busy} />
      <Section>
        <div className="flex flex-wrap gap-2">
          {t.status === 'running' && <Button disabled={busy} onClick={() => confirm(d.confirmFinishTournament) && run(() => tournamentAction(t.id, 'finish'))}>{d.finishTournament}</Button>}
          {t.status === 'finished' && <Button variant="outline" disabled={busy} onClick={() => run(() => tournamentAction(t.id, 'reopen'))}>{d.reopenTournament}</Button>}
          <Button variant="destructive" disabled={busy} onClick={() => confirm(d.confirmDelete) && run(() => deleteTournament(t.id), onDeleted)}>{d.deleteTournament}</Button>
        </div>
      </Section>
    </div>
  );
}
