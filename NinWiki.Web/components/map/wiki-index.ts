/**
 * Summary: liga nomes do mapa (mobs, itens, recursos) as paginas PUBLICADAS do wiki.
 *
 * Carrega UMA vez (cache em memoria) a lista enxuta de entradas publicadas da API (`listContentItems`) e monta um indice por nome
 * (EN e PT, sem diferenciar maiusculas). Sem correspondencia => `undefined` e a tela mostra so' o nome, sem link.
 */

import { listContentItems, type ApiContentItemSummary } from '@/lib/api-client';

export type WikiIndice = Map<string, ApiContentItemSummary>;
const CATEGORIAS = new Set(['mobs', 'items', 'weapons']);
let promessa: Promise<WikiIndice> | null = null;

/** Carrega o indice sob demanda; se a API falhar, devolve indice vazio (o mapa continua funcionando sem links). */
export const carregarIndiceWiki = () =>
  (promessa ??= listContentItems(undefined, 'published')
    .then((lista) => {
      const m: WikiIndice = new Map();
      // A chave leva o tipo (mob/item): o mesmo nome como mob e como item nao se confunde.
      for (const e of lista) {
        if (!CATEGORIAS.has(e.category)) continue;
        for (const n of [e.name, e.namePt]) if (n) m.set(`${e.category === 'mobs' ? 'mob' : 'item'}:${n.trim().toLowerCase()}`, e);
      }
      return m;
    })
    .catch(() => new Map() as WikiIndice));

/** Acha a entrada publicada de um nome (EN ou PT). `tipo` separa mobs de itens/armas/recursos. */
export const acharNoWiki = (ind: WikiIndice | null, tipo: 'mob' | 'item', ...nomes: string[]) => {
  for (const n of nomes) {
    const e = ind?.get(`${tipo}:${n.trim().toLowerCase()}`);
    if (e) return e;
  }
  return undefined;
};
