'use client';

// Pre-visualizacao do post no editor: abre um modal que mostra o texto ATUAL do formulario (mesmo sem salvar)
// do jeito que o leitor vai ver (mesmos estilos do site, com o indice automatico).

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/components/providers/language-provider';
import { RichText } from '@/components/lore/rich-text';
import { PostToc } from '@/components/blog/post-toc';
import { prepareContent, readingMinutes } from '@/lib/blog-utils';
import { localizedText } from '@/lib/localized';
import type { ApiTag } from '@/lib/api-client';

/** Modal de pre-visualizacao: titulo, capa, tags, indice e o corpo renderizado como no site. */
export function PostPreviewDialog({
  open, onOpenChange, title, titlePt, content, contentPt, coverImage, tags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titlePt?: string | null;
  content: string;
  contentPt?: string | null;
  coverImage: string | null | undefined;
  tags: ApiTag[];
}) {
  const { locale, dict } = useLanguage();
  const t = dict.blogx;
  // No idioma portugues mostra a traducao quando ja' existe; senao o ingles (igual ao site).
  const body = locale === 'pt' && contentPt ? contentPt : content;
  const prepared = prepareContent(body);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.post.previewTitle}</DialogTitle>
          <p className="text-xs text-muted-foreground">{t.post.previewNote}</p>
        </DialogHeader>
        <article>
          <h1 className="text-2xl font-bold tracking-tight">{localizedText(locale, title, titlePt) || '…'}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{readingMinutes(body)} {t.public.minRead}</span>
            {tags.map((tag) => (
              <span key={tag.id} className="rounded-full border border-border px-2 py-0.5">{localizedText(locale, tag.name, tag.namePt)}</span>
            ))}
          </div>
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="" className="mt-4 w-full rounded-xl border border-border object-cover" />
          )}
          <PostToc items={prepared.toc} />
          <div className="mt-4">
            <RichText content={prepared.content} />
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
}
