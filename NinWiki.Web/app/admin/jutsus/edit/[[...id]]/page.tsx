'use client';

// Editor de Jutsu - agora com validacao via React Hook Form + Zod
// (ver lib/validation.ts). Mesmo padrao usado no editor de Conteudo.

import { Checkbox } from '@/components/ui/checkbox';
import { UTILITY_ID } from '@/lib/utility-category';
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
  levels: [{ name: '', damage: '', cooldown: '' }],
  castType: '',
  jutsuClass: '',
  debuff: '',
  isNpc: false,
  allowedWeapons: '',
};

/** Tabela de niveis a partir do jutsu salvo (uma linha por nivel; pelo menos uma). */
function levelsFromApi(j: JutsuInput): { name: string; damage: string; cooldown: string }[] {
  const count = Math.min(10, Math.max(1, j.maxLevel ?? 1, j.damageByLevel?.length ?? 0, j.cooldownByLevel?.length ?? 0, j.nameByLevel?.length ?? 0));
  return Array.from({ length: count }, (_, i) => ({ name: j.nameByLevel?.[i] ?? '', damage: j.damageByLevel?.[i] ?? '', cooldown: j.cooldownByLevel?.[i] ?? '' }));
}

/** Uma coluna da tabela de niveis como lista para a API (tudo vazio vira lista vazia). */
function levelColumn(values: string[]): string[] {
  const cleaned = values.map((v) => v.trim());
  return cleaned.some(Boolean) ? cleaned : [];
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
  const isNpc = useWatch({ control, name: 'isNpc' });   // Jutsu NPC: so' nome, imagem e descricao (sem tier, custo, niveis nem ficha)
  const levelRows = useFieldArray({ control, name: 'levels' });
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
        if (j) reset({ ...emptyForm, ...j, masteryId: j.masteryId ?? UTILITY_ID, levels: levelsFromApi(j) });   // sem mastery = categoria Utility
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
      const { levels: _levels, ...rest } = values; // `levels` e' so' do formulario; a API recebe maxLevel/damageByLevel/cooldownByLevel
      void _levels;
      const isUtility = values.masteryId === UTILITY_ID;   // Utility = jutsu sem mastery (masteryId null) e sem caminho
      const payload: JutsuInput = {
        ...rest,
        masteryId: isUtility ? null : values.masteryId,
        pathId: isUtility ? null : (values.pathId ?? null),
        gif: values.gif || null,
        // cada linha da tabela de niveis e' um nivel: o nivel maximo e' a quantidade de linhas
        maxLevel: values.levels.length,
        damageByLevel: levelColumn(values.levels.map((l) => l.damage)),
        cooldownByLevel: levelColumn(values.levels.map((l) => l.cooldown)),
        nameByLevel: levelColumn(values.levels.map((l) => l.name)),   // nome do jutsu em cada nivel (tudo vazio = o nome nao muda)
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
                    {/* Categoria Utility: jutsu que nao e' de nenhuma mastery (qualquer pessoa pode usar) */}
                    <SelectItem value={UTILITY_ID}>{t.masteryUtility}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Jutsu NPC: versao do jutsu ensinada/usada por NPC - aparece numa secao propria do site (card NPC em Masteries) */}
          <div className="flex items-center gap-2 sm:col-span-2">
            <Controller
              name="isNpc"
              control={control}
              render={({ field }) => <Checkbox id="jutsu-is-npc" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
            />
            <label htmlFor="jutsu-is-npc" className="text-sm font-semibold">{jf.isNpc}</label>
            <span className="text-xs text-muted-foreground">{jf.isNpcHint}</span>
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
          {!isNpc && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.tier}</label>
                <Input type="number" min={1} max={5} {...register('tier')} />
                <p className="text-xs text-muted-foreground">{dict.jutsuInfo.tierHint}</p>
                <FieldError message={errors.tier?.message} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.chakraCost}</label>
                <Input type="number" {...register('chakraCost')} />
                <FieldError message={errors.chakraCost?.message} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.icon}</label>
            <Input {...register('icon')}  />
            <FieldError message={errors.icon?.message} />
          </div>
        </div>

        {/* Tudo daqui ate' a descricao so' vale para jutsu de jogador; o Jutsu NPC mostra so' nome, imagem e descricao. */}
        {!isNpc && (
          <>
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
              <Input {...register('requiredLevel')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.requiredStat}</label>
              <Input {...register('requiredStat')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.scrollType}</label>
              <Input {...register('scrollType')} />
              <p className="text-xs text-muted-foreground">{jf.scrollTypeHint}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.shop}</label>
              <Input {...register('shop')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.castType}</label>
              <Input {...register('castType')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.jutsuClass}</label>
              <Input {...register('jutsuClass')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.debuff}</label>
              <Input {...register('debuff')} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">{jf.allowedWeapons}</label>
              <Input {...register('allowedWeapons')} placeholder="Blunt" maxLength={100} />
            </div>
          </div>

          {/* Niveis do jutsu: uma linha por nivel (o nivel maximo e' a quantidade de linhas) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">{jf.levelsTitle}</label>
            <p className="text-xs text-muted-foreground">{jf.levelsHint}</p>
            <div className="space-y-2">
              {levelRows.fields.map((field, i) => (
                <div key={field.id} className="grid grid-cols-[4.5rem_1fr_auto] sm:grid-cols-[4.5rem_1.4fr_1fr_1fr_auto] items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{jf.levelN.replace('{n}', String(i + 1))}</span>
                  <Input {...register(`levels.${i}.name` as const)} placeholder={jf.levelNamePlaceholder} maxLength={100} className="col-span-2 sm:col-span-1" />
                  <Input {...register(`levels.${i}.damage` as const)} placeholder={jf.baseDamage} maxLength={40} />
                  <Input {...register(`levels.${i}.cooldown` as const)} placeholder={jf.cooldown} maxLength={40} />
                  <button type="button" title={jf.removeLevel} disabled={levelRows.fields.length <= 1} onClick={() => levelRows.remove(i)}
                    className="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            {levelRows.fields.length < 10 && (
              <Button type="button" variant="outline" size="sm" onClick={() => levelRows.append({ name: '', damage: '', cooldown: '' })}>
                <Plus className="mr-1.5 h-4 w-4" />{jf.addLevel}
              </Button>
            )}
            <FieldError message={errors.levels?.message} />
          </div>
        </div>

          </>
        )}

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
