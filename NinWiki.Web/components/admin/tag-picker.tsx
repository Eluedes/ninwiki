'use client';

// Seletor multiplo de tags/categorias do post: mostra todas as tags como "pilulas" clicaveis (ate' 8 marcadas) e,
// para quem pode criar post, um campo para criar uma tag nova (o nome e' em ingles; a DeepL traduz o portugues).

import { useEffect, useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { ApiError, createTag, listTags, type ApiTagWithCount } from '@/lib/api-client';
import { localizedText } from '@/lib/localized';
import { cn } from '@/lib/utils';

const MAX_TAGS = 8;

/** Seletor multiplo de tags: `value` e' a lista de slugs marcados. */
export function TagPicker({ value, onChange, disabled }: { value: string[]; onChange: (slugs: string[]) => void; disabled?: boolean }) {
  const { dict, locale } = useLanguage();
  const t = dict.blogx.post;
  const [tags, setTags] = useState<ApiTagWithCount[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTags()
      .then((list) => {
        if (!cancelled) setTags(list);
      })
      .catch(() => {
        if (!cancelled) setError(t.tagError);
      });
    return () => {
      cancelled = true;
    };
  }, [t.tagError]);

  /** Marca ou desmarca uma tag (respeitando o maximo de 8). */
  function toggle(slug: string) {
    if (value.includes(slug)) return onChange(value.filter((s) => s !== slug));
    if (value.length >= MAX_TAGS) return setError(t.tagsMax);
    setError(null);
    onChange([...value, slug]);
  }

  /** Cria uma tag nova na API, entra na lista e ja' fica marcada. */
  async function handleCreate() {
    const name = newName.trim();
    if (name.length < 2) return;
    setCreating(true);
    setError(null);
    try {
      const tag = await createTag(name);
      setTags((prev) => [...prev, { ...tag, postCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      if (value.length < MAX_TAGS && !value.includes(tag.id)) onChange([...value, tag.id]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.tagError);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const on = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(tag.id)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {on && <Check className="h-3 w-3" />}
              {localizedText(locale, tag.name, tag.namePt)}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          value={newName}
          maxLength={50}
          disabled={disabled}
          placeholder={t.newTagPlaceholder}
          className="max-w-xs"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || creating || newName.trim().length < 2} onClick={handleCreate}>
          {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
          {t.addTag}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t.tagsHint}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
