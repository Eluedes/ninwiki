'use client';

// "Comece por aqui" do Guia (rota /catalog/guides), inspirado na pagina de Guias do Nin Online Wiki (Fandom): atalhos agrupados para as areas do wiki
// - quem esta' chegando e os sistemas do jogo. Nao le nada da API: sao so' links (os textos ficam aqui, nos dois idiomas, como em lib/data.ts).

import Link from 'next/link';
import type { ComponentType } from 'react';
import { Bug, Hammer, Landmark, Map as MapIcon, Package, ScrollText, Sparkles, Sword, Zap } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';

interface HubLink {
  href: string;
  Icon: ComponentType<{ className?: string }>;
  title: { pt: string; en: string };
  text: { pt: string; en: string };
}

interface HubSection {
  title: { pt: string; en: string };
  links: HubLink[];
}

const SECTIONS: HubSection[] = [
  {
    title: { pt: 'Novo por aqui?', en: 'New here?' },
    links: [
      { href: '/village', Icon: Landmark, title: { pt: 'Vilas', en: 'Villages' }, text: { pt: 'A escolha feita na criação do personagem e tudo que ela decide: clãs, cultura e elemento.', en: 'The choice you make at character creation and everything it decides: clans, culture and element.' } },
      { href: '/map', Icon: MapIcon, title: { pt: 'Mapa', en: 'Map' }, text: { pt: 'Onde fica cada lugar, cada loja e cada monstro do mundo.', en: 'Where every place, shop and monster in the world is.' } },
      { href: '/masteries', Icon: Sparkles, title: { pt: 'Maestrias', en: 'Masteries' }, text: { pt: 'Os caminhos elementais e de armas, com os jutsus de cada um.', en: 'The elemental and weapon paths, with the jutsus of each one.' } },
      { href: '/jutsus', Icon: Zap, title: { pt: 'Jutsus', en: 'Jutsus' }, text: { pt: 'Todas as técnicas, com custo de chakra, recarga e requisitos.', en: 'Every technique, with chakra cost, cooldown and requirements.' } },
    ],
  },
  {
    title: { pt: 'Sistemas do jogo', en: 'Gameplay systems' },
    links: [
      { href: '/proficiencies', Icon: Hammer, title: { pt: 'Proficiências', en: 'Proficiencies' }, text: { pt: 'Coleta e criação: níveis, bônus, XP e todas as receitas.', en: 'Gathering and crafting: levels, bonuses, XP and every recipe.' } },
      { href: '/catalog/missions', Icon: ScrollText, title: { pt: 'Missões', en: 'Missions' }, text: { pt: 'Lista de missões, recompensas e passos para concluir.', en: 'Mission list, rewards and steps to complete them.' } },
      { href: '/catalog/items', Icon: Package, title: { pt: 'Itens', en: 'Items' }, text: { pt: 'Consumíveis, materiais, equipamentos e itens especiais.', en: 'Consumables, materials, equipment and special items.' } },
      { href: '/catalog/weapons', Icon: Sword, title: { pt: 'Armas', en: 'Weapons' }, text: { pt: 'Estatísticas, requisitos e onde conseguir cada arma.', en: 'Stats, requirements and where to get each weapon.' } },
      { href: '/catalog/mobs', Icon: Bug, title: { pt: 'Monstros', en: 'Bestiary' }, text: { pt: 'Monstros e NPCs, onde aparecem e o que dropam.', en: 'Monsters and NPCs, where they appear and what they drop.' } },
    ],
  },
];

/** Atalhos agrupados para as areas do wiki, no topo do Guia. */
export function GuideHub() {
  const { locale } = useLanguage();
  const lang = locale === 'pt' ? 'pt' : 'en';
  return (
    <div className="mb-10 space-y-6">
      {SECTIONS.map((section) => (
        <section key={section.title.en}>
          <h2 className="mb-3 text-lg font-bold tracking-tight">{section.title[lang]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.links.map(({ href, Icon, title, text }) => (
              <Link key={href} href={href} className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-card-foreground group-hover:text-primary">{title[lang]}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{text[lang]}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
