'use client';

// Editor de post do blog (criar / editar), ligado a API real.
//
// A rota [[...id]] atende os dois casos: /admin/blog-posts/edit/new (criar) e
// /admin/blog-posts/edit/<id> (editar). Slug nasce do titulo (ate' a pessoa
// mexer nele). Quem nao pode publicar (Creator) so' salva RASCUNHO, e nao
// consegue alterar um post que ja' esta' publicado - a API tambem recusa isso.

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { EntryHistory } from '@/components/admin/entry-history';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { ArrowLeft, Save, Send, Loader2, AlertTriangle, Info, Languages } from 'lucide-react';
import { ApiError, createPost, getPost, retranslatePost, updatePost, type ApiPost, type PostInput } from '@/lib/api-client';
import { postSchema, type PostFormValues } from '@/lib/validation';
import { slugify } from '@/lib/utils';

const emptyForm: PostFormValues = { title: '', slug: '', excerpt: '', content: '', titlePt: '', excerptPt: '', contentPt: '', coverImage: null };

/** Texto vazio vira null (a API entende "vazio" como "a DeepL traduz"). */
const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);

/** Valores do formulario a partir do post vindo da API. */
function toFormValues(p: ApiPost): PostFormValues {
  return {
    title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, coverImage: p.coverImage,
    titlePt: p.titlePt ?? '', excerptPt: p.excerptPt ?? '', contentPt: p.contentPt ?? '',
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

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
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
        status,
      };
      if (isEdit && rawId) {
        await updatePost(rawId, payload);
      } else {
        await createPost(payload);
      }
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
        <Link href="/admin/blog-posts" className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
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
            <label className={label}>{t.contentLabel}</label>
            <Controller
              control={control}
              name="content"
              render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} placeholder={t.contentPlaceholder} />}
            />
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
            <Input {...register('titlePt')} />
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
          <Button type="button" variant="outline" disabled={saving || locked} onClick={handleSubmit((v) => save(v, 'draft'))}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {saving ? t.saving : t.saveDraft}
          </Button>
          {can('posts.publish') && (
            <Button type="button" disabled={saving} onClick={handleSubmit((v) => save(v, 'published'))}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              {t.publish}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
