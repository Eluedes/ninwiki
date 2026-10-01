'use client';

// Editor de texto rico (WYSIWYG) usado nos campos de conteudo do
// painel admin (descricao/lore/sinergia) - substitui os <Textarea>
// simples. Construido com Tiptap (biblioteca por tras do Notion e do
// GitLab), com barra de ferramentas propria: negrito, italico,
// sublinhado, tachado, cor de texto, fonte, titulos, listas, alinhamento
// e link.
//
// SEGURANCA - POR QUE JSON, NAO HTML: o conteudo e' salvo como uma
// ARVORE JSON (editor.getJSON()), nunca como uma string de HTML cru.
// Isso e' a decisao de arquitetura ja combinada (ver ROADMAP.md, Fase
// 4): se o editor salvasse HTML puro e o site publico so' jogasse esse
// HTML na tela com dangerouslySetInnerHTML, um editor mal-intencionado
// poderia inserir <script> na descricao de um mob e ele rodaria na
// tela de QUALQUER visitante depois - isso se chama XSS armazenado. Com
// JSON estruturado, o React sempre re-monta o conteudo a partir de
// componentes confiaveis, nunca executa HTML injetado.
//
// Por enquanto, esse JSON e' salvo dentro das mesmas colunas de texto
// que ja existiam no banco (description/lore/synergy sao TEXT, nao
// JSONB) - funciona porque e' so' uma string serializada
// (JSON.stringify), mas uma melhoria futura e' migrar essas colunas
// para JSONB de verdade, se um dia precisarmos FILTRAR/BUSCAR dentro
// do conteudo formatado (hoje nao precisamos).

import { useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { FichaEditable } from '@/lib/tiptap-extensions/ficha-editable';
import { BlogMention, Video, parseVideoUrl } from '@/lib/tiptap-extensions/blog';
import { mentionSuggestion } from '@/lib/tiptap-extensions/mention-suggestion';
import { uploadImage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/language-provider';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  LayoutGrid,
  Table2,
  ImagePlus,
  Quote,
  Code2,
  Video as VideoIcon,
  EyeOff,
  Loader2,
} from 'lucide-react';

// Paleta curta de cores de texto - suficiente pra destacar uma palavra
// (ex: o nome de um efeito, um numero importante) sem virar uma roda
// de cores gigante que ninguem usa direito.
const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Yellow', value: '#ca8a04' },
  { label: 'Purple', value: '#9333ea' },
];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Monospace', value: '"Courier New", monospace' },
];

/**
 * Tenta interpretar `value` como o JSON que este editor salva. Se nao
 * for um JSON valido (ex: texto antigo, de antes do Tiptap existir, ou
 * o campo esta' vazio), trata como paragrafo de texto simples - assim
 * entries criadas ANTES desse editor existir continuam abrindo
 * corretamente, em vez de quebrar a pagina.
 */
function parseStoredContent(value: string) {
  if (!value) return '';
  try {
    return JSON.parse(value);
  } catch {
    return value; // texto simples antigo - o Tiptap aceita string crua como paragrafo unico
  }
}

/** Botao da barra de ferramentas do editor (negrito, italico, lista...). */
function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-secondary hover:text-card-foreground disabled:opacity-30 disabled:pointer-events-none',
        active && 'bg-primary/15 text-primary'
      )}
    >
      {children}
    </button>
  );
}

