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
