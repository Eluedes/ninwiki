// Selecao em massa por clique na linha/cartao inteiro (sem precisar acertar a caixinha).
// Usado pela tabela do painel (components/admin/tanstack-data-table.tsx) e pela grade do banco de imagens (app/admin/media/page.tsx).

/** Elementos em que o clique tem a sua propria funcao (link, botao, campo, caixa...): clicar neles NAO deve marcar a linha. */
const INTERACTIVE = 'a, button, input, select, textarea, label, option, summary, [role="checkbox"], [role="button"], [role="menuitem"], [contenteditable="true"]';

/** True se o clique caiu num elemento interativo (ou se a pessoa esta' selecionando um texto com o mouse). */
export function ignoreRowClick(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest(INTERACTIVE)) return true;
  return typeof window !== 'undefined' && (window.getSelection()?.toString().length ?? 0) > 0;
}

/** Posicoes de `a` ate' `b` (inclusive, em qualquer ordem): usado no Shift+clique para marcar um intervalo. */
export function rangeBetween(a: number, b: number): number[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
