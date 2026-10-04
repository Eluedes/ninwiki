// Avisa a API quando o site quebra na tela do visitante (POST /client-errors) - assim a equipe fica sabendo
// (painel /admin/errors + canal de erros do Discord) em vez de depender de alguem reclamar.
//
// Seguranca/ruido: nunca levanta excecao (reportar erro nao pode causar outro erro), manda so' texto curto
// (mensagem, pagina, tipo) - nenhum cookie, dado de formulario ou stack completa - e repete no maximo
// MAX_PER_PAGE_LOAD relatos por carregamento de pagina, ignorando mensagens iguais.
import { API_URL } from '@/lib/api-client';

const MAX_PER_PAGE_LOAD = 5;
const sent = new Set<string>();

export type ClientErrorKind = 'render' | 'runtime' | 'network';

/** Envia o relato de um erro de tela para a API (silencioso: se falhar, nada acontece). */
export function reportClientError(message: string, kind: ClientErrorKind = 'render', digest?: string): void {
  try {
    const text = (message || 'Unknown error').slice(0, 500);
    const key = `${kind}|${text}`;
    if (sent.has(key) || sent.size >= MAX_PER_PAGE_LOAD) return;
    sent.add(key);
    void fetch(`${API_URL}/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, kind, path: window.location.pathname, digest: digest ?? null }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // reportar nunca pode quebrar a pagina
  }
}

/** True quando o erro e' "arquivo de codigo nao encontrado" - o navegador tem uma versao antiga do site depois de um deploy. */
export function isStaleChunkError(error: { name?: string; message?: string }): boolean {
  return error.name === 'ChunkLoadError' || /Loading chunk .* failed|Failed to load chunk|Failed to fetch dynamically imported module/i.test(error.message ?? '');
}

/**
 * Recarrega a pagina UMA vez (no maximo a cada 60s) quando o erro e' de versao antiga do site, para baixar o HTML novo.
 * Devolve true se mandou recarregar (nesse caso nao vale reportar: nao e' bug). Nunca levanta excecao.
 */
export function reloadOnStaleChunk(error: { name?: string; message?: string }): boolean {
  try {
    if (!isStaleChunkError(error)) return false;
    const last = Number(sessionStorage.getItem('ninwiki-chunk-reload') ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem('ninwiki-chunk-reload', String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
