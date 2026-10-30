// Configuracao do Next.js (NinWiki.Web): opcoes de build, imagens remotas e cabecalhos.
/** @type {import('next').NextConfig} */

// Endereco da API: entra na politica de seguranca (CSP) para o navegador so' conversar com ele.
const isDev = process.env.NODE_ENV !== 'production';

// A Content-Security-Policy NAO fica aqui: ela leva um nonce novo a cada requisicao e por isso e' montada no proxy.ts (a partir de lib/csp.ts).

const nextConfig = {
  // O projeto ainda não usa a otimização de imagens do Next. Além de
  // preservar o comportamento atual, isso evita processar imagens não
  // confiáveis no servidor até existir uma política de upload completa.
  images: { unoptimized: true },

  // Build "standalone" (so' no deploy automatico: o workflow define STANDALONE_BUILD=true). O site e' COMPILADO no GitHub
  // (que tem memoria de sobra) e a SquareCloud so' RODA o resultado (`node server.js`, ~200 MB) - compilar la' estoura a RAM
  // e o processo morre com "Killed". Localmente (npm run dev / build / start) nada muda.
  // outputFileTracingRoot fixa a raiz do rastreio nesta pasta (senao um package-lock.json em outra pasta muda a estrutura gerada).
  ...(process.env.STANDALONE_BUILD === 'true' ? { output: 'standalone', outputFileTracingRoot: __dirname } : {}),

  // Nao anuncia "X-Powered-By: Next.js" (menos informacao para quem faz varredura de versoes vulneraveis).
  poweredByHeader: false,

  // /jutsus (sem id) nao tem pagina propria: os jutsus ficam dentro das masteries. Em vez de 404, leva para a lista.
  // /catalog/missions: as missoes sairam do Guia e ganharam secao propria (/missions); a URL antiga continua funcionando.
  async redirects() {
    return [
      { source: '/jutsus', destination: '/masteries', permanent: false },
      { source: '/catalog/missions', destination: '/missions', permanent: true },
    ];
  },

  // Cabeçalhos aplicados a todas as páginas para reduzir superfícies comuns
  // de clickjacking, MIME sniffing e vazamento de dados pelo navegador.
  async headers() {
    const base = [
      { key: 'X-NinWiki-Web', value: '1' },   // marca "veio deste site": o Worker da Cloudflare (Cloudflare/maintenance-worker.mjs) mostra a pagina de manutencao quando ele some
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ];
    // HSTS: depois da primeira visita o navegador so' acessa o site por HTTPS (so' em producao).
    if (!isDev) base.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    return [
      { source: '/:path*', headers: base },
      // Painel e login: nunca indexar nem guardar em cache.
      ...['/admin/:path*', '/login'].map((source) => ({
        source,
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      })),
    ];
  },
};

module.exports = nextConfig;
