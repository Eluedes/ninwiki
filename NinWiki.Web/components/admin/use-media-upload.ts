'use client';

// Envio de varias imagens para o banco de imagens (escolhidas no seletor OU soltas com arrastar-e-soltar).
// Ignora o que nao e' imagem, envia 3 por vez, mostra o andamento ("Enviando 2/5") e junta os erros por arquivo -
// uma imagem com problema nao cancela as outras. Se a API pedir calma (429, limite por minuto), espera e tenta de novo (ate' 4 vezes).

import { useCallback, useState } from 'react';
import { ApiError, uploadMedia, type ApiMedia } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';

const ACCEPTED = /^image\/(png|jpeg|gif|webp)$/;
const PARALLEL = 3;
const MAX_RETRIES = 4;
const RETRY_WAIT_MS = 6000;

/** Envia uma imagem; se a API responder 429 (limite de pedidos), espera um pouco e tenta de novo. */
async function uploadWithRetry(file: File): Promise<ApiMedia> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadMedia(file);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429 && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_WAIT_MS * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

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
          created.push(await uploadWithRetry(file));
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
