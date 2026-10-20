// Content-Security-Policy do site, montada A CADA REQUISICAO pelo proxy.ts com um NONCE novo (numero aleatorio de uso unico).
// Diz ao navegador DE ONDE a pagina pode carregar scripts, imagens e dados - mesmo que alguem consiga injetar um <script>, o navegador recusa executar.
//  - script-src: SEM 'unsafe-inline'. Roda so' script que leva o nonce desta resposta (o Next.js coloca o nonce nos proprios scripts; o do tema
//    escuro/claro recebe pelo layout) e os que esses scripts carregarem ('strict-dynamic'). 'unsafe-eval' so' no desenvolvimento (recarga automatica).
//  - style-src: 'unsafe-inline' continua (o React escreve style="..." em muitos elementos); estilo injetado nao executa codigo.
//  - img-src: o proprio site, a API (uploads) e qualquer https (o painel aceita colar URL de imagem).
//  - connect-src: so' o site e a API. frame-ancestors 'none': ninguem embute o site num iframe (anti-clickjacking).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const isDev = process.env.NODE_ENV !== 'production';

/** Texto do cabecalho Content-Security-Policy para um nonce. */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${API_URL}`,
    "font-src 'self' data:",
    `connect-src 'self' ${API_URL}${isDev ? ' ws:' : ''}`,
    // Videos do blog: so' os players oficiais (YouTube no modo sem cookies e Twitch). Nenhum outro iframe e' permitido.
    'frame-src https://www.youtube-nocookie.com https://player.twitch.tv',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
