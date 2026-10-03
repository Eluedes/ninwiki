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
import { ApiError, createVillage, getVillage, retranslateVillage, updateVillage, type ApiVillage, type VillageInput } from '@/lib/api-client';
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
  mottoPt: '',
  descriptionPt: '',
  longDescriptionPt: '',
  climatePt: '',
  emblem: '🏯',
  image: null,
  accentColor: '#558930',
  climate: '',
  leader: '',
  mapX: 50,
  mapY: 50,
  clans: [],
};

/** Texto vazio vira null (a API entende "vazio" como "a DeepL traduz"). */
const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);

/** Valores do formulario a partir da vila vinda da API (campos opcionais viram texto vazio). */
function toFormValues(v: ApiVillage): VillageFormValues {
  return {
    ...v,
    namePt: v.namePt ?? '',
    mottoPt: v.mottoPt ?? '',
    descriptionPt: v.descriptionPt ?? '',
    longDescriptionPt: v.longDescriptionPt ?? '',
    climatePt: v.climatePt ?? '',
    image: v.image ?? null,
    clans: v.clans.map((c) => ({
      id: c.id, name: c.name, description: c.description, namePt: c.namePt ?? '', descriptionPt: c.descriptionPt ?? '', image: c.image ?? null,
    })),
  };
}

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
  const [retranslating, setRetranslating] = useState(false);
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
        reset(toFormValues(v));
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

  /** Refaz a traducao EN -> PT (DeepL) da vila e dos cla's e recarrega o formulario. */
  async function handleRetranslate() {
    if (!rawId || !window.confirm(dict.admin.translation.retranslateConfirm)) return;
    setRetranslating(true);
    setApiError(null);
    try {
      reset(toFormValues(await retranslateVillage(rawId)));
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : dict.admin.translation.retranslateError);
    } finally {
      setRetranslating(false);
    }
  }

  async function onValid(values: VillageFormValues) {
    setSaving(true);
    setApiError(null);
    try {
      const payload: VillageInput = {
        ...values,
        namePt: emptyToNull(values.namePt),
        mottoPt: emptyToNull(values.mottoPt),
        descriptionPt: emptyToNull(values.descriptionPt),
        longDescriptionPt: emptyToNull(values.longDescriptionPt),
        climatePt: emptyToNull(values.climatePt),
        image: values.image || null,
        clans: values.clans.map((c) => ({ ...c, namePt: emptyToNull(c.namePt), descriptionPt: emptyToNull(c.descriptionPt) })),
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

        {/* Posicao no mapa (mapX/mapY): campos removidos da tela (mapa em manutencao). Os valores continuam no formulario (vem de toFormValues) e voltam iguais ao salvar. */}
        <div className="space-y-2">
          <label className={label}>{t.image}</label>
          <Controller
            control={control}
            name="image"
            render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
          />
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

      {/* Traducao (PT): o campo principal e' o ingles; a DeepL preenche estes ao salvar (se estiverem vazios). */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-card-foreground">
            <Languages className="h-4 w-4" /> {dict.admin.translation.sectionTitle}
          </h2>
          {isEdit && (
            <Button type="button" variant="outline" size="sm" disabled={retranslating} onClick={handleRetranslate}>
              {retranslating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Languages className="mr-1.5 h-4 w-4" />}
              {retranslating ? dict.admin.translation.retranslating : dict.admin.translation.retranslate}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{dict.admin.translation.emptyHint}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={label}>{dict.admin.translation.nameLabel}</label>
            <Input {...register('namePt')} />
            <FieldError message={errors.namePt?.message} />
          </div>
          <div className="space-y-2">
            <label className={label}>{dict.admin.translation.climateLabel}</label>
            <Input {...register('climatePt')} />
          </div>
        </div>
        <div className="space-y-2">
          <label className={label}>{dict.admin.translation.mottoLabel}</label>
          <Input {...register('mottoPt')} />
        </div>
        <div className="space-y-2">
          <label className={label}>{dict.admin.translation.descriptionLabel}</label>
          <Textarea rows={2} {...register('descriptionPt')} />
        </div>
        <div className="space-y-2">
          <label className={label}>{dict.admin.translation.longDescriptionLabel}</label>
          <Controller
            control={control}
            name="longDescriptionPt"
            render={({ field }) => <RichTextEditor value={field.value ?? ''} onChange={field.onChange} />}
          />
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
            onClick={() => append({ id: '', name: '', description: '', namePt: '', descriptionPt: '', image: null })}
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
              <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Languages className="h-3.5 w-3.5" /> {dict.admin.translation.sectionTitle}
                </p>
                <p className="text-xs text-muted-foreground">{t.clanTranslationNote}</p>
                <Input placeholder={dict.admin.translation.nameLabel} {...register(`clans.${index}.namePt` as const)} />
                <Textarea rows={2} placeholder={dict.admin.translation.descriptionLabel} {...register(`clans.${index}.descriptionPt` as const)} />
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
