'use client';

// Editor de Jutsu - agora com validacao via React Hook Form + Zod
// (ver lib/validation.ts). Mesmo padrao usado no editor de Conteudo.

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { EntryHistory } from '@/components/admin/entry-history';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/components/providers/language-provider';
import { ArrowLeft, Save, Loader2, Languages, Plus, Trash2 } from 'lucide-react';
import {
  getJutsu,
  createJutsu,
  updateJutsu,
  retranslateJutsu,
  listMasteries,
  ApiError,
  type ApiMastery,
  type JutsuInput,
} from '@/lib/api-client';
import { jutsuSchema, type JutsuFormValues } from '@/lib/validation';

const emptyForm: JutsuFormValues = {
  id: '',
  name: '',
  namePt: '',
  masteryId: 'fire',
  pathId: null,
  tier: 1,
  chakraCost: 0,
  description: '',
  longDescription: '',
  descriptionPt: '',
  longDescriptionPt: '',
  effect: '',
  range: '',
  castTime: '',
  cooldown: '',
  icon: 'flame',
  gif: null,
  requiredLevel: '',
  requiredStat: '',
  scrollType: '',
  shop: '',
  maxLevel: 1,
  damageByLevel: [],
  cooldownByLevel: [],
  castType: '',
  jutsuClass: '',
  debuff: '',
  battleExtra: [],
};

/** Valores por nivel: corta no nivel maximo; se todos estiverem vazios, devolve lista vazia. */
function trimLevels(values: string[] | undefined, max: number): string[] {
  const cut = (values ?? []).slice(0, max).map((v) => (v ?? '').trim());
  return cut.some(Boolean) ? cut : [];
}

