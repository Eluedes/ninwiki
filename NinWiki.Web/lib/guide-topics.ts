// Slugs legiveis das paginas de assunto do Guia (/guide/topics/[slug]). A chave interna (GuideSection) continua sendo a do banco.
import { GUIDE_SECTIONS, type GuideSection } from '@/lib/api-client';

export const GUIDE_TOPIC_SLUG: Record<GuideSection, string> = {
  'new-player': 'start-here',
  combat: 'combat',
  progression: 'progression',
  interface: 'interface',
  economy: 'economy',
};

/** Slug da URL -> assunto do Guia; undefined se nao existir (a pagina responde 404). */
export function sectionFromSlug(slug: string): GuideSection | undefined {
  return GUIDE_SECTIONS.find((s) => GUIDE_TOPIC_SLUG[s] === slug);
}

/** Link da pagina de um assunto. */
export const topicHref = (s: GuideSection) => `/guide/topics/${GUIDE_TOPIC_SLUG[s]}`;
