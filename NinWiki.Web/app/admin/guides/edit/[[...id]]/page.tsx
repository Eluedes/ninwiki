'use client';

// Editor de Artigo do Guia (criar / editar): secao, posicao, icone, situacao (rascunho/publicado), titulo, resumo e texto rico em ingles e em portugues.
// O ingles e' o principal; o que ficar vazio em portugues a API traduz (DeepL) ao salvar.

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint } from '@/components/admin/field-hint';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { GuideIconPicker } from '@/components/lore/guide-icons';
import { useLanguage } from '@/components/providers/language-provider';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import {
  ApiError, GUIDE_SECTIONS, createGuideArticle, getGuideArticle, updateGuideArticle, type ApiGuideArticle, type GuideArticleInput,
} from '@/lib/api-client';
import { guideArticleSchema, type GuideArticleFormValues } from '@/lib/validation';
import { slugify } from '@/lib/utils';

const emptyForm: GuideArticleFormValues = {
  id: '', section: 'new-player', position: 0, title: '', titlePt: '', summary: '', summaryPt: '', body: '', bodyPt: '', icon: 'book-open', status: 'draft',
};

/** Texto vazio vira null (a API entende "vazio" como "a DeepL traduz"). */
const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);

/** Valores do formulario a partir do artigo vindo da API (campos opcionais viram texto vazio). */
function toFormValues(a: ApiGuideArticle): GuideArticleFormValues {
  return { ...a, titlePt: a.titlePt ?? '', summaryPt: a.summaryPt ?? '', bodyPt: a.bodyPt ?? '' };
}

/** Mensagem de erro de um campo do formulario. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Editor de artigo do Guia (criar/editar). */
export default function GuideArticleEditorPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const router = useRouter();
  const { id } = use(params);
  const rawId = id?.[0];
  const isEdit = Boolean(rawId && rawId !== 'new');
  const { dict } = useLanguage();
  const t = dict.admin.guideAdmin;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [idTouched, setIdTouched] = useState(false);

  const { register, control, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<GuideArticleFormValues>({
    resolver: zodResolver(guideArticleSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    if (!isEdit || !rawId) return;
    let cancelled = false;
    getGuideArticle(rawId)
      .then((a) => {
        if (!cancelled) reset(toFormValues(a));
      })
      .catch((err) => {
        if (!cancelled) setApiError(err instanceof ApiError ? err.message : t.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, rawId, reset, t.loadError]);

  async function onValid(values: GuideArticleFormValues) {
    setSaving(true);
    setApiError(null);
    try {
      const payload: GuideArticleInput = {
        ...values,
        titlePt: emptyToNull(values.titlePt),
        summaryPt: emptyToNull(values.summaryPt),
        bodyPt: emptyToNull(values.bodyPt),
      };
      if (isEdit && rawId) {
        await updateGuideArticle(rawId, payload);
      } else {
        await createGuideArticle(payload);
      }
      router.push('/admin/guides');
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : t.saveError);
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
    <form onSubmit={handleSubmit(onValid)} className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/guides" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t.editArticleTitle : t.newArticleTitle}</h1>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {saving ? t.saving : t.save}
        </Button>
      </div>

      {apiError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{apiError}</p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={label}>{t.title}</label>
            <Input
              {...register('title', {
                // id novo acompanha o titulo ate' a pessoa mexer no id na mao
                onChange: (e) => {
                  if (!isEdit && !idTouched) setValue('id', slugify(e.target.value), { shouldValidate: true });
                },
              })}
            />
            <FieldError message={errors.title?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>
              {t.id} {isEdit && <span className="font-normal text-muted-foreground">{t.idLocked}</span>}
            </label>
            <Input {...register('id', { onChange: () => setIdTouched(true) })} disabled={isEdit} />
            <FieldError message={errors.id?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <label className={label}>{t.section}</label>
            <Controller
              name="section"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GUIDE_SECTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{dict.lore.guideSections[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.position}</label>
            <Input type="number" min={0} max={999} {...register('position')} />
            <FieldError message={errors.position?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.icon}</label>
            <Controller name="icon" control={control} render={({ field }) => <GuideIconPicker value={field.value} onChange={field.onChange} />} />
          </div>
        </div>

        <div className="space-y-2 sm:max-w-sm">
          <label className={label}>{t.status}</label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">{t.statusPublished}</SelectItem>
                  <SelectItem value="draft">{t.statusDraft}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <label className={label}>{t.summary}</label>
          <Textarea rows={2} maxLength={300} {...register('summary')} />
          <FieldError message={errors.summary?.message} />
        </div>

        <div className="space-y-2">
          <label className={label}>{t.body}</label>
          <Controller name="body" control={control} render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />} />
        </div>
      </div>

      {/* Traducao (PT): o campo principal e' o ingles; a DeepL preenche estes ao salvar (se estiverem vazios). */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs text-muted-foreground">{t.translationNote}</p>
        <div className="space-y-2">
          <label className={label}>{t.titlePt}</label>
          <Input
            {...register('titlePt', {
              // Escreveu so' em portugues: o id (slug) nasce do titulo em portugues enquanto o ingles estiver vazio
              onChange: (e) => { if (!isEdit && !idTouched && !getValues('title')) setValue('id', slugify(e.target.value), { shouldValidate: true }); },
            })}
          />
          <FieldHint id="translate.ptOnly" />
        </div>
        <div className="space-y-2">
          <label className={label}>{t.summaryPt}</label>
          <Textarea rows={2} maxLength={300} {...register('summaryPt')} />
        </div>
        <div className="space-y-2">
          <label className={label}>{t.bodyPt}</label>
          <Controller name="bodyPt" control={control} render={({ field }) => <RichTextEditor value={field.value ?? ''} onChange={field.onChange} />} />
        </div>
      </div>
    </form>
  );
}
