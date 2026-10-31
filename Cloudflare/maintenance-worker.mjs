// Pagina de MANUTENCAO do site (Cloudflare Worker): aparece SOZINHA quando o app do Web na SquareCloud esta' fora do ar (ex.: voce apagou os arquivos para
// atualizar) e some SOZINHA quando o deploy termina. Nao precisa ligar/desligar nada.
//
// COMO FUNCIONA: o Worker fica NA FRENTE do dominio do site. Para cada pedido ele chama o app de verdade; se a resposta trouxer o cabecalho
// `x-ninwiki-web` (que SO' o site NinWiki.Web coloca, em toda resposta), repassa. Se nao trouxer (app apagado/parado, erro da hospedagem, texto de erro
// da SquareCloud) ou se a conexao falhar, responde com esta pagina (HTTP 503 + Retry-After, para o bot e o Google entenderem que e' temporario).
// A pagina se recarrega sozinha assim que o site volta.
//
// CHAVES DE EMERGENCIA (Worker > Settings > Variables): MAINTENANCE_FORCE=1 mostra a pagina SEMPRE (manutencao manual);
// MAINTENANCE_DISABLE=1 desliga o Worker (passa tudo direto). Passo a passo: Cloudflare/README.md.

const MARKER = 'x-ninwiki-web';

/** HTML da pagina de manutencao (autocontido: nada externo, para funcionar mesmo com todo o resto fora do ar). Texto em PT ou EN conforme o navegador. */
export const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Nin Codex — Updating</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e5e9f5;
    background:radial-gradient(1200px 600px at 50% -10%,#16234a 0%,#0b1020 55%,#070a14 100%)}
  main{max-width:560px;text-align:center}
  .logo{font-size:44px;line-height:1;margin-bottom:10px}
  h1{font-size:clamp(26px,5vw,36px);margin:8px 0 12px;letter-spacing:-.02em}
  p{margin:0 0 10px;color:#a8b3d1;line-height:1.55}
  .bar{margin:28px auto 8px;width:min(320px,80%);height:6px;border-radius:99px;background:#1b2542;overflow:hidden}
  .bar i{display:block;height:100%;width:40%;border-radius:99px;background:linear-gradient(90deg,#3b82f6,#60a5fa);animation:slide 1.4s ease-in-out infinite}
  @keyframes slide{0%{transform:translateX(-110%)}100%{transform:translateX(280%)}}
  small{color:#6f7ba0}
  @media (prefers-reduced-motion:reduce){.bar i{animation:none;width:100%}}
</style></head>
<body><main>
  <div class="logo">🥷</div>
  <h1 id="t">We are updating the wiki</h1>
  <p id="d">A new version is being published. This page reloads by itself as soon as the site is back — usually in a couple of minutes.</p>
  <div class="bar" aria-hidden="true"><i></i></div>
  <small id="s">Nin Codex</small>
</main>
<script>
  var pt=/^pt/i.test(navigator.language||'');
  if(pt){document.documentElement.lang='pt-BR';document.title='Nin Codex — Atualizando';
    document.getElementById('t').textContent='Estamos atualizando a wiki';
    document.getElementById('d').textContent='Uma nova versão está sendo publicada. Esta página recarrega sozinha assim que o site voltar — geralmente em poucos minutos.';}
  // a cada 10 s pergunta ao site: quando a resposta trouxer o cabecalho do site de verdade, recarrega.
  setInterval(function(){
    fetch(location.pathname+'?_='+Date.now(),{cache:'no-store',headers:{Accept:'text/html'}})
      .then(function(r){if(r.headers.get('${MARKER}')){location.reload();}}).catch(function(){});
  },10000);
</script></body></html>`;

/** Resposta de manutencao: 503 + Retry-After + sem cache. Pedidos que nao querem HTML (imagens, JSON) recebem so' um texto curto. */
export function maintenance(request) {
  const headers = { 'Retry-After': '30', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  const wantsHtml = (request.headers.get('accept') || '').includes('text/html');
  if (!wantsHtml) return new Response(request.method === 'HEAD' ? null : 'Service temporarily unavailable (maintenance).', { status: 503, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(request.method === 'HEAD' ? null : PAGE, { status: 503, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * Arquivo estatico de verdade (imagem, fonte, CSS, JS, video, audio) respondido com sucesso: passa mesmo sem o cabecalho do site.
 * Motivo: o Next nem sempre coloca `x-ninwiki-web` ao servir um arquivo da pasta public; sem isto a figura (ou a URL aberta no navegador)
 * virava a pagina de manutencao. Erro da hospedagem NUNCA tem esse tipo de conteudo (e' texto/HTML/JSON), entao a protecao continua valendo.
 */
export function isStaticAsset(response) {
  if (response.status !== 200 && response.status !== 304) return false;
  return /^(image|font|video|audio)\/|^text\/css|javascript|^application\/(octet-stream|wasm)/i.test(response.headers.get('content-type') || '');
}

export default {
  /** Repassa o pedido ao site; se o site nao responder "como o NinWiki" (ou cair), mostra a pagina de manutencao. */
  async fetch(request, env) {
    if (env && env.MAINTENANCE_DISABLE === '1') return fetch(request);
    if (env && env.MAINTENANCE_FORCE === '1') return maintenance(request);
    let response;
    try {
      response = await fetch(request);
    } catch {
      return maintenance(request);
    }
    return response.headers.has(MARKER) || isStaticAsset(response) ? response : maintenance(request);
  },
};
