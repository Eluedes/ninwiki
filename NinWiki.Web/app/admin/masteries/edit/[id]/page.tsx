'use client';

// Editor de Mastery - edita o CONTEUDO de uma das 8 masteries fixas
// (id/type/element continuam travados, sao a identidade do elemento
// em si) + os Paths aninhados dela, mesmo padrao dinamico de
// Atributos/Drops do editor de Conteudo.
//
// Sem rota "new" de proposito: as 8 masteries ja existem desde o seed,
// esta tela so' EDITA uma que ja existe - por isso [id] simples, nao o
// catch-all opcional [[...id]] que Conteudo/Jutsu usam pra' cobrir
// "criar novo".

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { useLanguage } from '@/components/providers/language-provider';
import { ArrowLeft, Save, Plus, Trash2, Loader2, AlertTriangle, Languages } from 'lucide-react';
import {
  getMastery,
  updateMastery,
  retranslateMastery,
  listAttributes,
  ApiError,
  type ApiMasteryPath,
  type ApiAttribute,
  type MasteryInput,
} from '@/lib/api-client';
import { masterySchema, type MasteryFormValues } from '@/lib/validation';

/** Mensagem de erro de um campo do formulario. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

// Path com uma flag local (nao vem da API) pra' saber se o id ainda
// pode ser editado - path que ja existia no banco tem o id travado
// (mudar o id de um path existente seria, pro backend, indistinguivel
// de apagar um e criar outro do zero); path novo, adicionado agora
// nesta tela, ainda deixa escolher o id.
type EditablePath = ApiMasteryPath & { isNew: boolean };

/** Editor de mastery (nome, descricoes, icone, cor, imagem e GIF). */
export default function MasteryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { dict } = useLanguage();
  const t = dict.admin.masteryEditor;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<ApiAttribute[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [paths, setPaths] = useState<EditablePath[]>([]);
  // type/element vem so' pra' MOSTRAR (sao fixos) - nao fazem parte do
  // payload de PUT, o backend nem aceitaria mudar eles.
  const [readOnlyInfo, setReadOnlyInfo] = useState<{ type: string; element: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<MasteryFormValues>({
    resolver: zodResolver(masterySchema),
    defaultValues: { name: '', namePt: '', description: '', longDescription: '', descriptionPt: '', longDescriptionPt: '', icon: '', color: '', image: '', gif: '' },
  });

  // Mensagem de "erro ao carregar" guardada numa ref: assim o efeito de carga NAO precisa depender de
  // `t` (trocar o idioma no meio da edicao recarregaria o formulario e jogaria fora o que a pessoa digitou).
  const loadErrorRef = useRef(t.loadError);
  useEffect(() => {
    loadErrorRef.current = t.loadError;
  }, [t.loadError]);

  useEffect(() => {
    Promise.all([getMastery(id), listAttributes()])
      .then(([mastery, attrs]) => {
        reset({
          name: mastery.name,
          namePt: mastery.namePt ?? '',
          description: mastery.description,
          longDescription: mastery.longDescription,
          descriptionPt: mastery.descriptionPt ?? '',
          longDescriptionPt: mastery.longDescriptionPt ?? '',
          icon: mastery.icon,
          color: mastery.color,
          image: mastery.image ?? '',
          gif: mastery.gif ?? '',
        });
        setReadOnlyInfo({ type: mastery.type, element: mastery.element });
        setSelectedAttributeIds(mastery.attributeIds);
        setPaths(mastery.paths.map((p) => ({ ...p, isNew: false })));
        setAttributes(attrs);
      })
      .catch((err) => setApiError(err instanceof ApiError ? err.message : loadErrorRef.current))
      .finally(() => setLoading(false));
  }, [id, reset]);

  function toggleAttribute(attrId: string) {
    setSelectedAttributeIds((prev) => (prev.includes(attrId) ? prev.filter((a) => a !== attrId) : [...prev, attrId]));
  }

  function addPath() {
    setPaths((prev) => [...prev, { id: '', label: '', description: '', requirement: null, isNew: true }]);
  }
  function updatePath(index: number, patch: Partial<EditablePath>) {
    setPaths((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }
  function removePath(index: number) {
    setPaths((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleRetranslate() {
    if (!window.confirm(dict.admin.translation.retranslateConfirm)) return;
    setRetranslating(true);
    setApiError(null);
    try {
      const mastery = await retranslateMastery(id);
      reset({ ...getValues(), namePt: mastery.namePt ?? '', descriptionPt: mastery.descriptionPt ?? '', longDescriptionPt: mastery.longDescriptionPt ?? '' });
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : dict.admin.translation.retranslateError);
    } finally {
      setRetranslating(false);
    }
  }

  async function onValid(values: MasteryFormValues) {
    // Validacao manual leve dos Paths, ja' que eles ficam fora do
    // schema Zod (mesmo motivo do editor de Conteudo: sao lista
    // dinamica, nao campo fixo de formulario) - impede mandar pro
    // backend um path com id/label vazio, que ele recusaria de
    // qualquer jeito, mas com um erro generico em vez de apontar QUAL
    // path esta incompleto.
    for (const p of paths) {
      if (!p.id.trim() || !p.label.trim()) {
        setApiError(t.pathIncompleteError);
        return;
      }
    }
    const ids = paths.map((p) => p.id);
    if (new Set(ids).size !== ids.length) {
      setApiError(t.pathDuplicateIdError);
      return;
    }

    setSaving(true);
    setApiError(null);
    try {
      const payload: MasteryInput = {
        ...values,
        image: values.image ?? null,
        gif: values.gif ?? null,
        attributeIds: selectedAttributeIds,
        paths: paths.map(({ isNew, ...p }) => p),
      };
      await updateMastery(id, payload);
      router.push('/admin/masteries');
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : t.saveError);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {t.loading}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/masteries" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        {readOnlyInfo && (
          <span className="ml-1 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
            {readOnlyInfo.type === 'elemental' ? `Elemental · ${readOnlyInfo.element}` : t.nonElemental}
          </span>
        )}
      </div>

      {apiError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{apiError}</p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.name}</label>
          <Input {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.icon}</label>
            <Input {...register('icon')} placeholder="flame" />
            <FieldError message={errors.icon?.message} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.color}</label>
            <div className="flex items-center gap-2">
              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <input
                    type="color"
                    value={field.value || '#000000'}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
                  />
                )}
              />
              <Input {...register('color')} placeholder="#ef4444" />
            </div>
            <FieldError message={errors.color?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.image}</label>
            <Controller
              name="image"
              control={control}
              render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.gifLabel}</label>
            <Controller
              name="gif"
              control={control}
              render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.shortDescription}</label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} placeholder={t.shortDescriptionPlaceholder} />}
          />
          <FieldError message={errors.description?.message} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.fullDescription}</label>
          <Controller
            name="longDescription"
            control={control}
            render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} placeholder={t.fullDescriptionPlaceholder} />}
          />
          <FieldError message={errors.longDescription?.message} />
        </div>
      </div>

      {/* Atributos ligados - multi-select simples de checkbox, ja' que
          e' so' uma lista fixa de 5 itens (nao precisa de um componente
          de busca/combobox pra' isso). */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-card-foreground">{t.linkedAttributes}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {attributes.map((attr) => (
            <label key={attr.id} className="flex cursor-pointer items-center gap-2.5 rounded-md p-2 hover:bg-secondary/50">
              <Checkbox checked={selectedAttributeIds.includes(attr.id)} onCheckedChange={() => toggleAttribute(attr.id)} />
              <span className="text-sm text-card-foreground">{attr.name}</span>
              <span className="text-xs text-muted-foreground">({attr.namePt ?? attr.name})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Paths - lista dinamica, mesmo padrao de Atributos/Drops do
          editor de Conteudo. Path que ja existia tem o id travado (so'
          mostra, nao deixa editar) - ver comentario no tipo EditablePath. */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-card-foreground">{t.paths}</h2>
          <Button type="button" variant="outline" size="sm" onClick={addPath}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {t.addPath}
          </Button>
        </div>
        {paths.map((path, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex items-center gap-2">
              {path.isNew ? (
                <Input
                  placeholder={t.pathIdPlaceholder}
                  value={path.id}
                  onChange={(e) => updatePath(i, { id: e.target.value })}
                  className="font-mono text-xs"
                />
              ) : (
                <span className="rounded-md bg-secondary px-2 py-1.5 font-mono text-xs text-muted-foreground">{path.id}</span>
              )}
              <Input placeholder={t.pathNamePlaceholder} value={path.label} onChange={(e) => updatePath(i, { label: e.target.value })} />
              <button type="button" onClick={() => removePath(i)} className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-red-900/20 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Input placeholder={t.pathDescriptionPlaceholder} value={path.description} onChange={(e) => updatePath(i, { description: e.target.value })} />
            <Input
              placeholder={t.pathRequirementPlaceholder}
              value={path.requirement ?? ''}
              onChange={(e) => updatePath(i, { requirement: e.target.value || null })}
            />
          </div>
        ))}
        {paths.length === 0 && <p className="text-sm text-muted-foreground">{t.noPaths}</p>}
      </div>

      {/* Traducao automatica (DeepL) - mesmo padrao do editor de
          Conteudo (ver app/admin/content/edit/[[...id]]/page.tsx),
          reaproveitando os mesmos rotulos genericos de
          dict.admin.translation (nao precisam ser especificos de
          Mastery - "Descrição (Português)" funciona igual em
          qualquer editor). */}
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

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {t.save}
        </Button>
      </div>
    </form>
  );
}