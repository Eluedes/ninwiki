// Feed RSS do blog (/feed.xml): os 20 posts mais recentes que ja' estao no ar. Titulo e resumo sao escapados para XML.
import { listPosts } from '@/lib/api-client';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Escapa os caracteres especiais do XML (&, <, >, aspas) para o feed nunca quebrar nem injetar tags. */
function xml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Responde o RSS; sem API, devolve um feed vazio (nunca erro 500 para o leitor de feeds). */
export async function GET() {
  let items = '';
  try {
    const posts = (await listPosts('published')).slice(0, 20);
    items = posts
      .map((p) => {
        const when = new Date(p.publishedAt ?? p.createdAt).toUTCString();
        return `<item><title>${xml(p.title)}</title><link>${SITE}/blog/${xml(p.slug)}</link><guid>${SITE}/blog/${xml(p.slug)}</guid><pubDate>${when}</pubDate><description>${xml(p.excerpt)}</description></item>`;
      })
      .join('');
  } catch {
    // feed vazio
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Nin Online Brasil Wiki - Blog</title><link>${SITE}/blog</link><description>News, patch notes and updates from the Nin world.</description>${items}</channel></rss>`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

export const dynamic = 'force-dynamic';
