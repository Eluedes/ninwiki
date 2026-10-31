// Proxy do Next.js (antigo "middleware"): roda ANTES de cada pagina do site e barra abuso.
//
//  1. Limite por IP: mais de WEB_RATE_LIMIT_PER_MINUTE paginas por minuto -> 429. Freia quem tenta
//     copiar a wiki inteira rapidamente (scraping) e floods que tentam derrubar o servidor.
//  2. Robos de copia conhecidos (curl, python-requests, scrapy, headless...) e requisicoes sem
//     User-Agent -> 403 (desligue com BLOCK_SCRAPER_UAS=false se usar algum monitor desse tipo).
//  4. CSP com NONCE: gera um nonce novo a cada pagina, monta o cabecalho Content-Security-Policy (lib/csp.ts) e o repassa ao Next.js (cabecalhos
//     x-nonce e Content-Security-Policy da requisicao) - assim os scripts do Next e o do tema levam o nonce e NENHUM script inline sem nonce roda.
//  0. ENDERECO ANTIGO: pedidos cujo Host esta' em LEGACY_SITE_HOSTS (lista separada por virgula, so' no servidor; vazia = desligado) levam um
//     redirecionamento 308 para o MESMO caminho e query na origem de NEXT_PUBLIC_SITE_URL. Nunca redireciona /health, /api e arquivos internos do Next.
//  3. MODO MANUTENCAO (ligado pelo S.Adm em /admin/maintenance): quem nao tem o cookie do passe (ninwiki_pass, valido na API) ve' a pagina de
//     manutencao no lugar da pagina pedida (status 503, a URL nao muda). /maintenance, /login, /admin e a rota do passe ficam abertos para a equipe
//     poder entrar. Se a API nao responder, o site continua aberto (nunca tranca todo mundo por um soluco da API).
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
import { buildCsp } from '@/lib/csp';

const WINDOW_MS = 60_000;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const PASS_COOKIE = 'ninwiki_pass';
const STATUS_TTL_MS = 5_000;    // quanto tempo vale a ultima resposta de "esta' em manutencao?" (liga/desliga leva ate' ~5 s para valer)
const PASS_TTL_MS = 30_000;     // quanto tempo vale a conferencia de um passe
// Caminhos que continuam abertos com a manutencao ligada (a equipe precisa deles para entrar).
const MAINTENANCE_OPEN = ['/maintenance', '/maintenance-pass', '/login', '/admin'];
const LIMIT = Number(process.env.WEB_RATE_LIMIT_PER_MINUTE ?? 300);
// Prefetch: o Next adianta a busca das paginas dos links visiveis (uma visita normal gera dezenas). Contam em
// balde separado, com limite maior, para nao punir quem so' navega - mas tambem nao viram brecha ilimitada.
const PREFETCH_MULTIPLIER = 4;
const BLOCK_UAS = (process.env.BLOCK_SCRAPER_UAS ?? 'true') !== 'false';
const SCRAPER_UA =
  /(python-requests|python-urllib|aiohttp|httpx|scrapy|curl\/|wget|libwww|go-http-client|okhttp|java\/|node-fetch|axios|undici|headlesschrome|phantomjs|httrack|selenium|puppeteer|playwright|mj12bot|semrushbot|ahrefsbot|dotbot|bytespider|petalbot|gptbot|ccbot|claudebot|anthropic-ai|amazonbot|dataforseo)/i;

// Enderecos ANTIGOS do site (ex.: wiki.guima.net) e origem NOVA (NEXT_PUBLIC_SITE_URL). Sem lista = sem redirecionamento.
const LEGACY_HOSTS = (process.env.LEGACY_SITE_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
const SITE_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').origin; } catch { return ''; }
})();
// Caminhos que nunca sao redirecionados (monitor de saude, rotas internas).
const NO_REDIRECT = ['/health', '/api', '/_next'];

