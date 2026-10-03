// GET /version: a atualizacao publicada no site (sha curto, titulo e data do commit). O workflow de deploy grava o VERSION.json na raiz do pacote;
// o bot do Discord le' isto e edita a mensagem "ultima atualizacao" a cada deploy. Publico de proposito e so' com dados nao sensiveis
// (hash e titulo da atualizacao); sem o arquivo (desenvolvimento) responde "dev".
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

/** Le o VERSION.json do pacote e devolve {sha, message, date}. */
export async function GET(): Promise<Response> {
  let info = { sha: (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7), message: '', date: '' };
  try {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), 'VERSION.json'), 'utf-8')) as Record<string, unknown>;
    info = { sha: String(raw.sha ?? '').slice(0, 7) || info.sha, message: String(raw.message ?? '').slice(0, 200), date: String(raw.date ?? '').slice(0, 40) };
  } catch {
    // sem arquivo: usa o sha embutido no build (ou "dev")
  }
  return Response.json(info, { headers: { 'Cache-Control': 'no-store' } });
}
