'use client';

// Formulario de criacao de torneio (/tournaments/new). react-hook-form + zod (tournamentSchema). Exige leitor logado com o Discord.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/lore/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, createTournament } from '@/lib/api-client';
import { tournamentSchema, type TournamentFormValues } from '@/lib/validation';
import { LoginButton, Section, selectClass, useReader } from './shared';

/** Pagina /tournaments/new. */
export function TournamentForm() {
  const { dict } = useLanguage();
  const d = dict.tournaments;
  const router = useRouter();
  const { reader, loaded } = useReader();
  const [sendError, setSendError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentSchema), defaultValues: { name: '', description: '', startsAt: '', visibility: 'public' },
  });
  const err = (k?: string) => (k ? (k === 'required' ? d.errRequired : k === 'tooShort' ? d.errTooShort : d.errTooLong) : undefined);

  async function onSubmit(v: TournamentFormValues) {
    setSendError(null);
    try {
      const t = await createTournament({ name: v.name, description: v.description, visibility: v.visibility, startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : null });
      router.push(`/tournaments/${t.id}`);
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : d.createError);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PageHeader title={d.newTitle} subtitle={d.newSubtitle} breadcrumbs={[{ label: d.title, href: '/tournaments' }, { label: d.newTitle }]} />
      {loaded && !reader ? (
        <Section><p className="text-sm text-muted-foreground">{d.signInToCreate}</p><LoginButton /></Section>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Section>
            <div className="space-y-1.5">
              <label htmlFor="t-name" className="text-sm font-medium">{d.nameLabel}</label>
              <Input id="t-name" maxLength={80} placeholder={d.namePlaceholder} aria-invalid={!!errors.name} {...register('name')} />
              {errors.name && <p className="text-xs font-medium text-destructive">{err(errors.name.message)}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="t-desc" className="text-sm font-medium">{d.descLabel}</label>
              <Textarea id="t-desc" rows={5} maxLength={2000} placeholder={d.descPlaceholder} {...register('description')} />
              <p className="text-xs text-muted-foreground">{d.descHint}</p>
              {errors.description && <p className="text-xs font-medium text-destructive">{err(errors.description.message)}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="t-date" className="text-sm font-medium">{d.startsAtLabel}</label>
                <Input id="t-date" type="datetime-local" {...register('startsAt')} />
                <p className="text-xs text-muted-foreground">{d.startsAtHint}</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="t-vis" className="text-sm font-medium">{d.visibilityLabel}</label>
                <select id="t-vis" className={selectClass} {...register('visibility')}>
                  <option value="public">{d.visibilityPublic}</option>
                  <option value="unlisted">{d.visibilityUnlisted}</option>
                </select>
              </div>
            </div>
          </Section>
          {sendError && <p role="alert" className="text-sm font-medium text-destructive">{sendError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting || !reader}>{isSubmitting ? d.saving : d.createSubmit}</Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/tournaments')}>{d.cancel}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
