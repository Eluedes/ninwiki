// Schemas Zod para validacao de formulario no FRONT-END - espelham as
// mesmas regras que o backend ja aplica em app/schemas/content.py e
// app/schemas/masteries.py (min_length, ge=0, etc.). Ter as duas
// validacoes (front E back) e' proposital, nao redundante: o front
// avisa a pessoa NA HORA, campo por campo, antes de qualquer
// requisicao sair; o back continua sendo quem decide de verdade (nunca
// confiar cegamente no que o navegador validou, alguem pode bater
// direto na API pulando o formulario).

import { z } from 'zod';

export const contentItemSchema = z.object({
  slug: z
    .string()
    .min(1, 'O slug é obrigatório.')
    .max(150, 'O slug pode ter no máximo 150 caracteres.')
    .regex(/^[a-z0-9-]+$/, 'Use só letras minúsculas, números e hífen (ex: fire-larva).'),
  category: z.enum(['mobs', 'items', 'guides', 'weapons', 'missions']),
  name: z.string().min(1, 'O nome é obrigatório.').max(200, 'O nome pode ter no máximo 200 caracteres.'),
  level: z.coerce.number().int('Nível precisa ser um número inteiro.').min(0, 'Nível não pode ser negativo.'),
  icon: z.string().min(1, 'Escolha um ícone (emoji).').max(20),
  image: z.string().nullable().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']),
  description: z.string().min(1, 'A descrição é obrigatória.'),
  lore: z.string().nullable().optional(),
  synergy: z.string().nullable().optional(),
  // So' relevante quando category === 'mobs' - mesmo padrao de
  // mobType/itemType (campo condicional, sem validacao especifica
  // alem de string opcional).
  spawnLocation: z.string().nullable().optional(),
  namePt: z.string().nullable().optional(),
  descriptionPt: z.string().nullable().optional(),
  lorePt: z.string().nullable().optional(),
  synergyPt: z.string().nullable().optional(),
  spawnLocationPt: z.string().nullable().optional(),
  mobHealth: z.string().nullable().optional(),
  mobDamage: z.string().nullable().optional(),
  mobExperience: z.string().nullable().optional(),
  mobRange: z.string().nullable().optional(),
  mobRespawnTime: z.string().nullable().optional(),
  weaponSpeed: z.string().nullable().optional(),
  weaponRequirement: z.string().nullable().optional(),
  weaponNpc: z.string().nullable().optional(),
  weaponType: z.string().nullable().optional(),
  weaponBaseDamage: z.string().nullable().optional(),
  weaponSpecialAbility: z.string().nullable().optional(),
  weaponKnockbackDistance: z.string().nullable().optional(),
  maxStack: z.coerce.number().int().min(0).nullable().optional(),
  castVillageId: z.string().nullable().optional(),
  mobType: z.enum(['monster', 'boss', 'npc', 'mount']).nullable().optional(),
  itemType: z.enum(['general', 'ring', 'consumable', 'material', 'currency', 'cast']).nullable().optional(),
});

export type ContentItemFormValues = z.infer<typeof contentItemSchema>;

export const jutsuSchema = z.object({
  id: z
    .string()
    .min(1, 'O id/slug é obrigatório.')
    .max(80, 'O id pode ter no máximo 80 caracteres.')
    .regex(/^[a-z0-9-]+$/, 'Use só letras minúsculas, números e hífen (ex: katon-goukakyuu).'),
  name: z.string().min(1, 'O nome é obrigatório.'),
  namePt: z.string().nullable().optional(),
  masteryId: z.string().min(1, 'Escolha uma mastery.'),
  pathId: z.string().nullable().optional(),
  tier: z.coerce.number().int().min(1, 'Tier mínimo é 1.').max(5, 'Tier máximo é 5.'),
  chakraCost: z.coerce.number().int().min(0, 'Custo de chakra não pode ser negativo.'),
  description: z.string().min(1, 'A descrição curta é obrigatória.'),
  longDescription: z.string().min(1, 'A descrição completa é obrigatória.'),
  descriptionPt: z.string().nullable().optional(),
  longDescriptionPt: z.string().nullable().optional(),
  effect: z.string().min(1, 'Descreva o efeito.'),
  range: z.string().min(1, 'Informe o alcance.'),
  castTime: z.string().min(1, 'Informe o tempo de conjuração.'),
  cooldown: z.string().min(1, 'Informe o cooldown.'),
  icon: z.string().min(1, 'Escolha um ícone.'),
  gif: z.string().nullable().optional(),
});