/** Grupo de botoes extra do BLOG: imagem (upload), citacao, bloco de codigo, video e spoiler. */
function BlogTools({ editor }: { editor: Editor }) {
  const { dict } = useLanguage();
  const bx = dict.blogx.editor;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  /** Envia a imagem escolhida para a API e a insere no texto (pede o texto alternativo, para acessibilidade). */
  async function handleImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      const alt = window.prompt(bx.imageAlt, '') ?? '';
      editor.chain().focus().setImage({ src: url, alt: alt.trim() }).run();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : bx.imageError);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  /** Pede um link do YouTube/Twitch e insere o player. */
  function handleVideo() {
    const input = window.prompt(bx.videoPrompt, '');
    if (!input) return;
    const src = parseVideoUrl(input);
    if (!src) {
      window.alert(bx.videoInvalid);
      return;
    }
    editor.chain().focus().setVideo(src).run();
  }

  return (
    <>
      <div className="mx-1 h-5 w-px bg-border" />
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
      <ToolbarButton title={bx.image} disabled={uploading} onClick={() => fileInput.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      </ToolbarButton>
      <ToolbarButton title={bx.quote} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={bx.codeBlock} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={bx.video} onClick={handleVideo}>
        <VideoIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title={bx.spoiler}
        active={editor.isActive('details')}
        onClick={() => (editor.isActive('details') ? editor.chain().focus().unsetDetails().run() : editor.chain().focus().setDetails().run())}
      >
        <EyeOff className="h-4 w-4" />
      </ToolbarButton>
    </>
  );
}

/** Barra de ferramentas do editor: formatacao, titulos, listas, alinhamento, link, ficha e tabela (+ extras do blog). */
function Toolbar({ editor, blog }: { editor: Editor; blog: boolean }) {
  const { dict } = useLanguage();
  const t = dict.admin.richText;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/30 p-1.5">
      <ToolbarButton title={t.bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={t.italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={t.underline} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={t.strike} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Titulos H1/H2/H3 como um select, em vez de 3 botoes separados -
          economiza espaco e deixa claro que sao mutuamente exclusivos. */}
      <select
        className="h-8 rounded-md border border-border bg-background px-1.5 text-xs text-card-foreground"
        value={
          editor.isActive('heading', { level: 1 }) ? '1' :
          editor.isActive('heading', { level: 2 }) ? '2' :
          editor.isActive('heading', { level: 3 }) ? '3' : 'p'
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(v) as 1 | 2 | 3 }).run();
        }}
      >
        <option value="p">{t.normalText}</option>
        <option value="1">{t.heading1}</option>
        <option value="2">{t.heading2}</option>
        <option value="3">{t.heading3}</option>
      </select>

      {/* Fonte */}
      <select
        className="h-8 rounded-md border border-border bg-background px-1.5 text-xs text-card-foreground"
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        title={t.font}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Cor do texto */}
      <select
        className="h-8 rounded-md border border-border bg-background px-1.5 text-xs text-card-foreground"
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setColor(v).run();
          else editor.chain().focus().unsetColor().run();
        }}
        title={t.textColor}
      >
        {TEXT_COLORS.map((c) => (
          <option key={c.label} value={c.value}>{c.label}</option>
        ))}
      </select>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title={t.bulletList} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={t.orderedList} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title={t.alignLeft} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={t.alignCenter} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={t.alignRight} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        title={t.link}
        active={editor.isActive('link')}
        onClick={() => {
          const url = window.prompt('URL:', editor.getAttributes('link').href ?? '');
          if (url === null) return; // cancelou
          if (url === '') editor.chain().focus().unsetLink().run();
          else editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Ficha/Tabela - blocos nativos da Fase 4 do roadmap. Ficha usa
          o comando customizado insertFicha() (ver lib/tiptap-extensions/
          ficha.ts); Tabela usa o comando pronto que vem da propria
          extensao oficial @tiptap/extension-table (insertTable). */}
      <ToolbarButton title={t.insertFicha} onClick={() => editor.chain().focus().insertFicha().run()}>
        <LayoutGrid className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title={t.insertTable}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Table2 className="h-4 w-4" />
      </ToolbarButton>

      {blog && <BlogTools editor={editor} />}

      <div className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton title={t.undo} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title={t.redo} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

// Limpa o HTML COLADO de fora (site, Word...) antes do editor interpretar. O ProseMirror ja' descarta o que
// o schema nao conhece, mas aqui cortamos na raiz: tags perigosas/inuteis somem, todo atributo some
// (style, class, on*=...) exceto o href de links, e links com esquema perigoso (javascript:, data:) perdem o href.
const BLOCKED_PASTE_TAGS = 'script,style,iframe,object,embed,img,svg,form,input,button,link,meta,video,audio,canvas,base';
const SAFE_LINK = /^(https?:|mailto:|\/|#)/i;

/** Limpa o HTML colado de fora: remove tags perigosas e atributos, e links com esquema perigoso. */
export function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.querySelectorAll(BLOCKED_PASTE_TAGS).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    const href = el.tagName === 'A' ? el.getAttribute('href') : null;
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    if (href && SAFE_LINK.test(href.trim())) el.setAttribute('href', href.trim());
  });
  return doc.body.innerHTML;
}

