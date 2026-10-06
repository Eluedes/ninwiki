'use client';

// Linha de ajuda cinza abaixo de um campo do formulario (mesmo visual do "Scroll type"). O texto vem de lib/field-hints.ts
// pela chave "<formulario>.<campo>"; sem texto cadastrado nao renderiza nada.

import { useLanguage } from '@/components/providers/language-provider';
import { fieldHint } from '@/lib/field-hints';

export function FieldHint({ id }: { id: string }) {
  const { locale } = useLanguage();
  const text = fieldHint(id, locale);
  return text ? <p className="text-xs text-muted-foreground">{text}</p> : null;
}
