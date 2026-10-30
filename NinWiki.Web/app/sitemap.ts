// sitemap.xml do site: paginas fixas + todos os posts do blog que ja' estao no ar (os agendados/rascunhos nao entram).
import type { MetadataRoute } from 'next';
import { listGuideArticles, listPosts } from '@/lib/api-client';
import { listMissions } from '@/lib/missions';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Monta o sitemap; se a API estiver fora do ar, devolve so' as paginas fixas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = ['', '/blog', '/masteries', '/jutsus', '/village', '/proficiencies', '/missions', '/catalog/guides'].map((path) => ({ url: `${SITE}${path}` }));
  fixed.push(...listMissions().map((m) => ({ url: `${SITE}/missions/${m.id}` })));   // missoes: ficha estatica (data/missions.json)
  try {
    const [posts, articles] = await Promise.all([listPosts('published'), listGuideArticles()]);   // a API ja' entrega so' os artigos publicados ao visitante
    return [
      ...fixed,
      ...posts.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: p.updatedAt })),
      ...articles.map((a) => ({ url: `${SITE}/guide/${a.id}` })),
    ];
  } catch {
    return fixed;
  }
}

// Gerado a cada pedido: um post novo/agendado que acabou de ir ao ar entra sem novo deploy.
export const dynamic = 'force-dynamic';
