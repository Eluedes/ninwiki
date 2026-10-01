'use client';

// Traduz a string de icone salva nos dados (ex: "flame") para o
// componente de icone real do lucide-react. Usado em MasteryCard,
// JutsuCard, PageHeader e Infobox sempre que precisam exibir o icone
// de uma mastery/jutsu.

import {
  Flame,
  Wind,
  Zap,
  Mountain,
  Droplet,
  HeartPulse,
  Swords,
  Hand,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  flame: Flame,
  wind: Wind,
  zap: Zap,
  mountain: Mountain,
  droplet: Droplet,
  'heart-pulse': HeartPulse,
  swords: Swords,
  fist: Hand,
};

/** Icone de uma mastery com a cor dela. */
export function MasteryIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  // Se o nome do icone nao existir no mapa, cai em Flame como padrao
  // em vez de quebrar a renderizacao.
  const Icon = iconMap[icon] ?? Flame;
  return <Icon className={className} />;
}
