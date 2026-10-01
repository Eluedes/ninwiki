'use client';

// Editor de Vila (criar / editar): dados da vila + traducao do nome + lista de
// CLAS (editados aqui dentro; a lista salva SUBSTITUI a atual). Organizacoes
// (ligadas a uma ou mais vilas) ficam em /admin/organizations.

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { useLanguage } from '@/components/providers/language-provider';
import { ArrowLeft, Save, Plus, Trash2, Loader2, Languages, AlertTriangle } from 'lucide-react';
import { ApiError, createVillage, getVillage, updateVillage, type VillageInput } from '@/lib/api-client';
import { villageSchema, type VillageFormValues } from '@/lib/validation';
import { slugify } from '@/lib/utils';

const emptyForm: VillageFormValues = {
  id: '',
  name: '',
  namePt: '',
  element: '',
  motto: '',
  description: '',
  longDescription: '',
  emblem: '🏯',
  image: null,
  accentColor: '#558930',
  climate: '',
  leader: '',
  mapX: 50,
  mapY: 50,
  clans: [],
};

/** Mensagem de erro de um campo do formulario. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Editor de vila (criar/editar) com os cla's dentro, incluindo a imagem de cada cla'. */
export default function VillageEditorPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const router = useRouter();
  const { id } = use(params);
  const rawId = id?.[0];
  const isEdit = Boolean(rawId && rawId !== 'new');
  const { dict } = useLanguage();
  const t = dict.admin.villagesAdmin;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // ids de clas que JA existiam no banco: ficam travados (mudar o id = apagar um e criar outro)
  const [lockedClanIds, setLockedClanIds] = useState<Set<string>>(new Set());
  const [idTouched, setIdTouched] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<VillageFormValues>({ resolver: zodResolver(villageSchema), defaultValues: emptyForm });
  // keyName: o useFieldArray reserva a propriedade `id` de cada linha como chave interna do React -
  // como o clan TEM um `id` proprio (o slug), a chave interna usa outro nome pra' nao colidir.
  const { fields, append, remove } = useFieldArray({ control, name: 'clans', keyName: 'rowKey' });

  useEffect(() => {
    if (!isEdit || !rawId) return;
    let cancelled = false;
    getVillage(rawId)
      .then((v) => {
        if (cancelled) return;
        reset({
          ...v,
          namePt: v.namePt ?? '',
          image: v.image ?? null,
          clans: v.clans.map((c) => ({
            id: c.id, name: c.name, description: c.description, image: c.image ?? null,
          })),
        });
        setLockedClanIds(new Set(v.clans.map((c) => c.id)));
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

  async function onValid(values: VillageFormValues) {
    setSaving(true);
    setApiError(null);
    try {
      const payload: VillageInput = {
        ...values,
        namePt: values.namePt?.trim() || null,
        image: values.image || null,
      };
      if (isEdit && rawId) {
        await updateVillage(rawId, payload);
      } else {
        await createVillage(payload);
      }
      router.push('/admin/villages');
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
          <Link href="/admin/villages" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t.editTitle : t.newTitle}</h1>
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
              {t.idSlug} {isEdit && <span className="font-normal text-muted-foreground">{t.idSlugLocked}</span>}
            </label>
            <Input
              {...register('id', { onChange: () => setIdTouched(true) })}
              disabled={isEdit}
              className="font-mono"
            />
            {!isEdit && <p className="text-xs text-muted-foreground">{t.idHint}</p>}
            <FieldError message={errors.id?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className={label}>{t.emblem}</label>
            <Input {...register('emblem')} />
            <FieldError message={errors.emblem?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.element}</label>
            <Input {...register('element')} />
            <FieldError message={errors.element?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.accentColor}</label>
            <Controller
              control={control}
              name="accentColor"
              render={({ field }) => (
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(field.value) ? field.value : '#000000'}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                  <Input value={field.value} onChange={(e) => field.onChange(e.target.value)} className="font-mono" />
                </div>
              )}
            />
            <FieldError message={errors.accentColor?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={label}>{t.leader}</label>
            <Input {...register('leader')} />
            <FieldError message={errors.leader?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.climate}</label>
            <Input {...register('climate')} />
            <FieldError message={errors.climate?.message} />
          </div>
        </div>

        <div className="space-y-2">
          <label className={label}>{t.motto}</label>
          <Input {...register('motto')} />
          <FieldError message={errors.motto?.message} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <label className={label}>{t.image}</label>
            <Controller
              control={control}
              name="image"
              render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
            />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.mapX}</label>
            <Input type="number" step="0.01" {...register('mapX')} />
            <FieldError message={errors.mapX?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>{t.mapY}</label>
            <Input type="number" step="0.01" {...register('mapY')} />
            <FieldError message={errors.mapY?.message} />
            <p className="text-xs text-muted-foreground">{t.mapHint}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className={label}>{t.shortDescription}</label>
          <Textarea rows={2} {...register('description')} />
          <FieldError message={errors.description?.message} />
        </div>

        <div className="space-y-2">
          <label className={label}>{t.longDescription}</label>
          <Controller
            control={control}
            name="longDescription"
            render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
          />
          <FieldError message={errors.longDescription?.message} />
        </div>
      </div>

      {/* Traducao: mesmo padrao de Conteudo/Mastery/Jutsu - o campo principal e' o ingles. */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-card-foreground">
          <Languages className="h-4 w-4" /> {dict.admin.translation.sectionTitle}
        </h2>
        <div className="space-y-2">
          <label className={label}>{dict.admin.translation.nameLabel}</label>
          <Input {...register('namePt')} />
          <FieldError message={errors.namePt?.message} />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-card-foreground">
            {t.clansTitle} ({fields.length})
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ id: '', name: '', description: '', image: null })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> {t.addClan}
          </Button>
        </div>
        <FieldError message={errors.clans?.message ?? errors.clans?.root?.message} />
        {fields.length === 0 && <p className="text-sm text-muted-foreground">{t.noClans}</p>}
        {fields.map((field, index) => {
          const locked = lockedClanIds.has(getValues(`clans.${index}.id`));
          const rowErrors = errors.clans?.[index];
          return (
            <div key={field.rowKey} className="space-y-3 rounded-lg border border-border bg-secondary/20 p-4">
              <div className="grid gap-3 sm:grid-cols-[2fr_2fr_auto]">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">{t.clanName}</label>
                  <Input
                    {...register(`clans.${index}.name` as const, {
                      onChange: (e) => {
                        if (!locked && !getValues(`clans.${index}.id`).length) {
                          setValue(`clans.${index}.id`, slugify(e.target.value));
                        }
                      },
                    })}
                  />
                  <FieldError message={rowErrors?.name?.message} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">{t.clanId}</label>
                  <Input {...register(`clans.${index}.id` as const)} disabled={locked} className="font-mono" />
                  <FieldError message={rowErrors?.id?.message} />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    title={t.removeClan}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-900/20 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">{t.clanDescription}</label>
                <Textarea rows={2} {...register(`clans.${index}.description` as const)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">{t.clanImage}</label>
                <p className="text-xs text-muted-foreground">{t.clanImageHint}</p>
                <Controller
                  control={control}
                  name={`clans.${index}.image` as const}
                  render={({ field: imgField }) => (
                    <ImageUploadField value={imgField.value} onChange={imgField.onChange} />
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
    </form>
  );
}