/** Mensagem de erro de um campo do formulario. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Editor de jutsu (criar/editar). */
export default function JutsuEditorPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const router = useRouter();
  const { id } = use(params);
  const rawId = id?.[0];
  const isEdit = Boolean(rawId && rawId !== 'new');
  const { dict } = useLanguage();
  const t = dict.admin.jutsuEditor;

  const [masteries, setMasteries] = useState<ApiMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<JutsuFormValues>({
    resolver: zodResolver(jutsuSchema),
    defaultValues: emptyForm,
  });

  const masteryId = useWatch({ control, name: 'masteryId' });
  const maxLevel = Math.min(10, Math.max(1, Number(useWatch({ control, name: 'maxLevel' })) || 1));
  const extraRows = useFieldArray({ control, name: 'battleExtra' });
  const jf = dict.jutsuInfo;

  // Mensagem de "erro ao carregar" guardada numa ref: assim o efeito de carga NAO precisa depender de
  // `t` (trocar o idioma no meio da edicao recarregaria o formulario e jogaria fora o que a pessoa digitou).
  const loadErrorRef = useRef(t.loadError);
  useEffect(() => {
    loadErrorRef.current = t.loadError;
  }, [t.loadError]);

  useEffect(() => {
    const loadMasteries = listMasteries();
    const loadJutsu = isEdit && rawId ? getJutsu(rawId) : Promise.resolve(null);

    Promise.all([loadMasteries, loadJutsu])
      .then(([m, j]) => {
        setMasteries(m);
        if (j) reset({ ...emptyForm, ...j, damageByLevel: j.damageByLevel ?? [], cooldownByLevel: j.cooldownByLevel ?? [], battleExtra: j.battleExtra ?? [] });
      })
      .catch((err) => setApiError(err instanceof ApiError ? err.message : loadErrorRef.current))
      .finally(() => setLoading(false));
  }, [isEdit, rawId, reset]);

  // Caminhos disponiveis pra' mastery selecionada no momento.
  const selectedMastery = masteries.find((m) => m.id === masteryId);
  const availablePaths = selectedMastery?.paths ?? [];

  async function handleRetranslate() {
    if (!rawId || !isEdit) return;
    if (!window.confirm(dict.admin.translation.retranslateConfirm)) return;
    setRetranslating(true);
    setApiError(null);
    try {
      const jutsu = await retranslateJutsu(rawId);
      reset({ ...getValues(), namePt: jutsu.namePt ?? '', descriptionPt: jutsu.descriptionPt ?? '', longDescriptionPt: jutsu.longDescriptionPt ?? '' });
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : dict.admin.translation.retranslateError);
    } finally {
      setRetranslating(false);
    }
  }

  async function onValid(values: JutsuFormValues) {
    setSaving(true);
    setApiError(null);
    try {
      const payload: JutsuInput = {
        ...values,
        pathId: values.pathId ?? null,
        gif: values.gif || null,
        // um valor por nivel (corta o que passou do nivel maximo; tudo vazio vira lista vazia)
        damageByLevel: trimLevels(values.damageByLevel, values.maxLevel),
        cooldownByLevel: trimLevels(values.cooldownByLevel, values.maxLevel),
        namePt: values.namePt ?? null,
        descriptionPt: values.descriptionPt ?? null,
        longDescriptionPt: values.longDescriptionPt ?? null,
      };
      if (isEdit && rawId) {
        await updateJutsu(rawId, payload);
      } else {
        await createJutsu(payload);
      }
      router.push('/admin/jutsus');
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : t.saveError);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t.loading}
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/jutsus" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t.editTitle : t.newTitle}</h1>

      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{apiError}</div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.name}</label>
          <Input {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">
            {t.idSlug} {isEdit && <span className="font-normal text-muted-foreground">{t.idSlugLocked}</span>}
          </label>
          <Input {...register('id')} disabled={isEdit} placeholder={t.idPlaceholder} />
          <FieldError message={errors.id?.message} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.mastery}</label>
            <Controller
              name="masteryId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setValue('pathId', null); // troca de mastery invalida o caminho antigo
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {masteries.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {availablePaths.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.path}</label>
              <Controller
                name="pathId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t.pathNone}</SelectItem>
                      {availablePaths.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.tier}</label>
            <Input type="number" min={1} max={4} {...register('tier')} />
            <p className="text-xs text-muted-foreground">{dict.jutsuInfo.tierHint}</p>
            <FieldError message={errors.tier?.message} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.chakraCost}</label>
            <Input type="number" {...register('chakraCost')} />
            <FieldError message={errors.chakraCost?.message} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.icon}</label>
            <Input {...register('icon')} placeholder="flame" />
            <FieldError message={errors.icon?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.range}</label>
            <Input {...register('range')} placeholder={t.rangePlaceholder} />
            <FieldError message={errors.range?.message} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.castTime}</label>
            <Input {...register('castTime')} placeholder={t.castTimePlaceholder} />
            <FieldError message={errors.castTime?.message} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.cooldown}</label>
            <Input {...register('cooldown')} placeholder={t.cooldownPlaceholder} />
            <FieldError message={errors.cooldown?.message} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.effect}</label>
          <Input {...register('effect')} placeholder={t.effectPlaceholder} />
          <FieldError message={errors.effect?.message} />
        </div>
        {/* Ficha do jutsu (mesmas secoes da pagina publica) */}
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div>
            <h2 className="font-semibold text-card-foreground">{jf.sheetTitle}</h2>
            <p className="text-xs text-muted-foreground">{jf.sheetHint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.requiredLevel}</label>
              <Input {...register('requiredLevel')} placeholder="20+" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.requiredStat}</label>
              <Input {...register('requiredStat')} placeholder="35 Intellect" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.scrollType}</label>
              <Input {...register('scrollType')} placeholder="Sealable Scroll" />
              <p className="text-xs text-muted-foreground">{jf.scrollTypeHint}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.shop}</label>
              <Input {...register('shop')} placeholder="Any" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.maxLevel}</label>
              <Input type="number" min={1} max={10} {...register('maxLevel')} />
              <p className="text-xs text-muted-foreground">{jf.maxLevelHint}</p>
              <FieldError message={errors.maxLevel?.message} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.castType}</label>
              <Input {...register('castType')} placeholder="Walk cast" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.jutsuClass}</label>
              <Input {...register('jutsuClass')} placeholder="Trap" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.debuff}</label>
              <Input {...register('debuff')} placeholder="Burn III" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{jf.perLevelHint}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.baseDamage}</label>
              {Array.from({ length: maxLevel }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{jf.levelN.replace('{n}', String(i + 1))}</span>
                  <Input {...register(`damageByLevel.${i}` as const)} placeholder="6" maxLength={40} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.cooldown}</label>
              {Array.from({ length: maxLevel }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{jf.levelN.replace('{n}', String(i + 1))}</span>
                  <Input {...register(`cooldownByLevel.${i}` as const)} placeholder="16s" maxLength={40} />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">{jf.battleExtra}</label>
            {extraRows.fields.map((field, i) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input {...register(`battleExtra.${i}.label` as const)} placeholder={jf.rowLabel} maxLength={60} />
                <Input {...register(`battleExtra.${i}.value` as const)} placeholder={jf.rowValue} maxLength={150} />
                <button type="button" title={jf.removeRow} onClick={() => extraRows.remove(i)}
                  className="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {extraRows.fields.length < 10 && (
              <Button type="button" variant="outline" size="sm" onClick={() => extraRows.append({ label: '', value: '' })}>
                <Plus className="mr-1.5 h-4 w-4" />{jf.addRow}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.shortDescription}</label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <RichTextEditor value={field.value} onChange={field.onChange} placeholder={t.shortDescriptionPlaceholder} />
            )}
          />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.fullDescription}</label>
          <Controller
            name="longDescription"
            control={control}
            render={({ field }) => (
              <RichTextEditor value={field.value} onChange={field.onChange} placeholder={t.fullDescriptionPlaceholder} />
            )}
          />
          <FieldError message={errors.longDescription?.message} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.gif}</label>
          <Controller
            name="gif"
            control={control}
            render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
          />
        </div>
      </div>

      {isEdit && rawId && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-card-foreground">
              <Languages className="h-4 w-4" /> {dict.admin.translation.sectionTitle}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={handleRetranslate} disabled={retranslating}>
              {retranslating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Languages className="mr-1.5 h-3.5 w-3.5" />}
              {retranslating ? dict.admin.translation.retranslating : dict.admin.translation.retranslate}
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{dict.admin.translation.nameLabel}</label>
            <Input {...register('namePt')} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{dict.admin.translation.descriptionLabel}</label>
            <Controller
              name="descriptionPt"
              control={control}
              render={({ field }) => (
                <RichTextEditor value={field.value ?? ''} onChange={field.onChange} placeholder={dict.admin.translation.emptyHint} />
              )}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.fullDescription} (Português)</label>
            <Controller
              name="longDescriptionPt"
              control={control}
              render={({ field }) => (
                <RichTextEditor value={field.value ?? ''} onChange={field.onChange} placeholder={dict.admin.translation.emptyHint} />
              )}
            />
          </div>
        </div>
      )}

      {isEdit && rawId && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-semibold text-card-foreground">{t.history}</h2>
          <EntryHistory entityType="jutsu" entityId={rawId} />
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button type="button" onClick={handleSubmit(onValid)} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}
