'use client';

// Ficha lateral de dados-chave (tipo "infobox" da Wikipedia): titulo
// com icone, opcionalmente uma imagem, e uma lista de pares label/valor.

import { useState, type ReactNode } from 'react';

export interface InfoboxEntry {
  label: string;
  value: ReactNode; // pode ser texto simples ou algo interativo (ex: um Link)
}

// Midia (imagem/GIF) exibida NO TOPO da ficha, acima do titulo. Usa um
// <img> comum (nao next/image) de proposito: GIF animado precisa ser
// servido do jeito que foi enviado, e um <img> mantem a proporcao
// original sem exigir largura/altura fixas. Se o arquivo nao existir
// ou falhar ao carregar, o bloco inteiro some (mesmo comportamento de
// jutsu-gif.tsx) - a ficha volta a ser so' texto, sem icone de imagem
// quebrada do navegador.
function InfoboxMedia({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);
  if (hasError) return null;

  return (
    <div className="border-b border-ink-700 bg-ink-950">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="block h-auto w-full"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

/** Caixa lateral de ficha (Mastery Sheet). */
export function Infobox({
  title,
  icon,
  entries,
  accentColor,
  image,
}: {
  title: string;
  icon?: ReactNode;
  entries: InfoboxEntry[];
  accentColor?: string;
  // GIF/imagem opcional no topo da ficha. Aceita null/undefined/''
  // (campo vazio no banco) - nesses casos simplesmente nao renderiza.
  image?: string | null;
}) {
  const accent = accentColor ?? '#0ea5e9';

  return (
    <aside className="dossier-panel overflow-hidden">
      {image ? <InfoboxMedia src={image} alt={title} /> : null}
      <div
        className="relative px-4 py-3 border-b border-ink-700"
        style={{
          background: `linear-gradient(135deg, ${accent}15 0%, transparent 100%)`,
        }}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ backgroundColor: `${accent}20`, color: accent }}
            >
              {icon}
            </div>
          )}
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink-100">
            {title}
          </h3>
        </div>
      </div>

      {/* <dl> = lista de definicoes, o elemento HTML semanticamente
          correto para pares label/valor (mais acessivel que uma
          tabela ou divs genericas aqui). */}
      <dl className="divide-y divide-ink-800">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-400 shrink-0 pt-0.5">
              {entry.label}
            </dt>
            <dd className="text-sm text-ink-100 text-right font-medium">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
