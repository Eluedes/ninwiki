// Proxy do Next.js (antigo "middleware"): roda ANTES de cada pagina do site e barra abuso.
//
//  1. Limite por IP: mais de WEB_RATE_LIMIT_PER_MINUTE paginas por minuto -> 429. Freia quem tenta
//     copiar a wiki inteira rapidamente (scraping) e floods que tentam derrubar o servidor.
//  2. Robos de copia conhecidos (curl, python-requests, scrapy, headless...) e requisicoes sem
//     User-Agent -> 403 (desligue com BLOCK_SCRAPER_UAS=false se usar algum monitor desse tipo).
//
// LIMITES HONESTOS: o conteudo publico precisa ser legivel por qualquer visitante, entao ninguem
// consegue impedir 100% a copia por um scraper decidido (que troca o User-Agent e o IP). O que
// isto faz e' tornar a copia em massa lenta e cara, e proteger o servidor. O limite e' por
// processo (memoria): com uma instancia so' - o caso de hoje - e' exato.
//
// O IP real vem de CF-Connecting-IP (Cloudflare) ou do ULTIMO X-Forwarded-For (o que o proxy mais
// proximo anexou; o que vem antes pode ser forjado pelo visitante).
import { NextResponse, type NextRequest } from 'next/server';
import { isUnderMaintenance } from '@/lib/maintenance';

const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.WEB_RATE_LIMIT_PER_MINUTE ?? 300);
// Prefetch: o Next adianta a busca das paginas dos links visiveis (uma visita normal gera dezenas). Contam em
// balde separado, com limite maior, para nao punir quem so' navega - mas tambem nao viram brecha ilimitada.
const PREFETCH_MULTIPLIER = 4;
const BLOCK_UAS = (process.env.BLOCK_SCRAPER_UAS ?? 'true') !== 'false';
const SCRAPER_UA =
  /(python-requests|python-urllib|aiohttp|httpx|scrapy|curl\/|wget|libwww|go-http-client|okhttp|java\/|node-fetch|axios|undici|headlesschrome|phantomjs|httrack|selenium|puppeteer|playwright|mj12bot|semrushbot|ahrefsbot|dotbot|bytespider|petalbot|gptbot|ccbot|claudebot|anthropic-ai|amazonbot|dataforseo)/i;

// IP -> instantes (ms) das ultimas requisicoes dentro da janela.
const hits = new Map<string, number[]>();

/** IP de quem chamou (ver comentario do arquivo sobre confianca nos cabecalhos). */
function clientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',').pop()!.trim();
  return 'unknown';
}

/** Registra a requisicao (balde `ip`, limite `limit`) e devolve quantos segundos esperar se estourou o limite (ou 0 se pode passar). */
function checkRate(ip: string, now: number, limit: number): number {
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) {
    hits.set(ip, list);
    return Math.max(1, Math.ceil((list[0] + WINDOW_MS - now) / 1000));
  }
  list.push(now);
  hits.set(ip, list);
  // Limpeza simples para o mapa nao crescer sem fim.
  if (hits.size > 10_000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  return 0;
}

/** Marca a resposta como "veio DESTE site" (cabecalho x-ninwiki-web): o Worker da Cloudflare (Cloudflare/maintenance-worker.js) so' mostra a pagina de manutencao quando ele NAO existe. */
function tag(res: NextResponse): NextResponse {
  res.headers.set('x-ninwiki-web', '1');
  return res;
}

/** Roda antes de cada pagina: bloqueia robos de copia conhecidos e aplica o limite por IP. */
export function proxy(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  if (BLOCK_UAS && (ua.length < 8 || SCRAPER_UA.test(ua))) {
    return tag(new NextResponse('Forbidden', { status: 403 }));
  }
  // Paginas em manutencao (lib/maintenance.ts): vai para /maintenance, mesmo digitando a URL.
  if (isUnderMaintenance(req.nextUrl.pathname)) {
    return tag(NextResponse.redirect(new URL('/maintenance', req.url)));
  }
  const isPrefetch = req.headers.has('next-router-prefetch') || req.headers.get('purpose') === 'prefetch';
  const ip = clientIp(req);
  const wait = isPrefetch
    ? checkRate(`${ip}|prefetch`, Date.now(), LIMIT * PREFETCH_MULTIPLIER)
    : checkRate(ip, Date.now(), LIMIT);
  if (wait > 0) {
    return tag(new NextResponse('Too many requests. Please try again shortly.', {
      status: 429,
      headers: { 'Retry-After': String(wait) },
    }));
  }
  return tag(NextResponse.next());
}

// Nao passa pelo proxy: arquivos internos do Next (JS/CSS do build), o favicon e os ARQUIVOS ESTATICOS da pasta public (imagens, fontes).
// Antes as imagens (/images/...) tambem contavam no limite por IP: uma pagina com muitas imagens estourava o limite e elas
// apareciam quebradas. O limite existe para PAGINAS (copia em massa), nao para cada figurinha.
export const config = {
  matcher: ['/((?!_next/static|_next/image|images/|favicon.ico|icon.png|robots.txt|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)'],
};
