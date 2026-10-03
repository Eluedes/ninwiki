// Testes do Worker de manutencao (sem bibliotecas): node --test Cloudflare/testar_worker.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { PAGE } from './maintenance-worker.mjs';

const req = (accept = 'text/html', method = 'GET') => new Request('https://wiki.example/x', { method, headers: { accept } });
const withFetch = async (impl, fn) => { const old = globalThis.fetch; globalThis.fetch = impl; try { return await fn(); } finally { globalThis.fetch = old; } };

test('site no ar (com o cabecalho do NinWiki): repassa a resposta', async () => {
  const ok = new Response('home', { status: 200, headers: { 'x-ninwiki-web': '1' } });
  const res = await withFetch(async () => ok, () => worker.fetch(req(), {}));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'home');
});
test('404/429 DO SITE (com o cabecalho) passam como estao', async () => {
  for (const status of [404, 429, 403]) {
    const res = await withFetch(async () => new Response('x', { status, headers: { 'x-ninwiki-web': '1' } }), () => worker.fetch(req(), {}));
    assert.equal(res.status, status);
  }
});
test('erro da hospedagem sem o cabecalho (502, 404, 200 de outro servidor) -> pagina de manutencao 503', async () => {
  for (const status of [502, 503, 404, 200]) {
    const res = await withFetch(async () => new Response('Application not found', { status }), () => worker.fetch(req(), {}));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('retry-after'), '30');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok((await res.text()).includes('updating the wiki'));
  }
});
test('conexao falhou -> pagina de manutencao', async () => {
  const res = await withFetch(async () => { throw new TypeError('fetch failed'); }, () => worker.fetch(req(), {}));
  assert.equal(res.status, 503);
});
test('pedido que nao quer HTML (imagem, JSON) recebe texto curto 503', async () => {
  const res = await withFetch(async () => new Response('x', { status: 502 }), () => worker.fetch(req('image/png'), {}));
  assert.equal(res.status, 503);
  assert.match(res.headers.get('content-type'), /text\/plain/);
});
test('HEAD nao devolve corpo', async () => {
  const res = await withFetch(async () => new Response('x', { status: 502 }), () => worker.fetch(req('text/html', 'HEAD'), {}));
  assert.equal(res.status, 503);
  assert.equal(await res.text(), '');
});
test('MAINTENANCE_FORCE=1 mostra a pagina mesmo com o site no ar (e nem chama o site)', async () => {
  let called = false;
  const res = await withFetch(async () => { called = true; return new Response('x', { headers: { 'x-ninwiki-web': '1' } }); }, () => worker.fetch(req(), { MAINTENANCE_FORCE: '1' }));
  assert.equal(res.status, 503);
  assert.equal(called, false);
});
test('MAINTENANCE_DISABLE=1 passa tudo direto, ate mesmo erros', async () => {
  const res = await withFetch(async () => new Response('Application not found', { status: 502 }), () => worker.fetch(req(), { MAINTENANCE_DISABLE: '1' }));
  assert.equal(res.status, 502);
});
test('a pagina se recarrega quando o site volta (confere o cabecalho) e tem PT e EN', () => {
  assert.ok(PAGE.includes("r.headers.get('x-ninwiki-web')") && PAGE.includes('location.reload()'));
  assert.ok(PAGE.includes('Estamos atualizando a wiki') && PAGE.includes('We are updating the wiki'));
  assert.ok(!/https?:\/\/(?!www\.w3)/.test(PAGE.replace(/\$\{MARKER\}/g, '')), 'a pagina nao pode depender de nada externo');
});
