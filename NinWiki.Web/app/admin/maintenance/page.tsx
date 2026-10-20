'use client';

// Modo manutencao do site (SO' S.Adm - a API responde 404 para qualquer outro cargo e o menu nem mostra o item): liga/desliga a pagina de
// manutencao do site inteiro e define a mensagem (opcional, em ingles e portugues). Ligado, os visitantes veem a pagina de manutencao; a equipe
// entra no site depois do login (ver proxy.ts e components/wiki/maintenance-page-client.tsx). O painel (/admin) e o login ficam sempre abertos.

import { useEffect, useState } from 'react';
import { AlertTriangle, Construction, Loader2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, getSiteStatus, setMaintenance } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** Tela de ligar/desligar a manutencao. */
export default function MaintenanceAdminPage() {
  const { dict } = useLanguage();
  const t = dict.admin.maintenanceAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState('');
  const [messagePt, setMessagePt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSiteStatus()
      .then((s) => {
        if (cancelled) return;
        setOn(s.maintenance);
        setMessage(s.message ?? '');
        setMessagePt(s.messagePt ?? '');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t.loadError]);

  /** Liga ou desliga (com confirmacao) e grava as mensagens junto. */
  async function toggle() {
    const next = !on;
    if (!window.confirm(next ? t.confirmEnable : t.confirmDisable)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const s = await setMaintenance({ enabled: next, message, messagePt: messagePt.trim() || null });
      setOn(s.maintenance);
      setNotice(s.maintenance ? t.savedOn : t.savedOff);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t.loading}
      </div>
    );
  }

  const label = 'text-sm font-semibold text-card-foreground';
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Construction className="h-6 w-6" />{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {notice && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{notice}</p>}

      <div className={cn('rounded-xl border p-5 shadow-sm', on ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-card')}>
        <p className={cn('text-sm font-bold', on ? 'text-amber-400' : 'text-card-foreground')}>{on ? t.statusOn : t.statusOff}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t.staffNote}</p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <label className={label}>{t.messageEn}</label>
          <Textarea rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className={label}>{t.messagePt}</label>
          <Textarea rows={2} maxLength={300} value={messagePt} onChange={(e) => setMessagePt(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t.messageHint}</p>
        </div>
        <Button onClick={toggle} disabled={saving} variant={on ? 'outline' : 'destructive'}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Power className="mr-1.5 h-4 w-4" />}
          {saving ? t.saving : on ? t.disable : t.enable}
        </Button>
      </div>
    </div>
  );
}
