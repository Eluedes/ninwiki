// Tipos de item: EQUIPAMENTOS (aneis, acessorios e pecas de roupa) e os rotulos dos tipos no idioma atual.
// Todo equipamento mostra "Level X" (nivel 0 = sem nivel). No catalogo, o Ring tem categoria PROPRIA (Rings) e o resto fica junto no
// grupo "Wardrobe" (Guarda-roupa).
import type { Dictionary } from '@/lib/i18n';

/** Tipos de item que sao equipamento (Ring, Accessory e as pecas de roupa): todos mostram nivel. */
export const EQUIPMENT_TYPES = ['ring', 'accessory', 'shirt', 'vest', 'pant', 'hat', 'mask', 'shoe'] as const;

/** O tipo de item e' equipamento? */
export function isEquipmentType(itemType: string | null | undefined): boolean {
  return (EQUIPMENT_TYPES as readonly string[]).includes(itemType ?? '');
}

/** Tipos do grupo Wardrobe / Guarda-roupa: tudo que e' equipamento MENOS o Ring (que tem categoria propria). */
export const WARDROBE_TYPES = ['accessory', 'shirt', 'vest', 'pant', 'hat', 'mask', 'shoe'] as const;

/** O tipo de item pertence ao grupo Wardrobe? */
export function isWardrobeType(itemType: string | null | undefined): boolean {
  return (WARDROBE_TYPES as readonly string[]).includes(itemType ?? '');
}

/** Valor do seletor "Item type" que representa o GRUPO Wardrobe (o tipo gravado e' a peca escolhida no 2o seletor: hat, shirt...). */
export const WARDROBE_GROUP = 'wardrobe';

/** Rotulo de cada tipo de item no idioma atual (Geral, Ring, Camisa...). */
export function itemTypeLabels(ce: Dictionary['admin']['contentEditor']): Record<string, string> {
  return {
    general: ce.itemGeneral, ring: ce.itemRing, accessory: ce.itemAccessory, shirt: ce.itemShirt, vest: ce.itemVest, pant: ce.itemPant,
    hat: ce.itemHat, mask: ce.itemMask, shoe: ce.itemShoe, consumable: ce.itemConsumable, material: ce.itemMaterial,
    currency: ce.itemCurrency, cast: ce.itemCast, authority: ce.itemAuthority, pack: ce.itemPack,
  };
}
