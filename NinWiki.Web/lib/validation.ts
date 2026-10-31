// Schemas Zod para validacao de formulario no FRONT-END - espelham as
// mesmas regras que o backend ja aplica em app/schemas/content.py e
// app/schemas/masteries.py (min_length, ge=0, etc.). Ter as duas
// validacoes (front E back) e' proposital, nao redundante: o front
// avisa a pessoa NA HORA, campo por campo, antes de qualquer
// requisicao sair; o back continua sendo quem decide de verdade (nunca
// confiar cegamente no que o navegador validou, alguem pode bater
// direto na API pulando o formulario).

import { z } from 'zod';

// Nome/titulo: basta escrever em UM dos idiomas. Se so' o portugues vier preenchido, a API gera o ingles ao salvar (dicionario do jogo/DeepL).
const EN_OR_PT = 'Fill in this field in English or in Portuguese. / Preencha este campo em inglês ou em português.';
type CampoAdd = { addIssue: (i: { code: 'custom'; path: string[]; message: string }) => void };
/** Exige pelo menos um dos dois textos (EN ou PT); o erro aparece no campo `path` (o campo em ingles). */
function exigeUmDosDois(ctx: CampoAdd, en: string | null | undefined, pt: string | null | undefined, path: string): void {
  if (!(en ?? '').trim() && !(pt ?? '').trim()) ctx.addIssue({ code: 'custom', path: [path], message: EN_OR_PT });
}

