/**
 * Bloco nativo de "Ficha" (infobox) pro editor rico - item 1 da Fase 4
 * do roadmap (o outro item, Tabela, usa a extensao oficial da propria
 * Tiptap - ver rich-text-editor.tsx e components/lore/rich-text.tsx).
 *
 * Diferente do resto do conteudo (paragrafos, negrito, etc, que sao
 * texto puro), uma Ficha e' um bloco ESTRUTURADO: um titulo + uma
 * lista de linhas label/valor (ex: "Nivel: 10", "Tipo: Melee") -
 * pensado pra' quando alguem quiser encaixar uma tabela de stats
 * pequena DENTRO de um paragrafo de Lore/Sinergia, sem precisar que
 * isso vire um campo fixo novo no banco (ver spawn_location, mob_health
 * etc pra' quando FAZ sentido virar campo fixo - Ficha e' pro caso
 * ad-hoc, cada entry pode ter uma diferente).
 *
 * ARMAZENAMENTO: os dados (titulo + linhas) ficam em `attrs` do no' -
 * NAO em `content` (que e' onde o Tiptap normalmente guarda texto
 * editavel) - por isso o no' e' `atom: true` (tratado como uma unidade
 * so', sem cursor "dentro" dele) e a edicao acontece via um NodeView
 * React de verdade (ver ficha-node-view.tsx), nao via digitacao normal.
 *
 * LIMITACAO CONHECIDA: como os dados ficam em attrs (nao em `text`
 * dentro de `content`), o tradutor automatico da DeepL (ver
 * app/core/translation.py::_collect_text_nodes, que so' anda por
 * `content`) NAO enxerga o texto de dentro de uma Ficha - o titulo e
 * as linhas continuam so' no idioma que foram digitados, mesmo depois
 * de traduzir o resto do campo. Aceitavel pro v1; se precisar depois,
 * o walker do backend pode ganhar um caso especial pro tipo "ficha".
 */
import { Node, mergeAttributes } from '@tiptap/core';

export interface FichaRow {
  label: string;
  value: string;
}

export interface FichaAttrs {
  title: string;
  rows: FichaRow[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ficha: {
      insertFicha: (attrs?: Partial<FichaAttrs>) => ReturnType;
    };
  }
}

export const Ficha = Node.create({
  name: 'ficha',
  group: 'block',
  atom: true,
  // draggable: deixa arrastar o bloco inteiro pra outra posicao no
  // texto, do mesmo jeito que uma imagem - sem isso, mover uma Ficha
  // exigiria apagar e recriar do zero no lugar novo.
  draggable: true,

  addAttributes() {
    return {
      title: { default: 'Sheet' },
      // rows guardado como um array de objetos direto no attrs -
      // Tiptap serializa isso como JSON dentro do proprio documento
      // JSON do editor (o campo inteiro description/lore/synergy ja'
      // e' JSON, entao um array aninhado dentro dele e' normal).
      rows: {
        default: [] as FichaRow[],
        parseHTML: (element) => {
          const raw = element.getAttribute('data-rows');
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-rows': JSON.stringify(attrs.rows ?? []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ficha"]' }];
  },

  // renderHTML: usado tanto pelo editor (fallback quando a NodeView
  // React nao esta' ativa, ex: copiar/colar) quanto pelo lado PUBLICO
  // (generateHTML, que roda fora do React - ver components/lore/
  // rich-text.tsx). Por isso a marcacao aqui precisa ficar boa sozinha,
  // sem depender de JavaScript rodando por cima - o CSS de
  // .tiptap-ficha (ver globals.css) e' quem da' a aparencia final.
  renderHTML({ node, HTMLAttributes }) {
    const rows: FichaRow[] = node.attrs.rows ?? [];
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'ficha', class: 'tiptap-ficha' }),
      ['div', { class: 'tiptap-ficha-title' }, node.attrs.title ?? 'Sheet'],
      ['div', { class: 'tiptap-ficha-rows' },
        ...rows.map((r): [string, Record<string, string>, ...unknown[]] => [
          'div',
          { class: 'tiptap-ficha-row' },
          ['span', { class: 'tiptap-ficha-label' }, r.label],
          ['span', { class: 'tiptap-ficha-value' }, r.value],
        ]),
      ],
    ];
  },

  addCommands() {
    return {
      insertFicha:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { title: attrs?.title ?? 'Ficha', rows: attrs?.rows ?? [{ label: '', value: '' }] },
          }),
    };
  },
});
