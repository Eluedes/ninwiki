// Textos de ajuda exibidos ABAIXO dos campos de texto dos formularios do /admin (mesmo estilo do "Scroll type").
// Chave = "<formulario>.<campo>". Campo sem entrada aqui simplesmente nao mostra ajuda. Exemplos ficam em ingles
// porque os valores do jogo sao termos em ingles.

import type { Locale } from '@/lib/types';

type Hints = Record<string, string>;

const en: Hints = {
  // ---- Jutsu ----
  'jutsu.name': 'Name shown on the wiki. The Portuguese version is translated automatically if left empty below.',
  'jutsu.id': 'Used in the page link (/jutsus/<id>): lowercase, no spaces. It cannot be changed after creation.',
  'jutsu.icon': 'Pick an icon from the list. It is shown in lists, cards and on the jutsu sheet.',
  'jutsu.chakraCost': 'Chakra points (CP) spent on each cast.',
  'jutsu.range': 'How far the jutsu reaches, e.g. 10 Studs.',
  'jutsu.castTime': 'Delay before the jutsu fires, e.g. 1 Second.',
  'jutsu.cooldown': 'Wait between uses, e.g. 14s. If it changes by level, fill the per-level table below instead.',
  'jutsu.cooldownNpc': 'Wait between uses, e.g. 14s.',
  'jutsu.effect': 'Special effect shown on the sheet, e.g. Burn or Stun.',
  'jutsu.requiredLevel': 'Minimum character level to use it, e.g. 25.',
  'jutsu.requiredStat': 'Attribute and value required, e.g. Intellect 30.',
  'jutsu.castType': 'How it is cast, e.g. Instant, Walk cast or Channeled.',
  'jutsu.debuff': 'Negative effect applied to the target, e.g. Burn III.',
  'jutsu.allowedWeapons': 'Weapon types that can use it, e.g. Blunt.',
  // ---- Content (items, weapons, mobs...) ----
  'content.name': 'Name shown on the wiki. The Portuguese version is translated automatically if left empty below.',
  'content.slug': 'Used in the page link: lowercase letters, numbers and hyphens (e.g. hokuto-sphere). Required.',
  'content.weaponNpc': 'Where to get the weapon: the NPC that sells or gives it. Use the search to link the NPC page (the name becomes a link).',
  'content.weaponType': 'Kind of weapon, e.g. Sword, Blunt or Kunai.',
  'content.weaponBaseDamage': 'Damage of a normal hit, e.g. 15.',
  'content.weaponSpecialAbility': 'Special ability of the weapon, if it has one.',
  'content.weaponSpeed': 'Attack speed, e.g. Fast or 1.2.',
  'content.weaponKnockbackDistance': 'How far the target is pushed back, e.g. 5 Studs.',
  'content.maxStack': 'How many units fit in one inventory slot (stack). Leave empty if it does not stack.',
  'content.icon': 'Emoji shown when the entry has no image.',
  'content.spawnLocation': 'Places where the monster appears, one per row, with its zone (shown like "Found in"). The old free text is only used when the list is empty.',
  'content.mobHealth': 'Monster health points, e.g. 500.',
  'content.mobDamage': 'Damage the monster deals per hit, e.g. 20.',
  'content.mobExperience': 'Experience given when it is defeated, e.g. 120.',
  'content.mobRange': 'Distance from which it attacks, e.g. 8 Studs.',
  'content.mobRespawnTime': 'Time to reappear after being defeated, e.g. 60s.',
  // ---- Village / clan ----
  'village.name': 'Name shown on the wiki. The Portuguese version is translated automatically if left empty below.',
  'village.emblem': 'Emoji or symbol that represents the village.',
  'village.element': 'Main element of the village, e.g. Fire.',
  'village.leader': 'Name of the village leader, e.g. Hokage.',
  'village.climate': 'Climate of the village, e.g. Hot and dry.',
  'village.motto': 'Short phrase that represents the village.',
  // ---- Mastery ----
  'mastery.name': 'Name shown on the wiki. The Portuguese version is translated automatically if left empty below.',
  'mastery.icon': 'Pick an icon from the list. It is shown in lists and cards.',
  'mastery.color': 'Highlight color of the mastery in hex, e.g. #ef4444.',
};

