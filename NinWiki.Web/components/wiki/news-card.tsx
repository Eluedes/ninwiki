'use client';

// Card de noticia exibido na home (patch notes, eventos, balanceamentos).

import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/language-provider';
import {
  ArrowRight,
  Bug,
  Package,
  BookOpen,
  Sparkles,
  Sword,
  ScrollText,
  Moon,
  type LucideIcon,
} from 'lucide-react';
import type { NewsItem } from '@/lib/data';
import type { Locale } from '@/lib/types';

// Os dados guardam so' o NOME do icone como string (ex: "Bug"), porque
// nao da' para serializar um componente React dentro de um array de
// dados. Este mapa traduz a string de volta para o componente real.
const iconMap: Record<string, LucideIcon> = {
  Bug,
  Package,
  BookOpen,
  Sparkles,
  Sword,
  ScrollText,
  Moon,
};

interface NewsCardProps {
  item: NewsItem;
  locale: Locale;
}

export function NewsCard({ item, locale }: NewsCardProps) {
  const { dict } = useLanguage();
  // Se o nome do icone nao existir no mapa (erro de digitacao nos
  // dados, por exemplo), cai num icone padrao em vez de quebrar a pagina.
  const Icon = iconMap[item.icon] ?? ScrollText;

  // 'T00:00:00' fixa o horario em meia-noite LOCAL, evitando um bug
  // classico de fuso horario: sem isso, "2026-09-12" poderia ser
  // interpretado como UTC e exibir "11 de setembro" para quem esta'
  // num fuso horario negativo (ex: Brasil).
  const dateObj = new Date(item.date + 'T00:00:00');
  const dateStr = dateObj.toLocaleDateString(locale === 'pt' ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-border bg-card p-5',
        'shadow-sm transition-all duration-200',
        'hover:border-primary/40 hover:shadow-md'
      )}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:bg-primary/10">
        <Icon className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {item.tag[locale]}
          </span>
          <span className="text-sm text-muted-foreground">{dateStr}</span>
        </div>
        <h3 className="text-base font-bold tracking-tight text-card-foreground group-hover:text-primary transition-colors">
          {item.title[locale]}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {item.summary[locale]}
        </p>
        {/* "Ler mais" so' fica visivel no hover (opacity-0 -> 100).
            Nota: este card nao esta' dentro de um <Link>, entao esse
            texto e' so' decorativo - clicar nele nao navega para
            lugar nenhum ainda. */}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {dict.news.readMore}
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </article>
  );
}
