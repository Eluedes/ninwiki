// Pagina inicial de Missoes (rota /missions): lista com busca e filtros (regiao, tipo, rank, nivel, repetivel). Os dados vem de data/missions.json
// (lib/missions.ts); o visual (idioma, filtros) fica em components/lore/missions-page-client.tsx.

import { listMissions, plainMarkup, type Mission } from '@/lib/missions';
import { MissionsPageClient, type MissionCard } from '@/components/lore/missions-page-client';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Missions' };

/** Resume a ficha ao que o cartao da lista precisa (a ficha inteira so' vai na pagina da missao). */
function toCard(m: Mission): MissionCard {
  const summary = m.quote ?? m.summary ?? '';
  return {
    id: m.id, name: m.name, level: m.level, rank: m.rank, type: m.type, areas: m.areas,
    npc: m.npc ? plainMarkup(m.npc) : null,
    summary: plainMarkup(summary).slice(0, 180),
    exp: m.rewards.exp, partial: m.objectives.length === 0 || m.rewards.list.length === 0,
  };
}

/** Pagina publica das missoes (Server Component). */
export default function MissionsPage() {
  return <MissionsPageClient missions={listMissions().map(toCard)} />;
}
