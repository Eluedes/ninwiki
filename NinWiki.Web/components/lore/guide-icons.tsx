'use client';

// Icones dos artigos do Guia: o artigo guarda so' o NOME do icone (ex.: "shield") e este mapa traduz para o desenho do lucide-react.
// Tambem tem o seletor de icone do editor do painel (lista com o desenho + o nome). Nome desconhecido cai no livro aberto.

import {
  Award, BarChart3, Bandage, BookOpen, CalendarCheck, Coins, Compass, HeartPulse, Keyboard, LayoutGrid, MessageSquare, ScrollText, Shield, Siren,
  Sparkles, Swords, Target, TrendingUp, UserX, Users, Zap, Hammer, type LucideIcon,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const guideIconMap: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  compass: Compass,
  'calendar-check': CalendarCheck,
  shield: Shield,
  siren: Siren,
  target: Target,
  'user-x': UserX,
  'heart-pulse': HeartPulse,
  bandage: Bandage,
  users: Users,
  'trending-up': TrendingUp,
  'bar-chart': BarChart3,
  zap: Zap,
  'layout-grid': LayoutGrid,
  award: Award,
  keyboard: Keyboard,
  'message-square': MessageSquare,
  coins: Coins,
  swords: Swords,
  hammer: Hammer,
  'scroll-text': ScrollText,
  sparkles: Sparkles,
};

/** Nomes de icone disponiveis para os artigos do Guia. */
export function guideIconNames(): string[] {
  return Object.keys(guideIconMap);
}

/** Desenho do icone de um artigo do Guia. */
export function GuideIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = guideIconMap[icon] ?? BookOpen;
  return <Icon className={className} />;
}

/** Seletor de icone do editor de artigos (mostra o desenho e o nome de cada opcao). */
export function GuideIconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <span className="flex items-center gap-2">
          {value && <GuideIcon icon={value} className="h-4 w-4" />}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {guideIconNames().map((name) => (
          <SelectItem key={name} value={name}>
            <span className="flex items-center gap-2">
              <GuideIcon icon={name} className="h-4 w-4" />
              {name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
