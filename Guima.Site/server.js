'use strict';
/*
 * Guima.Site - servidor da pagina unica "em construcao".
 *
 * Feito para ser DIFICIL de derrubar e nao ter o que roubar:
 *  - Zero dependencias (nada de biblioteca de terceiros para ter falha) e nenhum banco / login / formulario / dado sigiloso.
 *  - Os arquivos de public/ sao carregados NA MEMORIA na partida (ja' comprimidos). Cada requisicao e' atendida so' com um
 *    lookup num mapa: nao toca no disco, entao nao existe "../" nem path traversal, e a resposta e' muito barata.
 *  - So' GET/HEAD; o resto recebe 405. URL longa -> 414. Cabecalhos grandes -> 431. Cliente lento -> conexao cortada (timeouts).
 *  - Limite de requisicoes por IP (janela de 1 min) com memoria LIMITADA: sob ataque a tabela nunca cresce sem fim.
 *  - Cabecalhos de seguranca (CSP restrita a si mesmo, HSTS, sem iframe, sem sniffing...).
 *  - Nenhum erro derruba o processo (uncaughtException/unhandledRejection apenas registram) e SIGTERM encerra com calma.
 *
 * HONESTIDADE: nenhum codigo sozinho segura um ataque de rede GIGANTE (DDoS volumetrico: o cano enche antes de chegar aqui).
 * Para isso, ponha a Cloudflare (gratis) na frente do dominio - ver README.md desta pasta.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 80);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
// Atras da SquareCloud/Cloudflare o IP real vem em cabecalho. Desligue (TRUST_PROXY=false) se rodar sem proxy.
const TRUST_PROXY = (process.env.TRUST_PROXY || 'true') !== 'false';
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 240);   // requisicoes por IP por minuto
const MAX_TRACKED_IPS = Number(process.env.MAX_TRACKED_IPS || 20000);  // teto da tabela de IPs (memoria limitada)
const MAX_URL_LENGTH = 2048;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.svg', '.txt']);

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Le tudo de public/ para a memoria: {url -> {type, etag, cache, raw, gzip, br}}. Roda uma vez, na partida. */
function loadSite() {
  const site = new Map();
  /** Percorre a pasta e registra cada arquivo permitido. */
  function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;                       // nada de arquivo oculto
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full, `${prefix}${entry.name}/`); continue; }
      const ext = path.extname(entry.name).toLowerCase();
      if (!TYPES[ext]) continue;                                      // so' tipos conhecidos
      const raw = fs.readFileSync(full);
      const compress = COMPRESSIBLE.has(ext) && raw.length > 512;
      site.set(`/${prefix}${entry.name}`, {
        type: TYPES[ext],
        etag: `"${crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 20)}"`,
        cache: ext === '.html' ? 'public, max-age=300' : 'public, max-age=86400',
        raw,
        gzip: compress ? zlib.gzipSync(raw, { level: 9 }) : null,
        br: compress ? zlib.brotliCompressSync(raw) : null,
      });
    }
  }
  walk(PUBLIC_DIR, '');
  site.set('/', site.get('/index.html'));
  return site;
}

const SITE = loadSite();
if (!SITE.get('/index.html')) { console.error('public/index.html nao encontrado'); process.exit(1); }
const NOT_FOUND = Buffer.from('<!doctype html><meta charset="utf-8"><title>404</title><body style="font-family:system-ui;background:#0b1020;color:#f5f6fb;display:grid;place-items:center;height:100vh;margin:0"><p>Essa página não existe. <a style="color:#ffd166" href="/">Voltar</a></p>');

// ---------------- limite por IP (memoria limitada) ----------------
const hits = new Map();   // ip -> {n, reset}

/** IP de quem chamou: CF-Connecting-IP (Cloudflare) ou o ULTIMO X-Forwarded-For (o que o proxy mais proximo anexou). */
function clientIp(req) {
  if (TRUST_PROXY) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.length < 64) return cf.trim();
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string') return xff.split(',').pop().trim().slice(0, 64);
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Conta a requisicao; devolve quantos segundos esperar se o IP passou do limite (ou 0 se esta' tudo bem). */
function limited(ip, now) {
  let e = hits.get(ip);
  if (!e || now >= e.reset) {
    if (!e && hits.size >= MAX_TRACKED_IPS) hits.delete(hits.keys().next().value);   // tabela cheia: descarta o mais antigo
    e = { n: 0, reset: now + 60_000 };
    hits.set(ip, e);
  }
  e.n += 1;
  return e.n > RATE_LIMIT ? Math.max(1, Math.ceil((e.reset - now) / 1000)) : 0;
}
setInterval(() => { const now = Date.now(); for (const [ip, e] of hits) if (now >= e.reset) hits.delete(ip); }, 30_000).unref();

// ---------------- respostas ----------------
/** Envia uma resposta pequena de erro (sempre com os cabecalhos de seguranca). */
function plain(res, status, text, extra = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text), ...extra });
  res.end(text);
}

/** Atende uma requisicao: valida metodo e URL, aplica o limite por IP e serve o arquivo da memoria. */
function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  if (!req.url || req.url.length > MAX_URL_LENGTH) return plain(res, 414, 'URI Too Long');
  const wait = limited(clientIp(req), Date.now());
  if (wait) return plain(res, 429, 'Too Many Requests', { 'Retry-After': String(wait) });

  let pathname;
  try { pathname = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch { return plain(res, 400, 'Bad Request'); }
  if (pathname.includes('\0') || pathname.includes('\\')) return plain(res, 400, 'Bad Request');
  if (pathname === '/health') return plain(res, 200, 'ok');

  const file = SITE.get(pathname);
  if (!file) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', 'Content-Length': NOT_FOUND.length });
    return res.end(req.method === 'HEAD' ? undefined : NOT_FOUND);
  }
  const accept = String(req.headers['accept-encoding'] || '');
  let body = file.raw, encoding = null;
  if (file.br && /\bbr\b/.test(accept)) { body = file.br; encoding = 'br'; }
  else if (file.gzip && /\bgzip\b/.test(accept)) { body = file.gzip; encoding = 'gzip'; }

  const headers = { ...SECURITY_HEADERS, 'Content-Type': file.type, 'Cache-Control': file.cache, ETag: file.etag, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === file.etag) { res.writeHead(304, headers); return res.end(); }
  headers['Content-Length'] = body.length;
  if (encoding) headers['Content-Encoding'] = encoding;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer({ maxHeaderSize: 8192, keepAlive: true }, (req, res) => {
  try { handle(req, res); } catch (err) { console.error('erro ao atender:', err && err.message); if (!res.headersSent) plain(res, 500, 'Internal Server Error'); else res.destroy(); }
});
// Clientes lentos/maliciosos (slowloris): cabecalhos e corpo tem pouco tempo; conexoes ociosas caem logo.
server.headersTimeout = 10_000;
server.requestTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 200;
server.maxConnections = Number(process.env.MAX_CONNECTIONS || 4000);
server.on('clientError', (err, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); else socket.destroy(); });

// Nada derruba o processo: registra e segue.
process.on('uncaughtException', (err) => console.error('excecao nao tratada:', err && err.message));
process.on('unhandledRejection', (err) => console.error('promessa rejeitada:', err && err.message));
/** Encerramento limpo (a SquareCloud manda SIGTERM ao reiniciar). */
function shutdown() { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`Guima.Site no ar em http://${HOST}:${PORT} (${SITE.size - 1} arquivos em memoria)`));
}
module.exports = { server, handle, SITE };
