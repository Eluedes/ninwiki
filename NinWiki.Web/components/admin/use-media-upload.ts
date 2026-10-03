'use client';

// Envio de varias imagens para o banco de imagens (escolhidas no seletor OU soltas com arrastar-e-soltar).
// Ignora o que nao e' imagem, envia 3 por vez, mostra o andamento ("Enviando 2/5") e junta os erros por arquivo -
// uma imagem com problema nao cancela as outras.

import { useCallback, useState } from 'react';
import { ApiError, uploadMedia, type ApiMedia } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';

const ACCEPTED = /^image\/(png|jpeg|gif|webp)$/;
const PARALLEL = 3;

export interface UploadState {
  busy: boolean;
  done: number;
  total: number;
  errors: string[];
  skipped: number;
}

/** Hook de envio em lote: `upload(files)` devolve as imagens criadas; `state` alimenta a barra de andamento e os avisos. */
export function useMediaUpload() {
  const { dict } = useLanguage();
  const t = dict.admin.mediaPage;
  const [state, setState] = useState<UploadState>({ busy: false, done: 0, total: 0, errors: [], skipped: 0 });

  const upload = useCallback(async (files: File[]): Promise<ApiMedia[]> => {
    const images = files.filter((f) => ACCEPTED.test(f.type));
    const skipped = files.length - images.length;
    if (images.length === 0) {
      setState({ busy: false, done: 0, total: 0, errors: [], skipped });
      return [];
    }
    setState({ busy: true, done: 0, total: images.length, errors: [], skipped });
    const created: ApiMedia[] = [];
    const errors: string[] = [];
    let next = 0;
    let done = 0;
    /** Um "trabalhador": pega o proximo arquivo da fila ate' acabar. */
    async function worker() {
      while (next < images.length) {
        const file = images[next++];
        try {
          created.push(await uploadMedia(file));
        } catch (err) {
          errors.push(t.failedFile.replace('{name}', file.name).replace('{error}', err instanceof ApiError ? err.message : '?'));
        }
        done += 1;
        setState((s) => ({ ...s, done }));
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, images.length) }, worker));
    setState({ busy: false, done, total: images.length, errors, skipped });
    return created;
  }, [t.failedFile]);

  return { state, upload };
}
