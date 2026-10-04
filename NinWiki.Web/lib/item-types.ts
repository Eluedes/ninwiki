// Tipos de item: lista de EQUIPAMENTOS (aneis, acessorios e pecas de roupa) e os rotulos dos tipos no idioma atual.
// Equipamento mostra "Level X" (nivel 0 = sem nivel) e fica junto no filtro "Equipment" do catalogo de itens.
import type { Dictionary } from '@/lib/i18n';

/** Tipos de item que sao equipamento (Ring, Accessory e as pecas de roupa). */
export const EQUIPMENT_TYPES = ['ring', 'accessory', 'shirt', 'vest', 'pant', 'hat', 'mask', 'shoe'] as const;

/** O tipo de item e' equipamento? */
export function isEquipmentType(itemType: string | null | undefined): boolean {
  return (EQUIPMENT_TYPES as readonly string[]).includes(itemType ?? '');
}

/** Rotulo de cada tipo de item no idioma atual (Geral, Ring, Camisa...). */
export function itemTypeLabels(ce: Dictionary['admin']['contentEditor']): Record<string, string> {
  return {
    general: ce.itemGeneral, ring: ce.itemRing, accessory: ce.itemAccessory, shirt: ce.itemShirt, vest: ce.itemVest, pant: ce.itemPant,
    hat: ce.itemHat, mask: ce.itemMask, shoe: ce.itemShoe, consumable: ce.itemConsumable, material: ce.itemMaterial,
    currency: ce.itemCurrency, cast: ce.itemCast, authority: ce.itemAuthority,
  };
}
