// robots.txt do site: deixa os buscadores indexarem a wiki publica e pede para NAO entrarem no painel/login.
// (Educado, nao e' barreira de seguranca: quem quer copiar ignora o robots.txt - por isso existe o proxy.ts.)
import type { MetadataRoute } from 'next';

/** Gera o robots.txt do site. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/login'] },
      // Robos de treino de IA e de copia em massa: sem acesso.
      { userAgent: ['GPTBot', 'CCBot', 'ClaudeBot', 'anthropic-ai', 'Bytespider', 'PetalBot', 'AhrefsBot', 'SemrushBot'], disallow: '/' },
    ],
  };
}
