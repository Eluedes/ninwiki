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
    .min(1, 'The slug is required.')
    .max(150, 'The slug can have at most 150 characters.')
    .regex(/^[a-z0-9-]+$/, 'Use only lowercase letters, numbers and hyphens (e.g. fire-larva).'),
  category: z.enum(['mobs', 'items', 'guides', 'weapons', 'missions']),
  name: z.string().min(1, 'The name is required.').max(200, 'The name can have at most 200 characters.'),
  level: z.coerce.number().int('Level must be a whole number.').min(0, 'Level cannot be negative.'),
  icon: z.string().min(1, 'Pick an icon (emoji).').max(20),
  image: z.string().nullable().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'enchanted']),
  // Opcional para mobs (bestiario) - validado no superRefine abaixo.
  description: z.string(),
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
  itemType: z.enum(['general', 'ring', 'consumable', 'material', 'currency', 'cast', 'authority', 'accessory']).nullable().optional(),
}).superRefine((value, ctx) => {
  // Descricao e' obrigatoria em todas as categorias, exceto mobs.
  if (value.category !== 'mobs' && !value.description.trim()) {
    ctx.addIssue({ code: 'custom', path: ['description'], message: 'The description is required.' });
  }
});

export type ContentItemFormValues = z.infer<typeof contentItemSchema>;

export const jutsuSchema = z.object({
  id: z
    .string()
    .min(1, 'The id/slug is required.')
    .max(80, 'The id can have at most 80 characters.')
    .regex(/^[a-z0-9-]+$/, 'Use only lowercase letters, numbers and hyphens (e.g. katon-goukakyuu).'),
  name: z.string().min(1, 'The name is required.'),
  namePt: z.string().nullable().optional(),
  masteryId: z.string().min(1, 'Escolha uma mastery.'),
  pathId: z.string().nullable().optional(),
  tier: z.coerce.number().int().min(1, 'Minimum tier is 1.').max(4, 'Maximum tier is 4.'),
  chakraCost: z.coerce.number().int().min(0, 'Chakra cost cannot be negative.'),
  description: z.string().min(1, 'The short description is required.'),
  longDescription: z.string().min(1, 'The full description is required.'),
  descriptionPt: z.string().nullable().optional(),
  longDescriptionPt: z.string().nullable().optional(),
  effect: z.string(),
  range: z.string(),
  castTime: z.string(),
  cooldown: z.string(),
  icon: z.string().min(1, 'Pick an icon.'),
  gif: z.string().nullable().optional(),
  // ficha completa (tudo opcional; linha vazia some da pagina)
  requiredLevel: z.string().max(50),
  requiredStat: z.string().max(100),
  scrollType: z.string().max(100),
  shop: z.string().max(100),
  // Uma linha por nivel do jutsu (a quantidade de linhas e' o nivel maximo): dano base e recarga de cada nivel.
  levels: z
    .array(z.object({ name: z.string().max(100, 'Maximum of 100 characters.'), damage: z.string().max(40, 'Maximum of 40 characters.'), cooldown: z.string().max(40, 'Maximum of 40 characters.') }))
    .min(1)
    .max(10, 'Maximum of 10 levels.'),
  castType: z.string().max(100),
  jutsuClass: z.string().max(100),
  debuff: z.string().max(150),
});

export type JutsuFormValues = z.infer<typeof jutsuSchema>;

export const masterySchema = z.object({
  name: z.string().min(1, 'The name is required.').max(100),
  namePt: z.string().nullable().optional(),
  description: z.string().min(1, 'The description is required.'),
  longDescription: z.string().min(1, 'The full description is required.'),
  descriptionPt: z.string().nullable().optional(),
  longDescriptionPt: z.string().nullable().optional(),
  icon: z.string().min(1, 'Pick an icon.').max(50),
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
const slugMessage = 'Use only lowercase letters, numbers and hyphens (e.g. leaf-village).';

export const clanSchema = z.object({
  id: z.string().min(1, 'The clan id is required.').max(50).regex(slugRegex, slugMessage),
  name: z.string().min(1, 'The clan name is required.').max(100),
  // Traducao EN -> PT (vazio = a DeepL traduz ao salvar)
  namePt: z.string().max(100).nullable().optional(),
  descriptionPt: z.string().nullable().optional(),
  description: z.string(),
  image: z.string().max(500).nullable().optional(),
});

export const villageSchema = z
  .object({
    id: z.string().min(1, 'The id/slug is required.').max(50).regex(slugRegex, slugMessage),
    name: z.string().min(1, 'The name is required.').max(100),
    namePt: z.string().max(100).nullable().optional(),
    element: z.string().min(1, 'The element is required.').max(50),
    motto: z.string().max(200),
    description: z.string(),
    longDescription: z.string(),
    // Traducoes EN -> PT (vazio = a DeepL traduz ao salvar)
    mottoPt: z.string().max(200).nullable().optional(),
    descriptionPt: z.string().nullable().optional(),
    longDescriptionPt: z.string().nullable().optional(),
    climatePt: z.string().max(200).nullable().optional(),
    emblem: z.string().min(1, 'The emblem is required.').max(20),
    image: z.string().nullable().optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a color in the #RRGGBB format.'),
    climate: z.string().max(200),
    leader: z.string().max(100),
    mapX: z.coerce.number().min(0, 'Entre 0 e 100.').max(100, 'Entre 0 e 100.'),
    mapY: z.coerce.number().min(0, 'Entre 0 e 100.').max(100, 'Entre 0 e 100.'),
    clans: z.array(clanSchema),
  })
  .refine((v) => new Set(v.clans.map((c) => c.id)).size === v.clans.length, {
    message: 'Two clans with the same id.',
    path: ['clans'],
  });

export type VillageFormValues = z.infer<typeof villageSchema>;

// ---- Blog (posts) - mesmas regras do backend (app/schemas/posts.py) ----

export const postSchema = z.object({
  title: z.string().min(1, 'The title is required.').max(200, 'Maximum of 200 characters.'),
  slug: z
    .string()
    .min(1, 'The slug is required.')
    .max(150)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use only lowercase letters, numbers and hyphens (e.g. patch-notes-1-2).'),
  excerpt: z.string(),
  content: z.string(),
  // Traducoes EN -> PT (vazio = a DeepL traduz ao salvar)
  titlePt: z.string().max(200).nullable().optional(),
  excerptPt: z.string().nullable().optional(),
  contentPt: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  tags: z.array(z.string()).max(8, 'Maximum of 8 tags.'),
  // SEO e agendamento (vazio = automatico / publicar agora)
  metaTitle: z.string().max(70, 'Maximum of 70 characters.').nullable().optional(),
  metaDescription: z.string().max(200, 'Maximum of 200 characters.').nullable().optional(),
  publishedAt: z.string().nullable().optional(),
});

export type PostFormValues = z.infer<typeof postSchema>;