export type JutsuFormValues = z.infer<typeof jutsuSchema>;

export const masterySchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.').max(100),
  namePt: z.string().nullable().optional(),
  description: z.string().min(1, 'A descrição é obrigatória.'),
  longDescription: z.string().min(1, 'A descrição completa é obrigatória.'),
  descriptionPt: z.string().nullable().optional(),
  longDescriptionPt: z.string().nullable().optional(),
  icon: z.string().min(1, 'Escolha um ícone.').max(50),
  color: z.string().min(1, 'Escolha uma cor.').max(20),
  image: z.string().nullable().optional(),
  gif: z.string().nullable().optional(),
  // attributeIds/paths ficam FORA do schema de proposito - mesmo
  // padrao de attributes/drops no editor de Conteudo: listas
  // dinamicas controladas com useState puro, combinadas na hora de
  // salvar (ver onValid), nao pelo React Hook Form.
});

export type MasteryFormValues = z.infer<typeof masterySchema>;
// ---- Vilas e Clas (mesmas regras do backend: app/schemas/villages.py) ----

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugMessage = 'Use só letras minúsculas, números e hífen (ex: leaf-village).';

export const clanSchema = z.object({
  id: z.string().min(1, 'O id do clã é obrigatório.').max(50).regex(slugRegex, slugMessage),
  name: z.string().min(1, 'O nome do clã é obrigatório.').max(100),
  levelRequirement: z.coerce.number().int().min(0, 'Nível não pode ser negativo.'),
  priceRyo: z.coerce.number().int().min(0, 'Preço não pode ser negativo.'),
  description: z.string(),
});

export const villageSchema = z
  .object({
    id: z.string().min(1, 'O id/slug é obrigatório.').max(50).regex(slugRegex, slugMessage),
    name: z.string().min(1, 'O nome é obrigatório.').max(100),
    namePt: z.string().max(100).nullable().optional(),
    element: z.string().min(1, 'O elemento é obrigatório.').max(50),
    motto: z.string().max(200),
    description: z.string(),
    longDescription: z.string(),
    emblem: z.string().min(1, 'O emblema é obrigatório.').max(20),
    image: z.string().nullable().optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB.'),
    climate: z.string().max(200),
    leader: z.string().max(100),
    mapX: z.coerce.number().min(0, 'Entre 0 e 100.').max(100, 'Entre 0 e 100.'),
    mapY: z.coerce.number().min(0, 'Entre 0 e 100.').max(100, 'Entre 0 e 100.'),
    clans: z.array(clanSchema),
  })
  .refine((v) => new Set(v.clans.map((c) => c.id)).size === v.clans.length, {
    message: 'Dois clãs com o mesmo id.',
    path: ['clans'],
  });

export type VillageFormValues = z.infer<typeof villageSchema>;

// ---- Blog (posts) - mesmas regras do backend (app/schemas/posts.py) ----

export const postSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório.').max(200, 'Máximo de 200 caracteres.'),
  slug: z
    .string()
    .min(1, 'O slug é obrigatório.')
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use só letras minúsculas, números e hífen (ex: patch-notes-1-2).'),
  excerpt: z.string(),
  content: z.string(),
  coverImage: z.string().nullable().optional(),
});

export type PostFormValues = z.infer<typeof postSchema>;
