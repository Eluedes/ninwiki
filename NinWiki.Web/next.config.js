// Configuracao do Next.js (NinWiki.Web): opcoes de build, imagens remotas e cabecalhos.
/** @type {import('next').NextConfig} */

// Endereco da API: entra na politica de seguranca (CSP) para o navegador so' conversar com ele.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy: diz ao navegador DE ONDE a pagina pode carregar scripts, imagens e dados.
// Mesmo que alguem consiga injetar um <script> ou um <iframe>, o navegador recusa executar.
//  - script-src: 'unsafe-inline' e' necessario pro Next.js (scripts de inicializacao inline); 'unsafe-eval' so' no dev.
//  - img-src: o proprio site, a API (uploads) e qualquer https (o painel aceita colar URL de imagem).
//  - connect-src: so' o site e a API. frame-ancestors 'none': ninguem embute o site num iframe (anti-clickjacking).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${API_URL}`,
  "font-src 'self' data:",
  `connect-src 'self' ${API_URL}${isDev ? ' ws:' : ''}`,
  // Videos do blog: so' os players oficiais (YouTube no modo sem cookies e Twitch). Nenhum outro iframe e' permitido.
  "frame-src https://www.youtube-nocookie.com https://player.twitch.tv",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

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

  // Cabeçalhos aplicados a todas as páginas para reduzir superfícies comuns
  // de clickjacking, MIME sniffing e vazamento de dados pelo navegador.
  async headers() {
    const base = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Content-Security-Policy', value: csp },
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
