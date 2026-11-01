'use client';

// Dialogo "Importar lista" do painel do organizador: cola (ou arrasta um .txt/.csv para) a caixa, mostra a previa (quantos entram, quem fica de fora e
// por que) e so' envia os nomes aceitos. O arquivo e' lido no navegador; nada dele e' enviado alem dos nomes.

import { useMemo, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, importEntries, type ApiTournament } from '@/lib/api-client';
import { itemLabel, parseBulkNames, type BulkReason } from '@/lib/bulk-names';
import { fill } from '@/lib/i18n-tournaments';

const MAX_FILE_BYTES = 1_000_000;   // arquivo maior que 1 MB nao e' uma lista de nomes

/** Dialogo de importacao em lote. `onImported` recebe o torneio atualizado. */
export function ImportEntriesDialog({ t, open, onClose, onImported }: { t: ApiTournament; open: boolean; onClose: () => void; onImported: (t: ApiTournament) => void }) {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const [text, setText] = useState('');
  const [atStart, setAtStart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const parsed = useMemo(() => parseBulkNames(text, t.entries.map((e) => e.displayName)), [text, t.entries]);
  const reasonText: Record<BulkReason, string> = { duplicate: d.importDuplicate, too_long: d.importTooLong, invalid: d.importInvalid, full: d.importFull, team_too_big: d.importTeamTooBig };

  /** Le o arquivo solto na caixa (texto puro, no navegador) e junta ao que ja' foi digitado. */
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError(d.importFileTooBig); return; }
    setError(null);
    const content = await file.text();
    setText((cur) => (cur.trim() ? cur.replace(/\s+$/, '') + '\n' : '') + content);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await importEntries(t.id, parsed.accepted, atStart ? 'start' : 'end');
      onImported(res.tournament);
      setText('');
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : d.actionError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{d.importTitle}</DialogTitle>
          <DialogDescription>{d.importHint}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea rows={8} value={text} aria-label={d.importTitle} placeholder={d.importPlaceholder} onChange={(e) => setText(e.target.value)}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
            className={dragging ? 'border-primary ring-2 ring-primary/40' : undefined} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileUp className="h-3.5 w-3.5" aria-hidden />{d.importDropHint}</p>
          {text.trim() && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm" aria-live="polite">
              <p className="font-medium">{fill(d.importPreview, { n: parsed.players, teams: parsed.teams, skipped: parsed.skipped.length, empty: parsed.empty })}</p>
              {parsed.accepted.length > 0 && (
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs" aria-label={d.importPreviewList}>
                  {parsed.accepted.slice(0, 40).map((it, i) => (
                    <li key={i} className="truncate">
                      {it.members.length >= 2 ? <><span className="font-medium">{itemLabel(it)}</span>{it.name && <span className="text-muted-foreground"> — {it.members.join(' & ')}</span>}</> : <span>{it.members[0]}</span>}
                    </li>
                  ))}
                  {parsed.accepted.length > 40 && <li className="text-muted-foreground">…</li>}
                </ul>
              )}
              {parsed.skipped.length > 0 && (
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {parsed.skipped.map((s, i) => <li key={i}><span className="font-medium text-foreground">{s.name}</span>: {reasonText[s.reason]}</li>)}
                </ul>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={atStart} onChange={(e) => setAtStart(e.target.checked)} />{d.importAtStart}</label>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{d.cancel}</Button>
          <Button onClick={confirm} disabled={busy || parsed.players === 0}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}{fill(d.importConfirm, { n: parsed.players })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
