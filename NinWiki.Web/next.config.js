/** @type {import('next').NextConfig} */
const nextConfig = {
  // O projeto ainda não usa a otimização de imagens do Next. Além de
  // preservar o comportamento atual, isso evita processar imagens não
  // confiáveis no servidor até existir uma política de upload completa.
  images: { unoptimized: true },

  // Cabeçalhos aplicados a todas as páginas para reduzir superfícies comuns
  // de clickjacking, MIME sniffing e vazamento de dados pelo navegador.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
