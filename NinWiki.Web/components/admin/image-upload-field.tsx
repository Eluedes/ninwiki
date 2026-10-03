'use client';

// Campo de upload de imagem - SUBSTITUI o campo de texto solto "caminho
// da imagem" que existia antes no editor. A pessoa escolhe um arquivo
// do computador, ele sobe pra' API (POST /uploads/image, que valida
// tipo real e tamanho - ver app/api/uploads.py no backend) e a URL que
// volta e' o que fica salvo no campo `image` da entry.
//
// Mantém um campo de texto por baixo do preview, editável manualmente -
// util pra colar a URL de uma imagem que já existe (ex: um caminho de
// /images/wiki/... do catálogo antigo) sem precisar re-enviar o arquivo.

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/providers/language-provider';
import { uploadImage, getMedia, parseImageRef, ApiError } from '@/lib/api-client';
import { MediaPickerDialog } from '@/components/admin/media-picker-dialog';
import { Upload, Loader2, X, ImageOff, Images } from 'lucide-react';

/** Campo de imagem: escolher arquivo (upload) ou colar uma URL, com previa. */
export function ImageUploadField({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
}) {
  const { dict } = useLanguage();
  const t = dict.admin.imageUpload;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null); // aviso curto (ex.: "Imagem #12 do banco")
  const inputRef = useRef<HTMLInputElement>(null);

  /** Se o campo tem um ID de imagem (img:12, #12, 12), troca pelo endereco da imagem do banco; ID que nao existe vira aviso. */
  async function resolveRef() {
    const id = parseImageRef(value ?? '');
    if (id === null) { setNote(null); return; }
    try {
      const media = await getMedia(id);
      onChange(media.url);
      setPreviewFailed(false);
      setNote(t.idResolved.replace('{id}', String(id)));
    } catch {
      setNote(null);
      setError(t.idNotFound.replace('{id}', String(id)));
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      onChange(url);
      setPreviewFailed(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.uploadError);
    } finally {
      setUploading(false);
      // Limpa o <input type="file"> depois do envio - sem isso, escolher
      // o MESMO arquivo de novo (ex: depois de um erro) nao dispara o
      // evento onChange, porque o navegador ve' que "nada mudou".
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Preview: mostra a imagem atual, ou um icone de "sem imagem"
            se o campo estiver vazio ou a URL nao carregar. */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary/30">
          {value && !previewFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview de URL arbitraria (upload ou caminho manual), next/image exigiria configurar domínios remotos sem necessidade aqui
            <img src={value} alt="Preview" className="h-full w-full object-cover [image-rendering:pixelated]" onError={() => setPreviewFailed(true)} />
          ) : (
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFileChange} className="hidden" id="image-upload-input" />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              {uploading ? t.uploading : t.chooseFile}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Images className="mr-1.5 h-3.5 w-3.5" />{t.library}
            </Button>
            {value && (
              <button type="button" onClick={() => onChange('')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-900/20 hover:text-red-400" title={t.removeImage}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t.formatsHint}</p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {note && <p className="text-xs text-emerald-400">{note}</p>}

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(m) => { onChange(m.url); setPreviewFailed(false); setError(null); setNote(t.idResolved.replace('{id}', String(m.id))); }}
      />

      {/* Campo manual por baixo - util pra colar um caminho existente
          (ex: /images/wiki/Larva.png) sem passar por upload. */}
      <Input
        value={value ?? ''}
        onChange={(e) => {
          onChange(e.target.value);
          setPreviewFailed(false);
          setError(null);
          setNote(null);
        }}
        onBlur={resolveRef}
        onKeyDown={(e) => { if (e.key === 'Enter' && parseImageRef(value ?? '') !== null) { e.preventDefault(); resolveRef(); } }}
        placeholder={t.manualPlaceholder}
        className="text-xs"
      />
    </div>
  );
}
