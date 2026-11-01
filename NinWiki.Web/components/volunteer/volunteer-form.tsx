'use client';

// Formulario publico de voluntarios (/volunteer). react-hook-form + zod (volunteerSchema); envia para POST /volunteers/apply.
// Acessibilidade: erros por campo com aria-invalid/aria-describedby e o resultado do envio num aviso aria-live.
// O campo "website" e' uma ISCA anti-robo: escondido de pessoas (fora da tela, sem foco); se vier preenchido a API descarta.

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Lock, HeartHandshake, Loader2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, applyAsVolunteer, getVolunteerFormStatus, VOLUNTEER_AREAS } from '@/lib/api-client';
import { volunteerSchema, type VolunteerFormValues } from '@/lib/validation';
import { cn } from '@/lib/utils';

const EMPTY: VolunteerFormValues = {
  discord: '', gameNick: '', languages: '', areas: [], availability: '', motivation: '',
  contactEmail: '', consent: false, website: '',
};

/** Cartao de secao do formulario (estilo dossie: borda, fundo de card). */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h2>
      {children}
    </section>
  );
}

/** Pagina inteira: cabecalho, formulario, texto de privacidade e estado de sucesso. */
export function VolunteerForm() {
  const { dict } = useLanguage();
  const t = dict.volunteer;
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);   // null = ainda consultando; false = inscricoes fechadas pelo painel
  useEffect(() => {
    // Se a consulta falhar, mostra o formulario mesmo assim: a API e' quem recusa de verdade quando esta' fechado.
    getVolunteerFormStatus().then((s) => setOpen(s.enabled)).catch(() => setOpen(true));
  }, []);
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<VolunteerFormValues>({
    resolver: zodResolver(volunteerSchema), defaultValues: EMPTY,
  });

  /** Traduz a chave de erro do zod (required, tooShort...) para o idioma da tela. */
  const err = (key?: string) => (key ? t.errors[key] ?? t.errors.required : undefined);

  /** Envia; mostra a mensagem da API quando e' limite de envios (429) e uma generica nos outros erros. */
  async function onSubmit(v: VolunteerFormValues) {
    setSendError(null);
    try {
      await applyAsVolunteer({ ...v, contactEmail: v.contactEmail.trim() || null, consent: true });
      setSent(true);
      reset(EMPTY);
    } catch (e) {
      setSendError(e instanceof ApiError && e.status === 429 ? e.message : t.sendError);
    }
  }

  /** Campo de texto com rotulo, dica e erro ligados por aria. */
  function field(name: keyof VolunteerFormValues, label: string, opts: { ph?: string; hint?: string; area?: boolean; type?: string; max: number }) {
    const msg = err(errors[name]?.message as string | undefined);
    const common = {
      id: `v-${name}`, placeholder: opts.ph, maxLength: opts.max, 'aria-invalid': !!msg,
      'aria-describedby': msg ? `v-${name}-err` : opts.hint ? `v-${name}-hint` : undefined,
      ...register(name as 'discord'),
    };
    return (
      <div className="space-y-1.5">
        <label htmlFor={`v-${name}`} className="text-sm font-medium">{label}</label>
        {opts.area ? <Textarea rows={4} {...common} /> : <Input type={opts.type ?? 'text'} {...common} />}
        {opts.hint && !msg && <p id={`v-${name}-hint`} className="text-xs text-muted-foreground">{opts.hint}</p>}
        {msg && <p id={`v-${name}-err`} className="text-xs font-medium text-destructive">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.title} subtitle={t.subtitle} icon={<HeartHandshake className="h-6 w-6" />}
        breadcrumbs={[{ label: dict.nav.home, href: '/' }, { label: t.title }]}
      />
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{t.intro}</p>

      {/* Resultado do envio: aria-live avisa leitores de tela sem mover o foco */}
      <div aria-live="polite" role="status">
        {sent && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="space-y-2">
              <p className="font-semibold">{t.successTitle}</p>
              <p className="text-muted-foreground">{t.successText}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setSent(false)}>{t.sendAnother}</Button>
            </div>
          </div>
        )}
        {sendError && <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{sendError}</p>}
        {Object.keys(errors).length > 0 && !sendError && <p className="mb-6 text-sm font-medium text-destructive">{t.fixErrors}</p>}
      </div>

      {open === false && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="space-y-1"><p className="font-semibold">{t.closedTitle}</p><p className="text-muted-foreground">{t.closedText}</p></div>
        </div>
      )}

      {!sent && open === true && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Section title={t.sectionAbout}>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('discord', t.discord, { ph: t.discordPh, hint: t.discordHint, max: 64 })}
              {field('gameNick', t.gameNick, { ph: t.gameNickPh, max: 60 })}
              {field('languages', t.languages, { ph: t.languagesPh, max: 120 })}
            </div>
          </Section>

          <Section title={t.sectionHelp}>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t.areas}</legend>
              <Controller
                control={control} name="areas"
                render={({ field: f }) => (
                  <div className="flex flex-wrap gap-2">
                    {VOLUNTEER_AREAS.map((a) => {
                      const on = f.value.includes(a);
                      return (
                        <button
                          key={a} type="button" aria-pressed={on}
                          onClick={() => f.onChange(on ? f.value.filter((x) => x !== a) : [...f.value, a])}
                          className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                            on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}
                        >
                          {t.areaNames[a]}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              <p className={cn('text-xs', errors.areas ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {errors.areas ? err(errors.areas.message) : t.areasHint}
              </p>
            </fieldset>
            {field('availability', t.availability, { ph: t.availabilityPh, max: 200 })}
          </Section>

          <Section title={t.sectionMotivation}>
            {field('motivation', t.motivation, { ph: t.motivationPh, area: true, max: 1500 })}
            {field('contactEmail', t.email, { hint: t.emailHint, type: 'email', max: 120 })}
          </Section>

          <section className="space-y-2 rounded-xl border border-border bg-secondary/40 p-5 text-sm">
            <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-primary" />{t.privacyTitle}</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t.privacyPurpose}</li><li>{t.privacyWho}</li><li>{t.privacyDelete}</li><li>{t.privacyNoIp}</li>
            </ul>
            <div className="flex items-start gap-2 pt-2">
              <Controller
                control={control} name="consent"
                render={({ field: f }) => (
                  <Checkbox id="v-consent" checked={f.value} onCheckedChange={(c) => f.onChange(c === true)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'v-consent-err' : undefined} className="mt-0.5" />
                )}
              />
              <label htmlFor="v-consent" className="cursor-pointer leading-snug">{t.consent}</label>
            </div>
            {errors.consent && <p id="v-consent-err" className="text-xs font-medium text-destructive">{err(errors.consent.message)}</p>}
          </section>

          {/* Isca anti-robo: fora da tela, sem foco e sem preenchimento automatico */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.sending}</> : t.send}
          </Button>
        </form>
      )}
    </div>
  );
}
