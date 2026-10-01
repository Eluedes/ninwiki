// Mostra um campo de texto rico (description/longDescription) escrito
// pelo editor do painel (components/admin/rich-text-editor.tsx). Esse
// campo pode vir em DOIS formatos possiveis, e esse componente decide
// sozinho qual e':
//
//   1. JSON do Tiptap (ex: '{"type":"doc","content":[...]}') - o
//      formato que o editor rico gera desde que foi construido.
//   2. Texto simples - entries mais antigas, criadas antes do editor
//      rico existir (retrocompatibilidade, o backend aceita os dois -
//      ver validate_rich_content em app/schemas/validators.py na API).
//
// generateHTML() do @tiptap/html converte o JSON em HTML de verdade
// (negrito, cor, alinhamento, links...) - roda em Server Component sem
// problema, nao precisa de navegador/DOM pra isso.
//
// Sem 'use client' de proposito: isso roda no SERVIDOR (a pagina que
// usa isso tambem e' Server Component), o HTML final ja' vem pronto no
// HTML da pagina - bom pra SEO, sem esperar JavaScript carregar pra'
// mostrar o texto.

import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Ficha } from '@/lib/tiptap-extensions/ficha';

// MESMAS extensoes do editor (components/admin/rich-text-editor.tsx) -
// tem que bater exatamente, senao uma marca (cor, alinhamento...) que
// o editor gravou no JSON fica sem efeito nenhum aqui na hora de
// converter pra HTML (generateHTML só sabe interpretar o que a
// extensao correspondente ensina ele a entender). Ficha (a base, sem
// NodeView) e' suficiente aqui - generateHTML so' usa o renderHTML()
// estatico da extensao, nunca a parte interativa React (essa so'
// existe do lado do editor, ver lib/tiptap-extensions/ficha-editable.ts).
const extensions = [
  StarterKit,
  TextStyle,
  Color,
  Underline,
  FontFamily,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Link,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  Ficha,
];

function isTiptapJson(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null && parsed.type === 'doc';
  } catch {
    return false;
  }
}

// Extrai so' o TEXTO de um campo rico, sem nenhuma formatacao - usado
// em lugares que mostram um resumo curto (ex: o card de listagem, com
// line-clamp-2) onde nao faz sentido nenhum renderizar HTML de
// verdade (negrito/cor no meio de um resumo cortado no meio da frase
// fica estranho, e quebraria o corte visual do line-clamp).
export function extractPlainText(content: string): string {
  if (!content) return '';
  if (!isTiptapJson(content)) return content;

  try {
    const doc = JSON.parse(content);
    const parts: string[] = [];
    function walk(node: any) {
      if (node.text) parts.push(node.text);
      if (node.content) node.content.forEach(walk);
    }
    walk(doc);
    return parts.join(' ');
  } catch {
    return content;
  }
}

export function RichText({ content, className = 'prose-shinobi' }: { content: string; className?: string }) {
  if (!content) return null;

  if (isTiptapJson(content)) {
    let html: string;
    try {
      html = generateHTML(JSON.parse(content), extensions);
    } catch {
      // JSON mal formado de algum jeito inesperado - mostra o texto
      // cru em vez de quebrar a pagina inteira. Nao deveria acontecer
      // (o backend valida antes de salvar), mas uma pagina publica
      // nunca deve dar erro 500 por causa de um campo de texto.
      return <p className={className}>{content}</p>;
    }
    // Usa dangerouslySetInnerHTML: html gerado pelo
    // proprio generateHTML do Tiptap a partir de JSON que o backend ja
    // validou (validate_rich_content) - nao e' HTML arbitrario vindo
    // direto de input de usuario sem passar por validacao nenhuma.
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Texto simples (retrocompatibilidade) - quebra de linha vira <br>,
  // sem interpretar nada como HTML.
  return <p className={`${className} whitespace-pre-wrap`}>{content}</p>;
}
