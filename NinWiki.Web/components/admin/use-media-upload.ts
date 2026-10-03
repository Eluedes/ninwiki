'use client';

// Envio de varias imagens para o banco de imagens (escolhidas no seletor OU soltas com arrastar-e-soltar).
// Ignora o que nao e' imagem, envia 3 por vez, mostra o andamento ("Enviando 2/5") e junta os erros por arquivo -
// uma imagem com problema nao cancela as outras. Os envios sao espacados (abaixo do limite da API); 429 espera o tempo que a API pediu e
// falhas de rede/5xx tentam de novo; o que ainda falhar fica em `failed` para o botao 'Tentar de novo'.

import { useCallback, useState } from 'react';
import { ApiError, MEDIA_CATEGORIES, uploadMedia, type ApiMedia } from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';

const ACCEPTED = /^image\/(png|jpeg|gif|webp)$/;
const PARALLEL = 3;
const MIN_GAP_MS = 150;   // intervalo minimo entre dois envios (todos os "trabalhadores" juntos): ~400/min, abaixo do limite da API (600/min)
const MAX_RETRIES = 8;

/**
 * Nome e categoria de um arquivo: "weapon__sword_2.png" -> categoria weapon, nome sword_2 (formato que o script imagens_em_folhas.py gera).
 * Sem o prefixo "categoria__", o nome e' o do arquivo sem extensao (ate' 80 caracteres) e a categoria e' a escolhida na tela.
 */
function describeFile(file: File, fallbackCategory: string): { name: string; category: string } {
  const stem = file.name.replace(/\.[^.]+$/, '');
  const m = /^([a-z]+)__(.+)$/i.exec(stem);
  if (m && (MEDIA_CATEGORIES as readonly string[]).includes(m[1].toLowerCase())) {
    return { name: m[2].slice(0, 80), category: m[1].toLowerCase() };
  }
  return { name: stem.slice(0, 80), category: fallbackCategory };
}

/** Segundos que a API pediu para esperar ("Try again in N seconds."), ou 0 se a mensagem nao diz. */
function waitFromMessage(message: string): number {
  const m = /in (\d+) seconds?/i.exec(message);
  return m ? Number(m[1]) : 0;
}

/** Envia uma imagem; 429 (limite) espera o tempo que a API pediu, e falha de rede/5xx tenta de novo com espera crescente. */
async function uploadWithRetry(file: File, fallbackCategory: string): Promise<ApiMedia> {
  const { name, category } = describeFile(file, fallbackCategory);
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadMedia(file, name, category);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const transient = status === 429 || status === 0 || status === 502 || status === 503 || status === 504;
      if (!transient || attempt >= MAX_RETRIES) throw err;
      const wait = status === 429 && err instanceof ApiError ? Math.max(waitFromMessage(err.message), 2) : 3 * (attempt + 1);
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    }
  }
}

export interface UploadState {
  busy: boolean;
  done: number;
  total: number;
  errors: string[];
  skipped: number;
  failed: File[];   // arquivos que falharam mesmo apos as tentativas (para o botao 'Tentar de novo')
}

/** Hook de envio em lote: `upload(files)` devolve as imagens criadas; `state` alimenta a barra de andamento e os avisos. */
export function useMediaUpload() {
  const { dict } = useLanguage();
  const t = dict.admin.mediaPage;
  const [state, setState] = useState<UploadState>({ busy: false, done: 0, total: 0, errors: [], skipped: 0, failed: [] });

  const upload = useCallback(async (files: File[], defaultCategory = ''): Promise<ApiMedia[]> => {
    const images = files.filter((f) => ACCEPTED.test(f.type));
    const skipped = files.length - images.length;
    if (images.length === 0) {
      setState({ busy: false, done: 0, total: 0, errors: [], skipped, failed: [] });
      return [];
    }
    setState({ busy: true, done: 0, total: images.length, errors: [], skipped, failed: [] });
    const created: ApiMedia[] = [];
    const errors: string[] = [];
    const failed: File[] = [];
    let next = 0;
    let nextStart = 0;
    let aborted = false;   // sessao vencida/sem permissao: para o lote todo (nao adianta tentar as outras)
    let done = 0;
    /** Um "trabalhador": pega o proximo arquivo da fila ate' acabar. */
    async function worker() {
      while (next < images.length && !aborted) {
        const file = images[next++];
        const now = Date.now();   // espaca os envios (sem 'rajada' que estoura o limite)
        const startAt = Math.max(now, nextStart);
        nextStart = startAt + MIN_GAP_MS;
        if (startAt > now) await new Promise((r) => setTimeout(r, startAt - now));
        try {
          created.push(await uploadWithRetry(file, defaultCategory));
        } catch (err) {
          failed.push(file);
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) aborted = true;
          errors.push(t.failedFile.replace('{name}', file.name).replace('{error}', err instanceof ApiError ? err.message : '?'));
        }
        done += 1;
        setState((s) => ({ ...s, done }));
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, images.length) }, worker));
    if (aborted) failed.push(...images.slice(next));   // o que nem foi tentado tambem fica para 'Tentar de novo'
    setState({ busy: false, done, total: images.length, errors, skipped, failed });
    return created;
  }, [t.failedFile]);

  return { state, upload };
}
