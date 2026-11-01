'use client';

// Tema festivo do site (painel; exige site.seasonal_theme, EXCLUSIVA do S.Adm): escolhe qual epoca festiva fica ativa para todos os visitantes
// (Natal, Ano Novo, Valentine's Day, Pascoa, Halloween ou nenhuma). Nao mexe nas cores do site: so' nos enfeites. O site publico le o tema em GET /seasonal-theme.

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, getSeasonalTheme, setSeasonalTheme, type SeasonalTheme } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const OPTIONS: { key: SeasonalTheme; emoji: string }[] = [
  { key: 'none', emoji: '🌐' },
  { key: 'christmas', emoji: '🎄' },
  { key: 'newyear', emoji: '🎆' },
  { key: 'valentine', emoji: '💖' },
  { key: 'easter', emoji: '🐣' },
  { key: 'halloween', emoji: '🎃' },
];

/** Pagina /admin/seasonal-theme. */
export default function SeasonalThemePage() {
  const { dict } = useLanguage();
  const s = dict.seasonal;
  const [active, setActive] = useState<SeasonalTheme>('none');
  const [choice, setChoice] = useState<SeasonalTheme>('none');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getSeasonalTheme()
      .then((t) => { if (alive) { setActive(t.theme); setChoice(t.theme); setLoading(false); } })
      .catch((e) => { if (alive) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : s.loadError }); setLoading(false); } });
    return () => { alive = false; };
  }, [s.loadError]);

  const text = (k: SeasonalTheme) => ({
    name: s[k], desc: s[`${k}Desc` as keyof typeof s], when: s[`${k}When` as keyof typeof s],
  });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const saved = await setSeasonalTheme(choice);
      setActive(saved.theme);
      setChoice(saved.theme);
      setMsg({ ok: true, text: s.saved });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : s.saveError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">{s.adminTitle}</h1>
        <p className="text-sm text-muted-foreground">{s.adminSubtitle}</p>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label={s.loading} /> : (
        <>
          <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="sr-only">{s.adminTitle}</legend>
            {OPTIONS.map(({ key, emoji }) => {
              const t = text(key);
              const selected = choice === key;
              return (
                <label key={key} className={cn('flex cursor-pointer gap-3 rounded-xl border bg-card p-4 transition-colors', selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50')}>
                  <input type="radio" name="season" value={key} checked={selected} onChange={() => setChoice(key)} className="sr-only" />
                  <span className="text-3xl" aria-hidden>{emoji}</span>
                  <span className="min-w-0 space-y-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {t.name}
                      {active === key && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">{s.activeNow}</span>}
                      {selected && active !== key && <Check className="h-4 w-4 text-primary" aria-hidden />}
                    </span>
                    <span className="block text-sm text-muted-foreground">{t.desc}</span>
                    <span className="block text-xs text-muted-foreground"><b className="font-medium text-foreground">{s.suggestedDates}:</b> {t.when}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="max-w-2xl text-xs text-muted-foreground">{s.motionNote}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={busy || choice === active}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}{busy ? s.saving : s.save}
            </Button>
            {msg && <p role="status" className={cn('text-sm', msg.ok ? 'text-emerald-500' : 'text-destructive')}>{msg.text}</p>}
          </div>
        </>
      )}
    </div>
  );
}
