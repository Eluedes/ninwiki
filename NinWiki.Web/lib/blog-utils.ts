/**
 * Funcoes puras do blog (sem React): indice automatico (TOC), tempo de leitura e contagem de palavras a partir do
 * documento Tiptap (JSON em string). Usadas pelo site publico, pela pre-visualizacao e pelo editor.
 */

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

/** Transforma um titulo em ancora ("Hello World!" -> "hello-world"); sem letras vira "section". */
export function slugifyHeading(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'section';
}

/** Junta o texto de um no' e de todos os filhos. */
function nodeText(node: DocNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(nodeText).join(node.type === 'doc' || node.type === 'listItem' ? ' ' : '');
}

/** Interpreta o campo como documento Tiptap; devolve null se for texto simples ou JSON invalido. */
function parseDoc(content: string): DocNode | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const doc = JSON.parse(trimmed) as DocNode;
    return doc && doc.type === 'doc' ? doc : null;
  } catch {
    return null;
  }
}

/**
 * Prepara o texto do post para a pagina publica: acha os titulos H2/H3 e devolve (1) o documento com um `id` em cada
 * um deles, para o indice poder linkar, e (2) a lista do indice. Texto simples ou sem titulos: indice vazio.
 */
export function prepareContent(content: string): { content: string; toc: TocItem[] } {
  const doc = parseDoc(content);
  if (!doc) return { content, toc: [] };
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  const walk = (node: DocNode) => {
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level);
      const text = nodeText(node).trim();
      if ((level === 2 || level === 3) && text) {
        const base = slugifyHeading(text);
        const n = (used.get(base) ?? 0) + 1;
        used.set(base, n);
        const id = n === 1 ? base : `${base}-${n}`;
        node.attrs = { ...node.attrs, id };
        toc.push({ id, text, level });
      }
    }
    (node.content ?? []).forEach(walk);
  };
  walk(doc);
  return { content: JSON.stringify(doc), toc };
}

/** Texto corrido do campo (sem formatacao): serve para contar palavras e estimar o tempo de leitura. */
export function plainTextOf(content: string): string {
  const doc = parseDoc(content);
  return doc ? nodeText(doc) : content;
}

/** Quantidade de palavras do texto. */
export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Minutos de leitura (200 palavras por minuto; no minimo 1). */
export function readingMinutes(content: string): number {
  return Math.max(1, Math.ceil(countWords(plainTextOf(content)) / 200));
}
