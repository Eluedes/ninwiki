'use client';

// Mensagem de "nao encontrado" das paginas publicas (vila, mastery, jutsu, entry), no idioma do visitante.
// As paginas sao Server Components (nao conseguem saber o idioma); este pedacinho client resolve isso.

import Link from 'next/link';
import { useLanguage } from '@/components/providers/language-provider';

type Kind = 'village' | 'mastery' | 'jutsu' | 'entry';

const TARGETS: Record<Kind, { href: string; text: 'villageNotFound' | 'masteryNotFound' | 'jutsuNotFound' | 'entryNotFound'; back: 'backToVillages' | 'backToMasteries' | 'back' }> = {
  village: { href: '/village', text: 'villageNotFound', back: 'backToVillages' },
  mastery: { href: '/masteries', text: 'masteryNotFound', back: 'backToMasteries' },
  jutsu: { href: '/masteries', text: 'jutsuNotFound', back: 'backToMasteries' },
  entry: { href: '/', text: 'entryNotFound', back: 'back' },
};

/** Mensagem "nao encontrado" + link de volta, no idioma atual. */
export function LoreNotFound({ kind }: { kind: Kind }) {
  const { dict } = useLanguage();
  const target = TARGETS[kind];
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <p className="text-ink-300">{dict.lore[target.text]}</p>
      <Link href={target.href} className="btn-ghost mt-4">{dict.lore[target.back]}</Link>
    </div>
  );
}
