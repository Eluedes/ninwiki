'use client';

// Editor de post do blog (criar / editar), ligado a API real.
//
// A rota [[...id]] atende os dois casos: /admin/blog-posts/edit/new (criar) e
// /admin/blog-posts/edit/<id> (editar). Slug nasce do titulo (ate' a pessoa
// mexer nele). Quem nao pode publicar (Creator) so' salva RASCUNHO, e nao
// consegue alterar um post que ja' esta' publicado - a API tambem recusa isso.

import { useEffect, useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint } from '@/components/admin/field-hint';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { EntryHistory } from '@/components/admin/entry-history';
import { TagPicker } from '@/components/admin/tag-picker';
import { PostPreviewDialog } from '@/components/blog/post-preview-dialog';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { ArrowLeft, Save, Send, Loader2, AlertTriangle, Info, Languages, Eye, CalendarClock } from 'lucide-react';
import { ApiError, createPost, getPost, listTags, retranslatePost, updatePost, type ApiPost, type ApiTag, type PostInput } from '@/lib/api-client';
import { postSchema, type PostFormValues } from '@/lib/validation';
import { slugify } from '@/lib/utils';

const emptyForm: PostFormValues = {
  title: '', slug: '', excerpt: '', content: '', titlePt: '', excerptPt: '', contentPt: '', coverImage: null, bannerImage: null,
  tags: [], metaTitle: '', metaDescription: '', publishedAt: null,
};

/** ISO (UTC) -> valor do <input type="datetime-local"> no fuso do navegador ("2026-10-05T14:30"). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor do <input type="datetime-local"> -> ISO (UTC), ou null se vazio/invalido. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Texto vazio vira null (a API entende "vazio" como "a DeepL traduz"). */
const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);

/** Valores do formulario a partir do post vindo da API. */
function toFormValues(p: ApiPost): PostFormValues {
  return {
    title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, coverImage: p.coverImage, bannerImage: p.bannerImage ?? null,
    titlePt: p.titlePt ?? '', excerptPt: p.excerptPt ?? '', contentPt: p.contentPt ?? '',
    tags: p.tags.map((t) => t.id), metaTitle: p.metaTitle ?? '', metaDescription: p.metaDescription ?? '', publishedAt: p.publishedAt,
  };
}

