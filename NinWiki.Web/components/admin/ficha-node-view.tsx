'use client';

// NodeView React do bloco de Ficha (ver lib/tiptap-extensions/ficha.ts
// pra' entender ARMAZENAMENTO/design) - so' usado dentro do editor
// admin (RichTextEditor), nunca no lado publico (que so' usa o
// renderHTML estatico da propria extensao pra mostrar o resultado).
//
// NodeViewWrapper: e' o que deixa esse componente React viver DENTRO
// da arvore do ProseMirror (o motor por baixo do Tiptap) como se fosse
// um no' normal, mas com uma UI de verdade em vez de so' texto.

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/components/providers/language-provider';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { FichaRow } from '@/lib/tiptap-extensions/ficha';

/** Visual editavel do bloco 'Ficha' dentro do editor. */
export function FichaNodeView({ node, updateAttributes }: NodeViewProps) {
  const t = useLanguage().dict.admin.richText;
  const title: string = node.attrs.title ?? 'Sheet';
  const rows: FichaRow[] = node.attrs.rows ?? [];

  function setTitle(value: string) {
    updateAttributes({ title: value });
  }
  function setRow(index: number, patch: Partial<FichaRow>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    updateAttributes({ rows: next });
  }
  function addRow() {
    updateAttributes({ rows: [...rows, { label: '', value: '' }] });
  }
  function removeRow(index: number) {
    updateAttributes({ rows: rows.filter((_, i) => i !== index) });
  }

  return (
    <NodeViewWrapper className="tiptap-ficha-editor my-2 rounded-lg border border-border bg-secondary/20 p-3" contentEditable={false}>
      <div className="mb-2 flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" data-drag-handle />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.fichaTitle}
          className="h-8 font-semibold"
        />
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={row.label}
              onChange={(e) => setRow(i, { label: e.target.value })}
              placeholder={t.fichaLabel}
              className="h-8 text-xs"
            />
            <Input
              value={row.value}
              onChange={(e) => setRow(i, { value: e.target.value })}
              placeholder={t.fichaValue}
              className="h-8 text-xs"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-900/20 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-card-foreground"
      >
        <Plus className="h-3 w-3" /> Adicionar linha
      </button>
    </NodeViewWrapper>
  );
}
