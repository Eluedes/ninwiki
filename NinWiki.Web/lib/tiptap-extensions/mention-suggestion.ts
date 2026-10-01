/**
 * Sugestoes do "@" no editor de posts: ao digitar @ e um pedaco do nome, mostra uma listinha de itens/masteries
 * (buscados na API) para virar link. Sem biblioteca de popup: um <div> simples posicionado perto do cursor.
 *
 * Seguranca: os nomes vindos da API entram SEMPRE com textContent (nunca innerHTML), entao um nome com "<script>" so'
 * aparece como texto.
 */
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { searchMentions, type ApiMentionResult } from '@/lib/api-client';

/** Opcoes de sugestao para a extensao de mencao: busca na API e desenha a lista perto do cursor. */
// (o `any` do tipo dos atributos escolhidos vem da extensao de mencao, que define o formato)
export const mentionSuggestion: Omit<SuggestionOptions<ApiMentionResult, any>, 'editor'> = {
  char: '@',
  items: async ({ query }) => {
    if (query.trim().length < 1) return [];
    try {
      return await searchMentions(query);
    } catch {
      return []; // sem permissao ou API fora: simplesmente nao sugere nada
    }
  },
  render: () => {
    let box: HTMLDivElement | null = null;
    let current: SuggestionProps<ApiMentionResult, any> | null = null;
    let selected = 0;

    /** Redesenha a lista de resultados e posiciona a caixa embaixo do cursor. */
    const draw = () => {
      if (!box || !current) return;
      box.replaceChildren();
      if (current.items.length === 0) {
        box.style.display = 'none';
        return;
      }
      box.style.display = 'block';
      current.items.forEach((item, index) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'mention-row' + (index === selected ? ' is-selected' : '');
        const name = document.createElement('span');
        name.textContent = item.label;
        const kind = document.createElement('span');
        kind.className = 'mention-kind';
        kind.textContent = item.kind;
        row.append(name, kind);
        row.addEventListener('mousedown', (e) => {
          e.preventDefault(); // nao rouba o foco do editor
          current?.command(item);
        });
        box!.append(row);
      });
      const rect = current.clientRect?.();
      if (rect) {
        box.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
        box.style.top = `${rect.bottom + 4}px`;
      }
    };

    return {
      onStart: (props) => {
        box = document.createElement('div');
        box.className = 'mention-popup';
        document.body.append(box);
        current = props;
        selected = 0;
        draw();
      },
      onUpdate: (props) => {
        current = props;
        selected = 0;
        draw();
      },
      onKeyDown: ({ event }) => {
        if (!current || current.items.length === 0) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          selected = (selected + step + current.items.length) % current.items.length;
          draw();
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          current.command(current.items[selected]);
          return true;
        }
        return event.key === 'Escape';
      },
      onExit: () => {
        box?.remove();
        box = null;
        current = null;
      },
    };
  },
};