const pt: Hints = {
  'jutsu.name': 'Nome mostrado no wiki. A versão em português é traduzida automaticamente se ficar vazia abaixo.',
  'jutsu.id': 'Usado no link da página (/jutsus/<id>): minúsculas, sem espaços. Não pode ser alterado depois de criado.',
  'jutsu.icon': 'Escolha um ícone na lista. Ele aparece em listas, cards e na ficha do jutsu.',
  'jutsu.chakraCost': 'Pontos de chakra (CP) gastos a cada uso.',
  'jutsu.range': 'Alcance do jutsu, ex.: 10 Studs.',
  'jutsu.castTime': 'Atraso antes do jutsu disparar, ex.: 1 Second.',
  'jutsu.cooldown': 'Espera entre usos, ex.: 14s. Se muda por nível, preencha a tabela por nível abaixo.',
  'jutsu.cooldownNpc': 'Espera entre usos, ex.: 14s.',
  'jutsu.effect': 'Efeito especial mostrado na ficha, ex.: Burn ou Stun.',
  'jutsu.requiredLevel': 'Nível mínimo do personagem para usar, ex.: 25.',
  'jutsu.requiredStat': 'Atributo e valor exigidos, ex.: Intellect 30.',
  'jutsu.castType': 'Como é lançado, ex.: Instant, Walk cast ou Channeled.',
  'jutsu.debuff': 'Efeito negativo aplicado no alvo, ex.: Burn III.',
  'jutsu.allowedWeapons': 'Tipos de arma que podem usar o jutsu, ex.: Blunt.',
  'content.name': 'Nome mostrado no wiki. A versão em português é traduzida automaticamente se ficar vazia abaixo.',
  'content.slug': 'Usado no link da página: letras minúsculas, números e hífens (ex.: hokuto-sphere). Obrigatório.',
  'content.weaponNpc': 'Onde conseguir a arma: o NPC que vende ou entrega. Use a busca para ligar a página do NPC (o nome vira link).',
  'content.weaponType': 'Tipo da arma, ex.: Sword, Blunt ou Kunai.',
  'content.weaponBaseDamage': 'Dano de um golpe normal, ex.: 15.',
  'content.weaponSpecialAbility': 'Habilidade especial da arma, se tiver.',
  'content.weaponSpeed': 'Velocidade de ataque, ex.: Fast ou 1.2.',
  'content.weaponKnockbackDistance': 'Quanto o alvo é empurrado para trás, ex.: 5 Studs.',
  'content.maxStack': 'Quantas unidades cabem em um espaço do inventário (stack). Deixe vazio se não empilha.',
  'content.icon': 'Emoji mostrado quando a entrada não tem imagem.',
  'content.spawnLocation': 'Lugares onde o monstro aparece, um por linha, com a zona (aparece como "Found in"). O texto livre antigo só vale quando a lista está vazia.',
  'content.mobHealth': 'Pontos de vida do monstro, ex.: 500.',
  'content.mobDamage': 'Dano que o monstro causa por golpe, ex.: 20.',
  'content.mobExperience': 'Experiência dada ao derrotá-lo, ex.: 120.',
  'content.mobRange': 'Distância de onde ele ataca, ex.: 8 Studs.',
  'content.mobRespawnTime': 'Tempo para reaparecer depois de derrotado, ex.: 60s.',
  'village.name': 'Nome mostrado no wiki. A versão em português é traduzida automaticamente se ficar vazia abaixo.',
  'village.emblem': 'Emoji ou símbolo que representa a vila.',
  'village.element': 'Elemento principal da vila, ex.: Fire.',
  'village.leader': 'Nome do líder da vila, ex.: Hokage.',
  'village.climate': 'Clima da vila, ex.: Hot and dry.',
  'village.motto': 'Frase curta que representa a vila.',
  'mastery.name': 'Nome mostrado no wiki. A versão em português é traduzida automaticamente se ficar vazia abaixo.',
  'mastery.icon': 'Escolha um ícone na lista. Ele aparece em listas e cards.',
  'mastery.color': 'Cor de destaque da mastery em hexadecimal, ex.: #ef4444.',
};

/** Texto de ajuda do campo `id` no idioma pedido (undefined se o campo nao tem ajuda cadastrada). */
export function fieldHint(id: string, locale: Locale): string | undefined {
  return (locale === 'pt' ? pt : en)[id];
}