/** Se o Host do pedido e' um endereco antigo, devolve o 308 para a origem nova (mesmo caminho e query); senao null. */
function legacyRedirect(req: NextRequest): NextResponse | null {
  if (!LEGACY_HOSTS.length || !SITE_ORIGIN) return null;
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  if (!LEGACY_HOSTS.includes(host) || host === new URL(SITE_ORIGIN).hostname) return null;   // a 2a condicao evita laco de redirecionamento
  const path = req.nextUrl.pathname;
  if (NO_REDIRECT.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return NextResponse.redirect(`${SITE_ORIGIN}${path}${req.nextUrl.search}`, 308);
}

// Cache em memoria do estado da manutencao e da conferencia dos passes.
let statusCache: { at: number; on: boolean } | null = null;
const passCache = new Map<string, { at: number; ok: boolean }>();

/** O site esta' em manutencao? Pergunta a' API (resposta guardada por alguns segundos). Falha da API = nao (site aberto). */
async function maintenanceOn(now: number): Promise<boolean> {
  if (statusCache && now - statusCache.at < STATUS_TTL_MS) return statusCache.on;
  try {
    const res = await fetch(`${API_URL}/site/status`, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    const on = res.ok ? Boolean((await res.json()).maintenance) : (statusCache?.on ?? false);
    statusCache = { at: now, on };
    return on;
  } catch {
    statusCache = { at: now, on: statusCache?.on ?? false };   // API fora do ar: mantem o ultimo estado conhecido (padrao: aberto)
    return statusCache.on;
  }
}

/** O passe (cookie) e' valido na API? Resposta guardada por 30 s por passe (o mapa e' limpo quando passa de 500 entradas). */
async function passValid(token: string, now: number): Promise<boolean> {
  const cached = passCache.get(token);
  if (cached && now - cached.at < PASS_TTL_MS) return cached.ok;
  let ok = false;
  try {
    const res = await fetch(`${API_URL}/site/status`, { headers: { 'X-Maintenance-Pass': token }, cache: 'no-store', signal: AbortSignal.timeout(2000) });
    ok = res.ok && Boolean((await res.json()).access);
  } catch {
    ok = cached?.ok ?? false;
  }
  if (passCache.size > 500) passCache.clear();
  passCache.set(token, { at: now, ok });
  return ok;
}

// IP -> instantes (ms) das ultimas requisicoes dentro da janela.
const hits = new Map<string, number[]>();
let lastSweep = 0;   // quando foi a ultima limpeza do mapa acima

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
  // Limpeza para o mapa nao crescer sem fim: no maximo 1x por minuto (ou na hora, se passar de 2.000 IPs), apaga quem ja' saiu da janela.
  if (now - lastSweep >= WINDOW_MS || hits.size > 2_000) {
    lastSweep = now;
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
export async function proxy(req: NextRequest) {
  // Nonce desta requisicao + CSP; vai tanto na resposta (navegador) quanto na requisicao (o Next le' para colocar o nonce nos seus scripts).
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const forwarded = new Headers(req.headers);
  forwarded.set('x-nonce', nonce);
  forwarded.set('Content-Security-Policy', csp);
  /** Marca a resposta (x-ninwiki-web) e poe a CSP nela. */
  const page = (res: NextResponse): NextResponse => {
    res.headers.set('Content-Security-Policy', csp);
    return tag(res);
  };
  // Endereco antigo -> novo, antes de qualquer outra regra (o robo/visitante so' precisa saber para onde ir).
  const legacy = legacyRedirect(req);
  if (legacy) return tag(legacy);
  const ua = req.headers.get('user-agent') ?? '';
  if (BLOCK_UAS && (ua.length < 8 || SCRAPER_UA.test(ua))) {
    return tag(new NextResponse('Forbidden', { status: 403 }));
  }
  // Manutencao do SITE inteiro: sem passe valido, mostra a pagina de manutencao (503) no lugar da pagina pedida.
  const path = req.nextUrl.pathname;
  const open = MAINTENANCE_OPEN.some((p) => path === p || path.startsWith(`${p}/`));
  if (!open) {
    const now = Date.now();
    if (await maintenanceOn(now)) {
      const pass = req.cookies.get(PASS_COOKIE)?.value;
      if (!pass || !(await passValid(pass, now))) {
        return page(NextResponse.rewrite(new URL('/maintenance', req.url), { status: 503, headers: { 'Retry-After': '300' }, request: { headers: forwarded } }));
      }
    }
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
  return page(NextResponse.next({ request: { headers: forwarded } }));
}

// Nao passa pelo proxy: arquivos internos do Next (JS/CSS do build), o favicon e os ARQUIVOS ESTATICOS da pasta public (imagens, fontes).
// Antes as imagens (/images/...) tambem contavam no limite por IP: uma pagina com muitas imagens estourava o limite e elas
// apareciam quebradas. O limite existe para PAGINAS (copia em massa), nao para cada figurinha.
export const config = {
  matcher: ['/((?!_next/static|_next/image|images/|favicon.ico|icon.png|robots.txt|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)'],
};
