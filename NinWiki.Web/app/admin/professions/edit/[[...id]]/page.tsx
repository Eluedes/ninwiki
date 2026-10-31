'use client';

// Editor de Proficiencia (criar / editar): nome, tipo (coleta/criacao), emoji e descricao em ingles e em portugues.
// Receitas, recursos e ferramentas NAO sao editados aqui: vem do importador (scripts/importar_profissoes_atlas.py) e ficam como estao ao salvar.

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
import { EmojiPicker } from '@/components/admin/emoji-picker';
import { useLanguage } from '@/components/providers/language-provider';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import { ApiError, createProfession, getProfession, updateProfession, type ApiProfession, type ProfessionInput } from '@/lib/api-client';
import { professionSchema, type ProfessionFormValues } from '@/lib/validation';
import { slugify } from '@/lib/utils';

const emptyForm: ProfessionFormValues = { id: '', name: '', namePt: '', group: 'crafting', description: '', descriptionPt: '', icon: '🔨' };

/** Texto vazio vira null (a API entende "vazio" como "a DeepL traduz"). */
const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);

/** Valores do formulario a partir da proficiencia vinda da API (os `details` ficam de fora). */
function toFormValues(p: ApiProfession): ProfessionFormValues {
  return { id: p.id, name: p.name, namePt: p.namePt ?? '', group: p.group, description: p.description, descriptionPt: p.descriptionPt ?? '', icon: p.icon };
}

/** Mensagem de erro de um campo do formulario. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Editor de proficiencia (criar/editar). */
export default function ProfessionEditorPage({ params }: { params: Promise<{ id?: string[] }> }) {
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

  const { register, control, handleSubmit, reset, setValue, getValues, formState: { errors } } = useForm<ProfessionFormValues>({
    resolver: zodResolver(professionSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    if (!isEdit || !rawId) return;
    let cancelled = false;
    getProfession(rawId)
      .then((p) => {
        if (!cancelled) reset(toFormValues(p));
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

  async function onValid(values: ProfessionFormValues) {
    setSaving(true);
    setApiError(null);
    try {
      const payload: ProfessionInput = { ...values, namePt: emptyToNull(values.namePt), descriptionPt: emptyToNull(values.descriptionPt) };
      if (isEdit && rawId) {
        await updateProfession(rawId, payload);
      } else {
        await createProfession(payload);
      }
      router.push('/admin/professions');
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
    <form onSubmit={handleSubmit(onValid)} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/professions" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t.editProfessionTitle : t.newProfessionTitle}</h1>
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
            <label className={label}>{t.name}</label>
            <Input
              {...register('name', {
                // id novo acompanha o nome ate' a pessoa mexer no id na mao
                onChange: (e) => {
                  if (!isEdit && !idTouched) setValue('id', slugify(e.target.value), { shouldValidate: true });
                },
              })}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>
              {t.id} {isEdit && <span className="font-normal text-muted-foreground">{t.idLocked}</span>}
            </label>
            <Input {...register('id', { onChange: () => setIdTouched(true) })} disabled={isEdit} />
            <FieldError message={errors.id?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={label}>{t.group}</label>
            <Controller
              name="group"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gathering">{t.groupGathering}</SelectItem>
                    <SelectItem value="crafting">{t.groupCrafting}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.emoji}</label>
            <div className="flex gap-2">
              <Input {...register('icon')} />
              <EmojiPicker onPick={(emoji) => setValue('icon', emoji, { shouldDirty: true, shouldValidate: true })} />
            </div>
            <FieldError message={errors.icon?.message} />
          </div>
        </div>

        <div className="space-y-2">
          <label className={label}>{t.description}</label>
          <Textarea rows={3} {...register('description')} />
          <FieldError message={errors.description?.message} />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs text-muted-foreground">{t.translationNote}</p>
        <div className="space-y-2">
          <label className={label}>{t.namePt}</label>
          <Input
            {...register('namePt', {
              // Escreveu so' em portugues: o id (slug) nasce do nome em portugues enquanto o ingles estiver vazio
              onChange: (e) => { if (!isEdit && !idTouched && !getValues('name')) setValue('id', slugify(e.target.value), { shouldValidate: true }); },
            })}
          />
          <FieldHint id="translate.ptOnly" />
        </div>
        <div className="space-y-2">
          <label className={label}>{t.descriptionPt}</label>
          <Textarea rows={3} {...register('descriptionPt')} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{t.detailsNote}</p>
    </form>
  );
}
