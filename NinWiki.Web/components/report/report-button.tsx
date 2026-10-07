'use client';

// Botao "Reportar" das paginas publicas (conteudo, jutsu e mastery): abre uma janelinha onde o visitante diz o que esta' errado
// (informacao desatualizada, erro de traducao ou outro) e descreve o problema. Nao exige login. O envio vai para POST /reports;
// a equipe trata em /admin/reports. O campo "website" e' uma ISCA anti-robo: fica escondido para pessoas e robos costumam preenche-lo.

import { useState } from 'react';
import { CheckCircle2, Flag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, submitReport, type ReportKind, type ReportTargetType } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const MAX_CHARS = 1000;
const MIN_CHARS = 10;
const KINDS: ReportKind[] = ['outdated', 'translation', 'other'];

/** Botao + janelinha de report para uma pagina (`targetId` = slug do conteudo, ou id do jutsu/mastery). */
export function ReportButton({ targetType, targetId, className }: { targetType: ReportTargetType; targetId: string; className?: string }) {
  const { dict, locale } = useLanguage();
  const t = dict.report;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind>('outdated');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');   // isca anti-robo (pessoas nunca veem nem preenchem)
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Reabrir a janela sempre comeca limpa (depois de enviar, o texto antigo nao fica la'). */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setKind('outdated');
      setMessage('');
      setSent(false);
      setError(null);
    }
  }

  /** Confere o tamanho minimo e envia; mostra o erro da API (limite de envios, etc.) se houver. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < MIN_CHARS) {
      setError(t.tooShort);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await submitReport({ targetType, targetId, kind, message: message.trim(), locale, website });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? err.message : t.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn('gap-1.5 text-muted-foreground hover:text-card-foreground', className)}>
          <Flag className="h-3.5 w-3.5" />
          {t.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <DialogTitle>{t.thanks}</DialogTitle>
            <Button type="button" onClick={() => setOpen(false)}>{t.close}</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t.title}</DialogTitle>
              <DialogDescription>{t.subtitle}</DialogDescription>
            </DialogHeader>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{t.kindLabel}</legend>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {t[k]}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="report-message" className="text-sm font-semibold">{t.messageLabel}</label>
              <Textarea
                id="report-message"
                rows={5}
                maxLength={MAX_CHARS}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setError(null); }}
                placeholder={t.placeholder}
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/{MAX_CHARS}</p>
            </div>

            {/* Isca anti-robo: fora da tela, sem foco e sem preenchimento automatico. */}
            <input
              type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden
              value={website} onChange={(e) => setWebsite(e.target.value)}
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />

            {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.cancel}</Button>
              <Button type="submit" disabled={sending}>
                {sending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {sending ? t.sending : t.send}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
