// Variante de Ficha (ver ./ficha.ts pro design completo) USADA SO' NO
// EDITOR ADMIN - anexa a NodeView React interativa via addNodeView().
// O renderHTML estatico do Ficha base continua sendo usado tambem por
// esta variante (extend() so' adiciona addNodeView, nao redefine
// renderHTML) - e' o que o lado PUBLICO usa via generateHTML, que
// nunca importa este arquivo (so' o RichTextEditor do admin importa).
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Ficha } from './ficha';
import { FichaNodeView } from '@/components/admin/ficha-node-view';

export const FichaEditable = Ficha.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FichaNodeView);
  },
});