/** Mensagem de erro de um campo do formulario. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Editor de post do blog (criar/editar, publicar ou salvar rascunho). */
export default function BlogPostEditorPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const router = useRouter();
  const { id } = use(params);
  const rawId = id?.[0];
  const isEdit = Boolean(rawId && rawId !== 'new');
  const { dict } = useLanguage();
  const t = dict.admin.blogAdmin;
  const { can } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'draft' | 'published'>('draft');
  const [slugTouched, setSlugTouched] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [openedAt] = useState(() => Date.now()); // "agora" de quando a pagina abriu (para saber se a data escolhida e' futura)
  const [allTags, setAllTags] = useState<ApiTag[]>([]);
  const [saved, setSaved] = useState(false); // depois de salvar, sair da pagina nao pede confirmacao

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<PostFormValues>({ resolver: zodResolver(postSchema), defaultValues: emptyForm });

  useEffect(() => {
    if (!isEdit || !rawId) return;
    let cancelled = false;
    getPost(rawId)
      .then((p) => {
        if (cancelled) return;
        reset(toFormValues(p));
        setCurrentStatus(p.status);
        setSlugTouched(true); // post existente: nao troca o slug sozinho quando o titulo muda
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

  // Aviso do navegador ao fechar a aba/recarregar com alteracoes nao salvas.
  useEffect(() => {
    if (!isDirty || saved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, saved]);

  // Tags para a pre-visualizacao (o seletor carrega a propria lista; aqui so' precisamos dos nomes).
  useEffect(() => {
    listTags().then(setAllTags).catch(() => setAllTags([]));
  }, []);

  // useWatch (e nao watch) para o compilador do React poder otimizar este componente
  const watched = useWatch({ control }) as PostFormValues;
  const previewTags = useMemo(() => allTags.filter((t) => (watched.tags ?? []).includes(t.id)), [allTags, watched.tags]);
  const scheduledInFuture = Boolean(watched.publishedAt && new Date(watched.publishedAt).getTime() > openedAt);

  // Quem nao pode publicar nao mexe em post publicado (a API tambem barra).
  const locked = currentStatus === 'published' && !can('posts.publish');

  /** Refaz a traducao EN -> PT (DeepL) do post e recarrega o formulario (so' o que o servidor traduziu). */
  async function handleRetranslate() {
    if (!rawId || !window.confirm(dict.admin.translation.retranslateConfirm)) return;
    setRetranslating(true);
    setApiError(null);
    try {
      reset(toFormValues(await retranslatePost(rawId)));
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : dict.admin.translation.retranslateError);
    } finally {
      setRetranslating(false);
    }
  }

  async function save(values: PostFormValues, status: 'draft' | 'published') {
    setSaving(true);
    setApiError(null);
    try {
      const payload: PostInput = {
        ...values,
        titlePt: emptyToNull(values.titlePt),
        excerptPt: emptyToNull(values.excerptPt),
        contentPt: emptyToNull(values.contentPt),
        coverImage: values.coverImage || null,
        bannerImage: values.bannerImage || null,
        metaTitle: emptyToNull(values.metaTitle),
        metaDescription: emptyToNull(values.metaDescription),
        publishedAt: values.publishedAt || null,
        status,
      };
      if (isEdit && rawId) {
        await updatePost(rawId, payload);
      } else {
        await createPost(payload);
      }
      setSaved(true);
      router.push('/admin/blog-posts');
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/blog-posts"
          onClick={(e) => {
            if (isDirty && !saved && !window.confirm(dict.blogx.post.unsavedWarning)) e.preventDefault();
          }}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> {t.back}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t.editTitle : t.newTitle}</h1>
      </div>

      {locked && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.lockedNote}</p>
        </div>
      )}
      {apiError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{apiError}</p>
        </div>
      )}

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        <fieldset disabled={locked} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <label className={label}>{t.titleLabel}</label>
            <Input
              placeholder={t.titlePlaceholder}
              className="text-lg"
              {...register('title', {
                onChange: (e) => {
                  if (!slugTouched) setValue('slug', slugify(e.target.value).slice(0, 150), { shouldValidate: true });
                },
              })}
            />
            <FieldError message={errors.title?.message} />
          </div>

          <div className="space-y-2">
            <label className={label}>{t.slugLabel}</label>
            <Input className="font-mono" {...register('slug', { onChange: () => setSlugTouched(true) })} />
            <p className="text-xs text-muted-foreground">{t.slugHint}</p>
            <FieldError message={errors.slug?.message} />
          </div>

          <div className="space-y-2">
            <label className={label}>{t.excerptLabel}</label>
            <Textarea rows={2} {...register('excerpt')} />
            <p className="text-xs text-muted-foreground">{t.excerptHint}</p>
          </div>

          <div className="space-y-2">
            <label className={label}>{t.coverLabel}</label>
            <Controller
              control={control}
              name="coverImage"
              render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-2">
            <label className={label}>{t.bannerLabel}</label>
            <Controller
              control={control}
              name="bannerImage"
              render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
            />
            <p className="text-xs text-muted-foreground">{t.bannerHint}</p>
          </div>

          <div className="space-y-2">
            <label className={label}>{dict.blogx.post.tagsLabel}</label>
            <Controller
              control={control}
              name="tags"
              render={({ field }) => <TagPicker value={field.value} onChange={field.onChange} disabled={locked} />}
            />
            <FieldError message={errors.tags?.message} />
          </div>

          <div className="space-y-2">
            <label className={label}>{t.contentLabel}</label>
            <Controller
              control={control}
              name="content"
              render={({ field }) => <RichTextEditor variant="blog" value={field.value} onChange={field.onChange} placeholder={t.contentPlaceholder} />}
            />
          </div>
        </fieldset>

        {/* Publicacao (agendamento) e SEO */}
        <fieldset disabled={locked} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <label className={`${label} flex items-center gap-2`}>
              <CalendarClock className="h-4 w-4" /> {dict.blogx.post.scheduleLabel}
              {scheduledInFuture && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">{dict.blogx.post.scheduledBadge}</span>
              )}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Controller
                control={control}
                name="publishedAt"
                render={({ field }) => (
                  <>
                    <Input
                      type="datetime-local"
                      className="max-w-xs"
                      value={toLocalInput(field.value)}
                      onChange={(e) => field.onChange(fromLocalInput(e.target.value))}
                    />
                    {field.value && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(null)}>
                        {dict.blogx.post.scheduleClear}
                      </Button>
                    )}
                  </>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">{dict.blogx.post.scheduleHint}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-card-foreground">{dict.blogx.post.seoTitle}</h2>
            <p className="text-xs text-muted-foreground">{dict.blogx.post.seoHint}</p>
            <label className={label}>{dict.blogx.post.metaTitleLabel}</label>
            <Input maxLength={70} {...register('metaTitle')} />
            <p className="text-xs text-muted-foreground">{dict.blogx.post.metaTitleHint} ({(watched.metaTitle ?? '').length}/70)</p>
            <FieldError message={errors.metaTitle?.message} />
            <label className={label}>{dict.blogx.post.metaDescLabel}</label>
            <Textarea rows={2} maxLength={200} {...register('metaDescription')} />
            <p className="text-xs text-muted-foreground">{dict.blogx.post.metaDescHint} ({(watched.metaDescription ?? '').length}/200)</p>
            <FieldError message={errors.metaDescription?.message} />
          </div>
        </fieldset>

        {/* Traducao (PT): o texto acima e' o ingles (principal); a DeepL preenche estes ao salvar se estiverem vazios. */}
        <fieldset disabled={locked} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-card-foreground">
              <Languages className="h-4 w-4" /> {dict.admin.translation.sectionTitle}
            </h2>
            {isEdit && (
              <Button type="button" variant="outline" size="sm" disabled={retranslating || locked} onClick={handleRetranslate}>
                {retranslating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Languages className="mr-1.5 h-4 w-4" />}
                {retranslating ? dict.admin.translation.retranslating : dict.admin.translation.retranslate}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{dict.admin.translation.emptyHint}</p>
          <div className="space-y-2">
            <label className={label}>{dict.admin.translation.titleLabel}</label>
            <Input
              {...register('titlePt', {
                // Escreveu so' em portugues: o slug nasce do titulo em portugues enquanto o ingles estiver vazio
                onChange: (e) => { if (!slugTouched && !getValues('title')) setValue('slug', slugify(e.target.value).slice(0, 150), { shouldValidate: true }); },
              })}
            />
            <FieldHint id="translate.ptOnly" />
          </div>
          <div className="space-y-2">
            <label className={label}>{dict.admin.translation.excerptLabel}</label>
            <Textarea rows={2} {...register('excerptPt')} />
          </div>
          <div className="space-y-2">
            <label className={label}>{dict.admin.translation.contentLabel}</label>
            <Controller
              control={control}
              name="contentPt"
              render={({ field }) => <RichTextEditor value={field.value ?? ''} onChange={field.onChange} />}
            />
          </div>
        </fieldset>

        {isEdit && rawId && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-semibold text-card-foreground">{dict.admin.contentEditor.history}</h2>
            <EntryHistory entityType="post" entityId={rawId} />
          </div>
        )}

        {currentStatus === 'published' && !locked && <p className="text-xs text-muted-foreground">{t.unpublishNote}</p>}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-1.5 h-4 w-4" />
            {dict.blogx.post.preview}
          </Button>
          <Button type="button" variant="outline" disabled={saving || locked} onClick={handleSubmit((v) => save(v, 'draft'))}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {saving ? t.saving : t.saveDraft}
          </Button>
          {can('posts.publish') && (
            <Button type="button" disabled={saving} onClick={handleSubmit((v) => save(v, 'published'))}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              {scheduledInFuture ? dict.blogx.post.schedule : t.publish}
            </Button>
          )}
        </div>
      </form>

      <PostPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={watched.title}
        titlePt={watched.titlePt}
        content={watched.content}
        contentPt={watched.contentPt}
        coverImage={watched.coverImage}
        tags={previewTags}
      />
    </div>
  );
}
