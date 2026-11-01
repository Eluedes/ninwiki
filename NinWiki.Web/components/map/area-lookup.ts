/**
 * Summary: liga o NOME de um lugar (ex.: "Larva Road") a uma area do mapa-mundi, para a ficha do mob linkar `/map#map/<id>`.
 *
 * Usa `names` do `areas-info.json` ({id: [nome EN, nome PT]}, os mesmos ids do atlas; carregado so' sob demanda e uma vez).
 * Casa ignorando maiusculas, acentos e pontuacao. Se dois ids tem o mesmo nome, vale o primeiro; sem correspondencia => `undefined` (so' texto).
 */

import { carregarInfo } from '@/components/map/area-panel';

export type AreaIndice = Map<string, number>;

/** Normaliza para comparar: minusculas, sem acento e sem pontuacao. */
export const normalizarLugar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let promessa: Promise<AreaIndice> | null = null;

/** Carrega (uma vez) o indice nome normalizado -> id da area. */
export const carregarIndiceAreas = () =>
  (promessa ??= carregarInfo().then((info) => {
    const ind: AreaIndice = new Map();
    for (const [id, nomes] of Object.entries(info.names)) {
      for (const n of nomes) if (n && !ind.has(normalizarLugar(n))) ind.set(normalizarLugar(n), Number(id));
    }
    return ind;
  }).catch(() => new Map() as AreaIndice));

/** Link do mapa ja' focado na area do lugar (ou `null` se o nome nao casa com nenhuma area). */
export const linkDoLugar = (ind: AreaIndice | null, ...nomes: (string | null | undefined)[]) => {
  for (const n of nomes) {
    const id = n ? ind?.get(normalizarLugar(n)) : undefined;
    if (id !== undefined) return `/map#map/${id}`;
  }
  return null;
};