export const contentItemSchema = z.object({
  slug: z
    .string()
    .min(1, 'The slug is required.')
    .max(150, 'The slug can have at most 150 characters.')
    .regex(/^[a-z0-9-]+$/, 'Use only lowercase letters, numbers and hyphens (e.g. fire-larva).'),
  category: z.enum(['mobs', 'items', 'guides', 'weapons', 'missions']),
  name: z.string().max(200, 'The name can have at most 200 characters.'),   // EN ou PT (ver superRefine)
  level: z.coerce.number().int('Level must be a whole number.').min(0, 'Level cannot be negative.'),
  levelUnknown: z.boolean(),
  icon: z.string().min(1, 'Pick an icon (emoji).').max(20),
  image: z.string().nullable().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'enchanted', 'unique', 'event', 'premium', 'organization']),
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
  itemType: z.enum(['general', 'ring', 'consumable', 'material', 'currency', 'cast', 'authority', 'accessory', 'shirt', 'vest', 'pant', 'hat', 'mask', 'shoe', 'pack']).nullable().optional(),
}).superRefine((value, ctx) => {
  exigeUmDosDois(ctx, value.name, value.namePt, 'name');
  // Descricao e' obrigatoria em todas as categorias, exceto mobs (em ingles OU em portugues).
  if (value.category !== 'mobs' && !value.description.trim() && !(value.descriptionPt ?? '').trim()) {
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
  name: z.string(),   // EN ou PT (ver superRefine)
  namePt: z.string().nullable().optional(),
  masteryId: z.string().min(1, 'Escolha uma mastery.'),
  pathId: z.string().nullable().optional(),
  tier: z.coerce.number().int().min(1, 'Minimum tier is 1.').max(5, 'Maximum tier is 5.'),
  chakraCost: z.coerce.number().int().min(0, 'Chakra cost cannot be negative.'),
  // A descricao curta e' obrigatoria so' para jutsu de jogador (o Jutsu NPC usa apenas a descricao completa): ver superRefine abaixo.
  description: z.string(),
  longDescription: z.string(),   // obrigatoria so' para jutsu publicado: ver superRefine abaixo
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
  isNpc: z.boolean(),
  allowedWeapons: z.string().max(100),
  status: z.enum(['draft', 'published']),
}).superRefine((value, ctx) => {
  exigeUmDosDois(ctx, value.name, value.namePt, 'name');
  if (value.status === 'draft') return;   // rascunho pode ser salvo incompleto (os jutsus criados em massa vem so' com o nome)
  if (!value.longDescription.trim() && !(value.longDescriptionPt ?? '').trim()) {
    ctx.addIssue({ code: 'custom', path: ['longDescription'], message: 'The full description is required.' });
  }
  if (!value.isNpc && !value.description.trim() && !(value.descriptionPt ?? '').trim()) {
    ctx.addIssue({ code: 'custom', path: ['description'], message: 'The short description is required.' });
  }
});

export type JutsuFormValues = z.infer<typeof jutsuSchema>;

export const masterySchema = z.object({
  name: z.string().max(100),   // EN ou PT (ver superRefine)
  namePt: z.string().nullable().optional(),
  description: z.string(),
  longDescription: z.string(),
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
}).superRefine((value, ctx) => {
  exigeUmDosDois(ctx, value.name, value.namePt, 'name');
  exigeUmDosDois(ctx, value.description, value.descriptionPt, 'description');
  exigeUmDosDois(ctx, value.longDescription, value.longDescriptionPt, 'longDescription');
});

export type MasteryFormValues = z.infer<typeof masterySchema>;
// ---- Vilas e Clas (mesmas regras do backend: app/schemas/villages.py) ----

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugMessage = 'Use only lowercase letters, numbers and hyphens (e.g. leaf-village).';

export const clanSchema = z.object({
  id: z.string().min(1, 'The clan id is required.').max(50).regex(slugRegex, slugMessage),
  name: z.string().max(100),   // EN ou PT (ver superRefine)
  // Traducao EN -> PT (vazio = a DeepL traduz ao salvar)
  namePt: z.string().max(100).nullable().optional(),
  descriptionPt: z.string().nullable().optional(),
  description: z.string(),
  image: z.string().max(500).nullable().optional(),
}).superRefine((value, ctx) => exigeUmDosDois(ctx, value.name, value.namePt, 'name'));

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

// Artigo do Guia (espelha GuideArticleWrite em app/schemas/guide.py). O texto rico so' e' validado de verdade na API.
export const guideArticleSchema = z.object({
  id: z.string().min(1, 'The id/slug is required.').max(80).regex(slugRegex, slugMessage),
  section: z.enum(['new-player', 'combat', 'progression', 'interface', 'economy']),
  position: z.coerce.number().int().min(0, 'Minimum is 0.').max(999, 'Maximum is 999.'),
  title: z.string().max(150),   // EN ou PT (ver superRefine)
  titlePt: z.string().max(150).nullable().optional(),
  summary: z.string().max(300, 'Maximum of 300 characters.'),
  summaryPt: z.string().max(300, 'Maximum of 300 characters.').nullable().optional(),
  body: z.string(),
  bodyPt: z.string().nullable().optional(),
  icon: z.string().min(1, 'Pick an icon.'),
  status: z.enum(['draft', 'published']),
}).superRefine((value, ctx) => exigeUmDosDois(ctx, value.title, value.titlePt, 'title'));

export type GuideArticleFormValues = z.infer<typeof guideArticleSchema>;

// Proficiencia (espelha ProfessionWrite em app/schemas/guide.py).
export const professionSchema = z.object({
  id: z.string().min(1, 'The id/slug is required.').max(50).regex(slugRegex, slugMessage),
  name: z.string().max(100),   // EN ou PT (ver superRefine)
  namePt: z.string().max(100).nullable().optional(),
  group: z.enum(['gathering', 'crafting']),
  description: z.string(),
  descriptionPt: z.string().nullable().optional(),
  icon: z.string().min(1, 'The emoji is required.').max(20),
}).superRefine((value, ctx) => {
  exigeUmDosDois(ctx, value.name, value.namePt, 'name');
  exigeUmDosDois(ctx, value.description, value.descriptionPt, 'description');
});

export type ProfessionFormValues = z.infer<typeof professionSchema>;

// ---- Blog (posts) - mesmas regras do backend (app/schemas/posts.py) ----

export const postSchema = z.object({
  title: z.string().max(200, 'Maximum of 200 characters.'),   // EN ou PT (ver superRefine)
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
  bannerImage: z.string().nullable().optional(),
  tags: z.array(z.string()).max(8, 'Maximum of 8 tags.'),
  // SEO e agendamento (vazio = automatico / publicar agora)
  metaTitle: z.string().max(70, 'Maximum of 70 characters.').nullable().optional(),
  metaDescription: z.string().max(200, 'Maximum of 200 characters.').nullable().optional(),
  publishedAt: z.string().nullable().optional(),
}).superRefine((value, ctx) => exigeUmDosDois(ctx, value.title, value.titlePt, 'title'));

export type PostFormValues = z.infer<typeof postSchema>;

// ---- Formulario publico de voluntarios (/volunteer). Espelha app/schemas/volunteers.py::VolunteerApply. ----
// As mensagens sao CHAVES (required, tooShort...): a tela traduz com dict.volunteer.errors, entao aqui nao ha' texto de idioma.
const vText = (min: number, max: number) => z.string().trim().min(1, 'required').min(min, 'tooShort').max(max, 'tooLong');

export const volunteerSchema = z.object({
  name: vText(2, 80),
  discord: vText(2, 64),
  gameNick: vText(1, 60),
  languages: vText(2, 120),
  areas: z.array(z.enum(['translation', 'wiki-editing', 'data-collection', 'mapping', 'bot-dev', 'art-graphics', 'moderation', 'other'])).min(1, 'pickArea'),
  availability: vText(2, 200),
  experience: vText(10, 1500),
  motivation: vText(10, 1500),
  contactEmail: z.string().trim().max(120, 'tooLong').refine((v) => v === '' || /^[^@\s]{1,64}@[^@\s]{1,60}\.[^@\s]{2,20}$/.test(v), 'invalidEmail'),
  consent: z.boolean().refine((v) => v === true, 'consentRequired'),
  website: z.string().max(200),   // isca anti-robo (nunca preenchida por pessoas)
});

export type VolunteerFormValues = z.infer<typeof volunteerSchema>;
