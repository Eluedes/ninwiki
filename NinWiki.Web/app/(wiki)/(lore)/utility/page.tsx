// Area "Utility Techniques" (rota /utility): jutsus que NAO pertencem a nenhuma mastery - qualquer pessoa pode aprender e usar.
// Server Component: busca na API (jutsus sem mastery, sem os de NPC) e repassa ao Client Component (idioma via useLanguage).
// Antes isto era a "mastery" /masteries/utility; essa rota agora redireciona para ca.

import { listUtilityJutsus } from '@/lib/api-client';
import { UtilityPageClient } from '@/components/lore/utility-page-client';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Utility Techniques' };

/** Pagina publica das tecnicas utilitarias. */
export default async function UtilityPage() {
  const jutsus = await listUtilityJutsus().catch(() => []);
  return <UtilityPageClient jutsus={jutsus} />;
}

// Busca da API a cada acesso (mesmo motivo de masteries/page.tsx).
export const dynamic = 'force-dynamic';
