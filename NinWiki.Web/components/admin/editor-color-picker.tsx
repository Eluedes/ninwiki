'use client';

// Seletor de cor do editor rico, no estilo Word/Excel/PowerPoint: botao "A" (ou marca-texto) com a
// cor atual embaixo + seta; ao abrir mostra "Automatico", a grade de cores do tema, as cores padrao,
// as usadas recentemente e "Mais cores..." (qualquer cor). Serve para cor da LETRA e cor de FUNDO.

import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { ChevronDown, Highlighter, Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { THEME_COLOR_ROWS, STANDARD_COLORS } from '@/lib/editor-fonts';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'ninwiki-editor-recent-colors';
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Le as cores usadas recentemente (guardadas so' neste navegador). */
function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string' && HEX.test(c)).slice(0, 10) : [];
  } catch {
    return [];
  }
}

/** Guarda uma cor no topo da lista de recentes. */
function pushRecent(color: string): string[] {
  const next = [color.toLowerCase(), ...readRecent().filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(0, 10);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* sem storage: so' nao lembra */ }
  return next;
}

/** Quadradinho de cor clicavel. */
function Swatch({ color, onPick, selected }: { color: string; onPick: (c: string) => void; selected: boolean }) {
  return (
    <button
      type="button"
      title={color}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(color)}
      className={cn('h-5 w-5 rounded-sm border border-black/20 transition-transform hover:scale-125 hover:border-primary', selected && 'ring-2 ring-primary ring-offset-1 ring-offset-popover')}
      style={{ backgroundColor: color }}
    />
  );
}

/** Botao de cor da letra (mode "text") ou de fundo/marca-texto (mode "background"). */
export function EditorColorPicker({ editor, mode }: { editor: Editor; mode: 'text' | 'background' }) {
  const { dict } = useLanguage();
  const t = dict.admin.richText;
  const attr = mode === 'text' ? 'color' : 'backgroundColor';
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const current = useEditorState({
    editor,
    selector: ({ editor: e }) => (e.getAttributes('textStyle')[attr] as string | undefined) ?? '',
  });

  /** Aplica a cor (ou tira, se vazia) na selecao e fecha o menu. */
  function apply(color: string, close = true) {
    const chain = editor.chain().focus();
    if (mode === 'text') (color ? chain.setColor(color) : chain.unsetColor()).run();
    else (color ? chain.setBackgroundColor(color) : chain.unsetBackgroundColor()).run();
    if (color) setRecent(pushRecent(color));
    if (close) setOpen(false);
  }

  const Icon = mode === 'text' ? Palette : Highlighter;
  const shown = current && HEX.test(current) ? current : null;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setRecent(readRecent()); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={mode === 'text' ? t.textColor : t.highlightColor}
          onMouseDown={(e) => e.preventDefault()}
          className="flex h-8 items-center gap-0.5 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground"
        >
          <span className="flex flex-col items-center">
            <Icon className="h-4 w-4" />
            <span className="mt-0.5 block h-1 w-4 rounded-sm border border-black/20" style={{ backgroundColor: shown ?? (mode === 'text' ? 'currentColor' : 'transparent') }} />
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[15.5rem] space-y-3 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <button type="button" onClick={() => apply('')} className="flex w-full items-center gap-2 rounded px-1 py-1 text-xs hover:bg-secondary">
          <span className="h-4 w-4 rounded-sm border border-border bg-[linear-gradient(135deg,transparent_45%,#dc2626_45%,#dc2626_55%,transparent_55%)]" />
          {mode === 'text' ? t.automatic : t.noFill}
        </button>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.themeColors}</p>
          <div className="space-y-1">
            {THEME_COLOR_ROWS.map((row, i) => (
              <div key={i} className="flex gap-1">
                {row.map((c) => <Swatch key={c} color={c} onPick={apply} selected={shown?.toLowerCase() === c} />)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.standardColors}</p>
          <div className="flex gap-1">
            {STANDARD_COLORS.map((c) => <Swatch key={c} color={c} onPick={apply} selected={shown?.toLowerCase() === c} />)}
          </div>
        </div>
        {recent.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.recentColors}</p>
            <div className="flex flex-wrap gap-1">
              {recent.map((c) => <Swatch key={c} color={c} onPick={apply} selected={shown?.toLowerCase() === c} />)}
            </div>
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-secondary">
          <input
            type="color"
            value={shown ?? '#ff0000'}
            onChange={(e) => apply(e.target.value, false)}
            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          {t.moreColors}
        </label>
      </PopoverContent>
    </Popover>
  );
}
