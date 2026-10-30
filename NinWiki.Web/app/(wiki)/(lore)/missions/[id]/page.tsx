// Pagina de UMA missao (rota /missions/[id]): requisitos, objetivos e recompensas, com miniatura/link dos itens que existem no wiki.
// Server Component: le a ficha de data/missions.json e busca na API so' os itens/mobs/armas publicados que a missao cita.

import { getMission, missionTargets } from '@/lib/missions';
import { listContentItems, listGuideArticles, type ItemRef } from '@/lib/api-client';
import { MissionPageClient } from '@/components/lore/mission-page-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Titulo da aba: o nome da missao. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: getMission(id)?.name ?? 'Missions' };
}

/** Pagina publica de uma missao. */
export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mission = getMission(id);
  if (!mission) notFound();

  // Itens, armas e mobs publicados cujo nome aparece na ficha ([[...]]): viram miniatura + link. Se a API estiver fora do ar, a pagina abre sem links.
  const wanted = new Set(missionTargets(mission));
  const refs: Record<string, ItemRef> = {};
  if (wanted.size > 0) {
    try {
      const lists = await Promise.all((['items', 'weapons', 'mobs'] as const).map((c) => listContentItems(c, 'published')));
      for (const e of lists.flat()) {
        const key = e.name.toLowerCase();
        if (wanted.has(key) && !refs[key]) refs[key] = { name: e.name, namePt: e.namePt, slug: e.slug, image: e.image };
      }
    } catch { /* sem links, so' texto */ }
  }

  // Guias que explicam o sistema de missoes (publicados): ligados no rodape da pagina.
  let guides: { id: string; title: string; titlePt: string | null }[] = [];
  try {
    guides = (await listGuideArticles())
      .filter((a) => ['mission-assignment-desk', 'mission-log'].includes(a.id))
      .map((a) => ({ id: a.id, title: a.title, titlePt: a.titlePt ?? null }));
  } catch { /* sem guias */ }

  return <MissionPageClient mission={mission} refs={refs} guides={guides} />;
}

// Os itens publicados mudam: busca da API a cada acesso (sem pre-render no build).
export const dynamic = 'force-dynamic';