/** Rodape do editor do blog: quantos caracteres e palavras o texto tem agora. */
function EditorCounter({ editor }: { editor: Editor }) {
  const { dict } = useLanguage();
  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ chars: e.storage.characterCount.characters(), words: e.storage.characterCount.words() }),
  });
  return (
    <div className="border-t border-border bg-secondary/30 px-3 py-1 text-right text-xs text-muted-foreground">
      {counts.words} {dict.blogx.editor.words} · {counts.chars} {dict.blogx.editor.characters}
    </div>
  );
}

/** Editor de texto rico (Tiptap). Recebe/devolve o documento como JSON em string. */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  variant = 'default',
}: {
  value: string;
  onChange: (jsonValue: string) => void;
  placeholder?: string;
  /** 'blog' liga imagem, citacao, codigo, video, @mencao, spoiler e o contador de caracteres/palavras. */
  variant?: 'default' | 'blog';
}) {
  const blog = variant === 'blog';
  const editor = useEditor({
    extensions: [
      // link e underline ja' vem no StarterKit (Tiptap v3): desligados aqui porque sao adicionados abaixo com a nossa configuracao (evita extensao duplicada).
      StarterKit.configure({ link: false, underline: false }),
      TextStyle,
      Color,
      Underline,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Escreva aqui...' }),
      // resizable: false - redimensionar coluna arrastando a borda e'
      // um recurso a mais que exige CSS/JS proprio da Tiptap pra
      // funcionar direito; sem isso ligado, a tabela ainda funciona
      // normal (inserir, editar celula, adicionar linha/coluna), so'
      // sem arrastar bordas pra redimensionar.
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      FichaEditable,
      ...(blog
        ? [
            Image.configure({ HTMLAttributes: { class: 'post-image' } }),
            Video,
            BlogMention.configure({ suggestion: mentionSuggestion }),
            Details.configure({ persist: true }),
            DetailsSummary,
            DetailsContent,
            CharacterCount,
          ]
        : []),
    ],
    content: parseStoredContent(value),
    // Evita o aviso de "SSR mismatch" do Tiptap no Next.js - o editor
    // so' renderiza de verdade depois que o React hidratou no navegador.
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      // Filtro do "colar": ver sanitizePastedHtml acima (Fase 6 - hardening).
      transformPastedHTML: sanitizePastedHtml,
      attributes: {
        // min-h-32 (128px) era baixo demais - dobrei pra min-h-[16rem] (min-h-64 nao existe no Tailwind 3.3: a classe era ignorada e o editor ficava minusculo)
        // (256px), e resize-y deixa a pessoa arrastar o canto pra
        // fazer ainda maior quando precisar (util pra' textos longos
        // tipo a "Descrição completa"). overflow-y-auto garante que o
        // texto rola dentro da caixa em vez de vazar quando ela nao
        // foi redimensionada mas o conteudo passou do tamanho visivel.
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[16rem] resize-y overflow-y-auto px-3 py-2 focus:outline-none',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <Toolbar editor={editor} blog={blog} />
      <EditorContent editor={editor} />
      {blog && <EditorCounter editor={editor} />}
    </div>
  );
}
