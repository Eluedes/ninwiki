// Utilitarios compartilhados. `cn` junta nomes de classe CSS e resolve conflitos do Tailwind (a ultima classe vence).

import { isEquipmentType } from '@/lib/item-types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combina classes Tailwind com seguranca. Usada em praticamente todo
// componente do projeto (inclusive os do shadcn/ui) para juntar classes
// condicionais sem gerar conflito.
//
// clsx(inputs): junta varias entradas (strings, condicionais, arrays)
// em uma unica string de classes, ignorando valores falsy (false/undefined).
// Exemplo: cn('p-2', isActive && 'bg-primary') -> so' inclui 'bg-primary'
// se isActive for true.
//
// twMerge(...): resolve CONFLITOS entre classes Tailwind. Sem isso,
// cn('p-2', 'p-4') deixaria as duas classes no HTML e o navegador
// aplicaria uma por ordem de especificidade do CSS (imprevisivel).
// Com twMerge, so' a ultima (p-4) sobrevive, do jeito que a pessoa
// que chamou a funcao esperava.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Decide se a ficha/card de uma entry mostra "Nível X" - decisao com o
// Rafael (26/09): nem todo Item TEM nível de verdade no jogo (uma
// Material ou Consumable, por exemplo), so' Ring, Accessory e Cast entre os tipos
// de Item. Mob/Missao/Guia sempre mostram (nunca chamam esta funcao -
// so' Weapons e Items passam por ela).
// `level` (opcional): em itens e armas, NIVEL 0 significa "sem nivel" (pedido do Rafael) - a ficha e o card nao mostram nada.
export function shouldShowLevel(category: string, itemType: string | null, level?: number): boolean {
  if ((category === 'weapons' || category === 'items') && level === 0) return false;
  if (category === 'weapons') return true;
  if (category === 'items') return isEquipmentType(itemType) || itemType === 'cast';
  return true;
}

// Tipos de item que empilham (tem "Max Stack" na ficha do jogo: "Can hold max 500 per Stack"): Moeda, Autoridade, Consumivel e Material.
// Ring e Cast sao pecas unicas; o tipo Geral fica de fora (nao e' certo que empilhe).
export function itemHasStack(category: string, itemType: string | null | undefined): boolean {
  return category === 'items' && ['currency', 'authority', 'consumable', 'material'].includes(itemType ?? '');
}

// Gera um id/slug a partir de um texto: "Leaf Village!" -> "leaf-village". Sem acentos,
// so' minusculas, numeros e hifen (o formato que a API exige nos ids).
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// Valor de atributo para exibir: "+2" e "-1" ja' trazem sinal e ficam como estao; "0" tambem; numero puro ("5") ganha "+" na frente.
export function signedValue(value: string): string {
  const v = value.trim();
  return /^\d/.test(v) && Number.parseFloat(v) !== 0 ? `+${v}` : v;
}
