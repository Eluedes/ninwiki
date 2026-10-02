// Testes do Guima.Site (sem bibliotecas: node:test). Rode com `npm test` dentro da pasta Guima.Site.
// Sobem o servidor numa porta livre e conferem: paginas, cabecalhos de seguranca, metodos, path traversal, limite por IP.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createRequire } from 'node:module';

process.env.RATE_LIMIT_PER_MINUTE = '30';
process.env.TRUST_PROXY = 'true';
const require = createRequire(import.meta.url);
const { server } = require('../server.js');

let base = '';
let port = 0;
test.before(async () => {
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});
test.after(() => { server.closeAllConnections?.(); server.close(); });

let ipCounter = 0;
/** GET com um IP "diferente" a cada chamada (cabecalho X-Forwarded-For), para nao esbarrar no limite entre testes. */
const get = (p, headers = {}, method = 'GET') => fetch(base + p, { method, redirect: 'manual', headers: { 'x-forwarded-for': `198.51.100.${(ipCounter++ % 250) + 1}`, ...headers } });

/** Manda a linha de requisicao CRUA (sem a normalizacao do fetch), para testar "../" de verdade. */
function raw(requestPath) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1', () => s.write(`GET ${requestPath} HTTP/1.1\r\nHost: x\r\nX-Forwarded-For: 203.0.113.${(ipCounter++ % 250) + 1}\r\nConnection: close\r\n\r\n`));
    let data = '';
    s.on('data', (d) => { data += d; });
    s.on('close', () => resolve(data));
  });
}

test('a pagina inicial abre e tem a frase', async () => {
  const r = await get('/');
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(html, /Construindo e realizando/);
});

test('arquivos estaticos existem', async () => {
  for (const p of ['/style.css', '/app.js', '/favicon.svg']) assert.equal((await get(p)).status, 200, p);
});

test('cabecalhos de seguranca em toda resposta', async () => {
  for (const p of ['/', '/style.css', '/nao-existe', '/health']) {
    const r = await get(p);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'.*frame-ancestors 'none'/, p);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', p);
    assert.equal(r.headers.get('x-frame-options'), 'DENY', p);
    assert.match(r.headers.get('strict-transport-security'), /max-age=/, p);
    assert.equal(r.headers.get('x-powered-by'), null, p);
  }
});

test('compressao e ETag', async () => {
  const br = await get('/style.css', { 'accept-encoding': 'br' });
  assert.equal(br.headers.get('content-encoding'), 'br');
  const gz = await get('/app.js', { 'accept-encoding': 'gzip' });
  assert.equal(gz.headers.get('content-encoding'), 'gzip');
  const first = await get('/');
  const again = await get('/', { 'if-none-match': first.headers.get('etag') });
  assert.equal(again.status, 304);
});

test('so GET e HEAD; HEAD nao traz corpo', async () => {
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const r = await get('/', {}, m);
    assert.equal(r.status, 405, m);
    assert.equal(r.headers.get('allow'), 'GET, HEAD');
  }
  const h = await get('/', {}, 'HEAD');
  assert.equal(h.status, 200);
  assert.equal((await h.text()).length, 0);
});

test('path traversal e arquivos internos nunca sao entregues', async () => {
  for (const p of ['/../server.js', '/%2e%2e/server.js', '/..%2fserver.js', '/server.js', '/package.json', '/.env', '/scripts/testar_site.mjs', '/public/index.html//..', '/%00', '/..\\server.js']) {
    const out = await raw(p);
    assert.doesNotMatch(out, /require\('node:http'\)|"name": "guima-site"|HTTP\/1\.1 200/, p);
  }
});

test('URL longa (414) e codificacao quebrada (400)', async () => {
  assert.equal((await get('/' + 'a'.repeat(3000))).status, 414);
  const out = await raw('/%E0%A4%A');
  assert.match(out, /^HTTP\/1\.1 400/);
});

test('limite por IP: passou do teto recebe 429 com Retry-After; outro IP segue normal', async () => {
  const ip = { 'x-forwarded-for': '192.0.2.99' };
  let last;
  for (let i = 0; i < 31; i++) last = await fetch(base + '/', { headers: ip });
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get('retry-after')) >= 1);
  assert.equal((await get('/')).status, 200);
});
