// Fontes e paleta de cores do editor rico (admin) - tudo num lugar so'. O valor da fonte e' o que
// vai gravado no texto e vira `font-family` no site publico; por isso o backend (validators.py) so'
// aceita valores deste formato (letras, espacos, aspas, virgulas e var(--font-...)).
// As fontes "var(--font-x)" sao carregadas pelo next/font em app/layout.tsx (ver FONT_VARIABLES).

export interface EditorFont { label: string; value: string }

/** Fontes oferecidas no editor (as do site primeiro, depois as de sistema mais comuns). */
export const EDITOR_FONTS: EditorFont[] = [
  { label: 'Inter', value: 'var(--font-inter), sans-serif' },
  { label: 'Cinzel', value: 'var(--font-cinzel), serif' },
  { label: 'Playfair Display', value: 'var(--font-playfair), serif' },
  { label: 'Lora', value: 'var(--font-lora), serif' },
  { label: 'Oswald', value: 'var(--font-oswald), sans-serif' },
  { label: 'Bebas Neue', value: 'var(--font-bebas), sans-serif' },
  { label: 'Caveat', value: 'var(--font-caveat), cursive' },
  { label: 'Fira Code', value: 'var(--font-fira), monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Impact', value: 'Impact, Charcoal, sans-serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive' },
];

/** Tamanhos de letra (px), como na caixa de tamanho do Word. */
export const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '40', '48'];

// Paleta estilo Word: 10 matizes (coluna) x 5 tons (linha) + linha de cores padrao.
const HUES: Array<[number, number]> = [[0, 0], [0, 85], [30, 90], [48, 95], [120, 60], [175, 70], [210, 85], [250, 75], [285, 65], [330, 80]];
const LIGHTNESS = [92, 78, 58, 42, 28];

/** Converte HSL em "#rrggbb". */
function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Linhas da grade de cores (cada linha = um tom, cada coluna = um matiz; o 1o matiz e' cinza). */
export const THEME_COLOR_ROWS: string[][] = LIGHTNESS.map((l) => HUES.map(([h, s]) => hsl(h, h === 0 && s === 0 ? 0 : s, l)));

/** Cores padrao (linha de baixo da grade). */
export const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

/** Ids das variaveis CSS das fontes carregadas pelo next/font (ver app/layout.tsx). */
export const FONT_VARIABLES = ['--font-inter', '--font-cinzel', '--font-playfair', '--font-lora', '--font-oswald', '--font-bebas', '--font-caveat', '--font-fira'];
