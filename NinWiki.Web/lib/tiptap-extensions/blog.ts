/**
 * Extensoes do editor rico usadas so' no BLOG: video (YouTube/Twitch), mencao (@) e spoiler (details/summary),
 * mais o titulo com `id` (ancora do indice automatico).
 *
 * Este arquivo e' compartilhado pelo EDITOR (components/admin/rich-text-editor.tsx) e pelo SITE PUBLICO
 * (components/lore/rich-text.tsx, via generateHTML) - por isso so' tem a parte ESTATICA (renderHTML); a parte
 * interativa do editor (sugestoes do "@") fica em ./mention-suggestion.ts.
 *
 * SEGURANCA: o JSON do post vem do banco e ja' foi validado pela API (app/schemas/validators.py), mas aqui TODO
 * endereco e' conferido de novo na hora de montar o HTML (defesa em profundidade): video so' dos players oficiais,
 * link de mencao so' para paginas deste site. Se algo estranho aparecer, o elemento sai SEM o endereco.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Mention from '@tiptap/extension-mention';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';

// ---------------- video ----------------

const VIDEO_PREFIXES = ['https://www.youtube-nocookie.com/embed/', 'https://player.twitch.tv/'];

/** Dominio do site (a Twitch exige `parent=` igual ao dominio que embute o player). */
function siteHost(): string {
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname;
  } catch {
    // NEXT_PUBLIC_SITE_URL invalida: cai no dominio da propria pagina
  }
  return typeof window !== 'undefined' ? window.location.hostname : 'localhost';
}

/**
 * Transforma um link colado (YouTube ou Twitch) no endereco de EMBED oficial; devolve null se nao for um link
 * reconhecido. Aceita youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, twitch.tv/videos/ID e twitch.tv/canal.
 */
export function parseVideoUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const ytId = /^[A-Za-z0-9_-]{11}$/;
  if (host === 'youtube.com' || host === 'youtu.be') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? parts[0] : url.searchParams.get('v') ?? (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '');
    return id && ytId.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'twitch.tv') {
    const parts = url.pathname.split('/').filter(Boolean);
    const parent = encodeURIComponent(siteHost());
    if (parts[0] === 'videos' && /^\d{1,15}$/.test(parts[1] ?? '')) return `https://player.twitch.tv/?video=${parts[1]}&parent=${parent}`;
    if (parts.length === 1 && /^\w{3,25}$/.test(parts[0])) return `https://player.twitch.tv/?channel=${parts[0]}&parent=${parent}`;
  }
  return null;
}

/** Endereco de video seguro para o iframe (ou null). Na Twitch, troca o `parent` pelo dominio atual do site. */
export function safeVideoSrc(src: unknown): string | null {
  if (typeof src !== 'string' || !VIDEO_PREFIXES.some((p) => src.startsWith(p)) || src.length > 300) return null;
  try {
    const url = new URL(src);
    if (url.hostname === 'player.twitch.tv') url.searchParams.set('parent', siteHost());
    return url.toString();
  } catch {
    return null;
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      /** Insere um video (endereco de embed ja' validado por parseVideoUrl). */
      setVideo: (src: string) => ReturnType;
    };
  }
}

/** Bloco de video do YouTube/Twitch (iframe dos players oficiais). */
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'div[data-video]', getAttrs: (el) => ({ src: (el as HTMLElement).querySelector('iframe')?.getAttribute('src') ?? null }) }];
  },
  renderHTML({ HTMLAttributes }) {
    const src = safeVideoSrc(HTMLAttributes.src);
    const wrapper = { 'data-video': '', class: 'video-embed' };
    if (!src) return ['div', wrapper];
    return [
      'div',
      wrapper,
      ['iframe', { src, title: 'Video', loading: 'lazy', allowfullscreen: 'true', referrerpolicy: 'strict-origin-when-cross-origin' }],
    ];
  },
  addCommands() {
    // o paragrafo vazio depois do video deixa o cursor pronto para continuar digitando (em vez do video ficar selecionado)
    return { setVideo: (src: string) => ({ commands }) => commands.insertContent([{ type: 'video', attrs: { src } }, { type: 'paragraph' }]) };
  },
});

// ---------------- mencao (@) ----------------

/** Link de mencao seguro: so' caminho interno do site ("/detail/kunai"), nunca "//", "javascript:" etc. */
export function safeMentionHref(href: unknown): string | null {
  return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.includes('\\') && href.length <= 200 ? href : null;
}

/** Mencao (@Nome) que vira link para a pagina do item/mastery. Guarda id, label e href. */
export const BlogMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('href'), renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-type="mention"]' }];
  },
  renderHTML({ node }) {
    const href = safeMentionHref(node.attrs.href);
    const attrs = { class: 'mention', 'data-type': 'mention', 'data-id': node.attrs.id, 'data-label': node.attrs.label };
    return ['a', href ? { ...attrs, href } : attrs, `@${node.attrs.label ?? node.attrs.id}`];
  },
  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id}`;
  },
});

// ---------------- spoiler (details/summary) ----------------
// No editor valem as versoes oficiais (com a seta que abre/fecha). No SITE usamos <details>/<summary> nativos,
// que abrem e fecham sozinhos, sem JavaScript.

/** Spoiler no site publico: <details class="spoiler">. */
export const PublicDetails = Details.extend({
  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { class: 'spoiler' }), 0];
  },
});
/** Titulo do spoiler no site publico: <summary>. */
export const PublicDetailsSummary = DetailsSummary.extend({
  renderHTML() {
    return ['summary', 0];
  },
});
/** Corpo do spoiler no site publico. */
export const PublicDetailsContent = DetailsContent.extend({
  renderHTML() {
    return ['div', { class: 'spoiler-body' }, 0];
  },
});

// ---------------- titulo com ancora ----------------

/** Titulo (H1-H6) com atributo `id`: o indice automatico do post usa isso como ancora. */
export const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('id'),
        renderHTML: (attrs: Record<string, unknown>) => (typeof attrs.id === 'string' && /^[a-z0-9-]{1,80}$/.test(attrs.id) ? { id: attrs.id } : {}),
      },
    };
  },
});
