'use client';

// Cabecalho reutilizado em todas as paginas do "dossie shinobi"
// (Masteries, Jutsus, Vilas, Mapa): breadcrumb + titulo estilo carimbo
// + subtitulo + icone com cor de destaque opcional.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Breadcrumb {
  label: string;
  href?: string; // se ausente, renderiza como texto simples (item atual)
}

/** Cabecalho das paginas de lore: breadcrumb, titulo e subtitulo. */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  icon,
  accentColor,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  icon?: ReactNode;
  accentColor?: string;
  children?: ReactNode;
  action?: ReactNode;   // canto direito do titulo (ex.: botao Reportar)
}) {
  // Azul-chakra como cor padrao quando a pagina nao especifica uma
  // cor de destaque propria (ex: paginas sem uma mastery/vila associada).
  const accent = accentColor ?? '#0ea5e9';

  return (
    // painel solido: titulo e trilha nao ficam direto sobre o ceu/nuvens do fundo do site
    <div className="mb-6 rounded-xl border border-border bg-background p-4 sm:p-5">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-3 flex items-center gap-1.5 text-xs text-ink-400">
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {bc.href ? (
                <Link href={bc.href} className="hover:text-chakra-400 transition-colors">
                  {bc.label}
                </Link>
              ) : (
                <span className="text-ink-200">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <ChevronRight className="h-3 w-3 text-ink-600" />
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start gap-4">
        {icon && (
          // A cor de fundo do icone e' a cor de destaque com baixa opacidade
          // (hex + "15" = ~8% de opacidade), um padrao repetido em varios
          // componentes deste "dossie" para dar um leve tingimento sem
          // precisar de uma classe Tailwind por cor.
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accent}15`, color: accent }}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="stamp-title text-2xl text-ink-100 sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-300 sm:text-base">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
