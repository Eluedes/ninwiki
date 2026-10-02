// Cliente da API do NinWiki.Api - chamadas fetch() reais, tipadas, pra
// substituir aos poucos as funcoes mockadas de lib/data.ts.
//
// So' cobre content_items (mobs/itens/armas/missoes/guias) por
// enquanto - masteries/villages/blog ainda nao tem endpoint no
// backend, entao continuam usando os arquivos *-data.ts mockados.
//
// Formato dos dados: o backend usa camelCase na entrada/saida (ver
// app/schemas/content.py no NinWiki.Api), entao os tipos aqui batem
// direto com WikiEntry de lib/types.ts, sem precisar converter nada.

import type { Category, ItemType, MobType, Rarity } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// Evento disparado quando a API responde 401 (sessao expirou / foi derrubada) -
// o AuthProvider escuta e manda a pessoa de volta pro login (ver
// components/providers/auth-provider.tsx), sem cada tela precisar tratar isso.
export const UNAUTHORIZED_EVENT = 'ninwiki:unauthorized';

// Tipos PROPRIOS da API (nao reaproveitam AttributeRow/DropEntry de
// lib/types.ts de proposito - o formato e' parecido mas nao identico:
// aqui `value` e' sempre string, e o drop usa `itemName`, nao `name`,
// batendo com o schema real do backend, ver app/schemas/content.py).
export interface ApiAttributeRow {
  label: string;
  value: string;
}

export interface ApiDropEntry {
  itemName: string;
  rarity: Rarity;
  chance: number;
  // Como o `chance` deve ser EXIBIDO na ficha publica (ex: "Over 10%",
  // "Below 1%") - espelha a ficha do proprio jogo, que nunca mostra o
  // numero exato pro jogador. null = mostra o numero exato (formato
  // antigo, de antes desse campo existir).
  chanceQualifier?: 'over' | 'below' | null;
  minQty?: number | null;
  maxQty?: number | null;
  // Liga esse drop a uma entry de verdade do catalogo. droppedItemSlug
  // so' vem preenchido quando o item ligado esta' PUBLICADO - o front
  // usa isso (nao droppedItemId) pra decidir se mostra um link ou so'
  // texto, sem precisar checar status nenhum aqui (a API ja' decide).
  droppedItemId?: string | null;
  droppedItemSlug?: string | null;
}

// Formato completo de uma entry vinda da API (equivalente a WikiEntry,
// mas com os campos que so' existem no banco: id real e status editorial).
export interface ApiAttackEntry {
  name: string;
}

export interface ApiContentItem {
  id: string;
  slug: string;
  category: Category;
  name: string;
  level: number;
  icon: string;
  image: string | null;
  rarity: Rarity;
  description: string;
  lore: string | null;
  synergy: string | null;
  // So' usado quando category === 'mobs' - onde o mob spawna no mapa
  // (texto livre por enquanto, ex: "Floresta Negra, Campos Iniciais").
  spawnLocation: string | null;
  // ---- Versoes em portugues (traducao automatica via DeepL, EN->PT) -
  // sempre
  // editaveis a mao, mesmo depois de preenchidas automaticamente. ----
  namePt: string | null;
  descriptionPt: string | null;
  lorePt: string | null;
  synergyPt: string | null;
  spawnLocationPt: string | null;
  // ---- Fixos so' de MOBS (substituem a lista generica de Atributos
  // pra essa categoria) ----
  mobHealth: string | null;
  mobDamage: string | null;
  mobExperience: string | null;
  mobRange: string | null;
  mobRespawnTime: string | null;
  attacks: ApiAttackEntry[];
  // ---- Fixos so' de ARMAS (categoria weapons) ----
  weaponSpeed: string | null;
  weaponRequirement: string | null;
  weaponNpc: string | null;
  weaponType: string | null;
  weaponBaseDamage: string | null;
  weaponSpecialAbility: string | null;
  weaponKnockbackDistance: string | null;
  // ---- Fixos so' de ITEM tipo Currency/Cast ----
  maxStack: number | null;
  castVillageId: string | null;
  // Nome de exibicao da vila (ex: "Vila da Névoa") - calculado pela
  // API a partir de castVillageId, so' pra' nao precisar de uma
  // segunda requisicao no front so' pra mostrar o nome.
  castVillageName: string | null;
  mobType: MobType | null;
  itemType: ItemType | null;
  attributes: ApiAttributeRow[];
  drops: ApiDropEntry[];
  status: 'draft' | 'published';
}

// Versao enxuta usada nas listagens (sem attributes/drops/lore/synergy) -
// espelha ContentItemSummary no backend.
export interface ApiContentItemSummary {
  id: string;
  slug: string;
  category: Category;
  name: string;
  level: number;
  icon: string;
  image: string | null;
  rarity: Rarity;
  mobType: MobType | null;
  itemType: ItemType | null;
  status: 'draft' | 'published';
  updatedAt: string;
  description: string;
  namePt: string | null;
  descriptionPt: string | null;
}
// controla os dois: id e' gerado, status so' muda explicitamente no
// PUT, nunca no POST, que sempre nasce "draft").
export interface ContentItemInput {
  slug: string;
  category: Category;
  name: string;
  level: number;
  icon: string;
  image?: string | null;
  rarity: Rarity;
  description: string;
  lore?: string | null;
  synergy?: string | null;
  spawnLocation?: string | null;
  namePt?: string | null;
  descriptionPt?: string | null;
  lorePt?: string | null;
  synergyPt?: string | null;
  spawnLocationPt?: string | null;
  mobHealth?: string | null;
  mobDamage?: string | null;
  mobExperience?: string | null;
  mobRange?: string | null;
  mobRespawnTime?: string | null;
  attacks: ApiAttackEntry[];
  weaponSpeed?: string | null;
  weaponRequirement?: string | null;
  weaponNpc?: string | null;
  weaponType?: string | null;
  weaponBaseDamage?: string | null;
  weaponSpecialAbility?: string | null;
  weaponKnockbackDistance?: string | null;
  maxStack?: number | null;
  castVillageId?: string | null;
  mobType?: MobType | null;
  itemType?: ItemType | null;
  attributes: ApiAttributeRow[];
  drops: ApiDropEntry[];
  status?: 'draft' | 'published'; // so' usado no update
}

// Erro customizado pra' quando a API responde com um erro "esperado"
// (404, 409, etc.) - assim quem chama consegue mostrar a mensagem
// certa pro usuario em vez de um erro generico de rede.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Chamada base a' API: manda o cookie de sessao, lê o JSON e transforma erros em ApiError com a mensagem da API. */
async function apiFetch<T>(path: string, options?: RequestInit, quiet = false): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // credentials: 'include' = manda o cookie de SESSAO (httpOnly) junto. Sem
    // isso o navegador nao anexa o cookie em chamadas pra' outra porta/origem
    // e todo endpoint protegido responderia 401.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  // quiet = chamada de LEITOR do site: 401 ali so' significa "entre com o Discord", nunca derruba a sessao da equipe.
  if (res.status === 401 && !quiet && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    // A API devolve {"detail": "mensagem"} nos erros (padrao do
    // FastAPI/HTTPException) - tenta ler essa mensagem antes de
    // desistir e mostrar so' o codigo HTTP.
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.detail ?? `Erro ${res.status}`);
  }
  // 204 No Content (resposta do DELETE) nao tem corpo pra' converter em JSON.
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Lista entries do catalogo (filtros opcionais: categoria, status e busca por nome). */
export function listContentItems(
  category?: Category,
  status?: 'draft' | 'published',
  search?: string
): Promise<ApiContentItemSummary[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const query = params.toString();
  return apiFetch(`/content-items${query ? `?${query}` : ''}`);
}

/** Ficha completa de uma entry pelo id. */
export function getContentItem(id: string): Promise<ApiContentItem> {
  return apiFetch(`/content-items/${id}`);
}

// Busca pelo SLUG (ex: "larva"), nao o uuid - usado pelo site publico,
// que quer URLs legiveis (/detail/larva) em vez do id tecnico do banco.
export function getContentItemBySlug(slug: string): Promise<ApiContentItem> {
  return apiFetch(`/content-items/slug/${slug}`);
}

/** Cria uma entry (painel; exige content.create). */
export function createContentItem(payload: ContentItemInput): Promise<ApiContentItem> {
  return apiFetch('/content-items', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita uma entry (painel). */
export function updateContentItem(id: string, payload: ContentItemInput): Promise<ApiContentItem> {
  return apiFetch(`/content-items/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

// Forca uma traducao NOVA em todos os campos traduziveis, mesmo os
// que ja' tem "_en" preenchido - diferente do preenchimento automatico
// do create/update (que so' toca campo vazio). Usado pelo botao
// "Retraduzir" no editor.
export function retranslateContentItem(id: string): Promise<ApiContentItem> {
  return apiFetch(`/content-items/${id}/retranslate`, { method: 'POST' });
}

/** Apaga uma entry (painel; exige content.delete). */
export function deleteContentItem(id: string): Promise<void> {
  return apiFetch(`/content-items/${id}`, { method: 'DELETE' });
}

// ---- Masteries e Jutsus ----
// Masteries so' tem leitura (sao os 8 caminhos fixos do jogo). Jutsus
// tem CRUD completo - e' a parte que a equipe realmente edita.

export interface ApiMasteryPath {
  id: string;
  label: string;
  description: string;
  requirement: string | null;
}

export interface ApiMastery {
  id: string;
  name: string;
  namePt: string | null;
  type: 'elemental' | 'non-elemental';
  element: string;
  description: string;
  longDescription: string;
  descriptionPt: string | null;
  longDescriptionPt: string | null;
  icon: string;
  color: string;
  image: string | null;
  // GIF de demonstracao exibido no topo da "Mastery Sheet" (Infobox) da
  // pagina de detalhe - opcional, null quando nao ha nenhum.
  gif: string | null;
  paths: ApiMasteryPath[];
  attributeIds: string[];
}

export interface ApiAttribute {
  id: string;
  name: string;
  namePt: string | null;
  description: string;
  descriptionPt?: string | null;
  icon: string;
}

// Corpo aceito em PUT /masteries/{id} - sem id/type/element (esses 3
// continuam fixos, sao a identidade do elemento em si).
export interface MasteryInput {
  name: string;
  namePt?: string | null;
  description: string;
  longDescription: string;
  descriptionPt?: string | null;
  longDescriptionPt?: string | null;
  icon: string;
  color: string;
  image: string | null;
  gif?: string | null;
  attributeIds: string[];
  paths: ApiMasteryPath[];
}

export interface ApiJutsu {
  id: string;
  name: string;
  namePt: string | null;
  masteryId: string;
  pathId: string | null;
  tier: number;
  chakraCost: number;
  description: string;
  longDescription: string;
  descriptionPt: string | null;
  longDescriptionPt: string | null;
  effect: string;
  range: string;
  castTime: string;
  cooldown: string;
  icon: string;
  gif: string | null;
  // ficha completa (linha vazia nao aparece na pagina)
  requiredLevel: string;
  requiredStat: string;
  scrollType: string;
  shop: string;
  maxLevel: number;
  damageByLevel: string[];
  cooldownByLevel: string[];
  castType: string;
  jutsuClass: string;
  debuff: string;
}

// Corpo aceito em criar/editar um jutsu - igual a ApiJutsu, mas `id`
// e' obrigatorio na CRIACAO tambem (o slug e' escolhido por quem
// cria, nao gerado pelo servidor como em content_items).
export type JutsuInput = ApiJutsu;

/** Lista as masteries com seus caminhos. */
export function listMasteries(): Promise<ApiMastery[]> {
  return apiFetch('/masteries');
}

/** Ficha de uma mastery pelo id. */
export function getMastery(id: string): Promise<ApiMastery> {
  return apiFetch(`/masteries/${id}`);
}

/** Edita uma mastery (painel; as masteries sao fixas, nao se criam nem apagam). */
export function updateMastery(id: string, payload: MasteryInput): Promise<ApiMastery> {
  return apiFetch(`/masteries/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Forca a retraducao automatica de uma mastery. */
export function retranslateMastery(id: string): Promise<ApiMastery> {
  return apiFetch(`/masteries/${id}/retranslate`, { method: 'POST' });
}

/** Lista os atributos do jogo (Strength, Agility...). */
export function listAttributes(): Promise<ApiAttribute[]> {
  return apiFetch('/attributes');
}

/** Lista jutsus, opcionalmente so' os de uma mastery. */
export function listJutsus(masteryId?: string): Promise<ApiJutsu[]> {
  const query = masteryId ? `?masteryId=${masteryId}` : '';
  return apiFetch(`/jutsus${query}`);
}

/** Ficha de um jutsu pelo id. */
export function getJutsu(id: string): Promise<ApiJutsu> {
  return apiFetch(`/jutsus/${id}`);
}

/** Cria um jutsu (painel; exige lore.edit). */
export function createJutsu(payload: JutsuInput): Promise<ApiJutsu> {
  return apiFetch('/jutsus', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita um jutsu (painel). */
export function updateJutsu(id: string, payload: JutsuInput): Promise<ApiJutsu> {
  return apiFetch(`/jutsus/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Forca a retraducao automatica de um jutsu. */
export function retranslateJutsu(id: string): Promise<ApiJutsu> {
  return apiFetch(`/jutsus/${id}/retranslate`, { method: 'POST' });
}

/** Apaga um jutsu (painel; exige lore.delete). */
export function deleteJutsu(id: string): Promise<void> {
  return apiFetch(`/jutsus/${id}`, { method: 'DELETE' });
}

// ---- Log de auditoria ----

export interface ApiAuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown> | null;
  createdAt: string;
  // Quem fez (fotografia do momento - continua certo mesmo se a pessoa mudar de nome/cargo depois)
  actorName: string | null;
  actorRole: string | null;
  // De onde veio: panel | bot | auth | system
  source: string;
  // So' o S.Adm recebe o IP; pra' os outros cargos vem sempre null.
  ipAddress: string | null;
}

/** Ultimas acoes do log geral (o que cada cargo ve' e' decidido pela API). */
export function listAuditLog(limit = 50, entityType?: string): Promise<ApiAuditLogEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (entityType) params.set('entityType', entityType);
  return apiFetch(`/audit-log?${params.toString()}`);
}

/** Limpa o log (so' S.Adm): sem argumento apaga TUDO; com `olderThanDays` apaga so' o que passou de N dias. */
export function clearAuditLog(olderThanDays?: number): Promise<{ deleted: number }> {
  return apiFetch(`/audit-log${olderThanDays ? `?olderThanDays=${olderThanDays}` : ''}`, { method: 'DELETE' });
}

// Historico de UMA entry especifica (usado na aba "Historico" dentro
// do editor) - mesmo endpoint do feed geral, so' filtrado por
// entityType+entityId. Ver a limitacao sobre bulk actions no
// docstring de list_audit_log no backend.
// Tipos de registro que tem historico por entry (o backend so' libera os de conteudo pra quem nao e' S.Adm).
export type HistoryEntityType = 'content_item' | 'jutsu' | 'post';

/** Historico de alteracoes de UMA entry (post, jutsu ou conteudo). */
export function listEntryHistory(entityType: HistoryEntityType, entityId: string): Promise<ApiAuditLogEntry[]> {
  return apiFetch(`/audit-log?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&limit=50`);
}

// ---- Acoes em massa (bulk) ----

export function bulkUpdateContentStatus(ids: string[], status: 'draft' | 'published'): Promise<ApiContentItemSummary[]> {
  return apiFetch('/content-items/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) });
}

/** Apaga varias entries de uma vez. */
export function bulkDeleteContentItems(ids: string[]): Promise<void> {
  return apiFetch('/content-items/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
}

/** Apaga varios jutsus de uma vez. */
export function bulkDeleteJutsus(ids: string[]): Promise<void> {
  return apiFetch('/jutsus/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
}

// ---- Upload de imagem ----

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  // Nao usa apiFetch() aqui de proposito: upload de arquivo usa
  // FormData, nao JSON, entao o header "Content-Type: application/json"
  // que apiFetch() sempre manda quebraria a requisicao (o navegador
  // precisa definir o Content-Type de multipart/form-data sozinho,
  // com o "boundary" certo - se a gente forcar outro valor, o FastAPI
  // nao consegue interpretar o arquivo).
  const res = await fetch(`${API_URL}/uploads/image`, { method: 'POST', body: formData, credentials: 'include' });
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.detail ?? `Erro ${res.status} ao enviar imagem`);
  }
  const data: { url: string } = await res.json();
  return data.url;
}

// ---- Importacao de JSON em massa ----

export interface BulkImportEntry {
  name: string;
  category: Category;
  mobType?: string | null;
  itemType?: string | null;
}

export interface BulkImportResult {
  created: number;
  skippedDuplicates: number;
}

/** Importa uma lista de nomes como entries em rascunho (importacao em massa). */
export function bulkImportContentItems(entries: BulkImportEntry[]): Promise<BulkImportResult> {
  return apiFetch('/content-items/bulk-import', { method: 'POST', body: JSON.stringify({ entries }) });
}

// ---- Vilas, Clas e Organizacoes ----

export interface ApiClan {
  id: string;
  name: string;
  villageId: string;
  description: string;
  // Traducao EN -> PT (DeepL); `name`/`description` sao o ingles (principal)
  namePt?: string | null;
  descriptionPt?: string | null;
  // Imagem do cla' (logo + roupa que usam), enviada pelo painel
  image: string | null;
}

export interface ApiOrganization {
  id: string;
  name: string;
  description: string;
  // Traducao EN -> PT (DeepL); `name`/`description` sao o ingles (principal)
  namePt?: string | null;
  descriptionPt?: string | null;
}

export interface ApiVillage {
  id: string;
  name: string;
  // `name` e' o ingles (principal); `namePt` a traducao (ver lib/localized.ts)
  namePt: string | null;
  element: string;
  motto: string;
  description: string;
  longDescription: string;
  // Traducoes EN -> PT (DeepL); os campos sem sufixo sao o ingles (principal)
  mottoPt?: string | null;
  descriptionPt?: string | null;
  longDescriptionPt?: string | null;
  climatePt?: string | null;
  emblem: string;
  image: string | null;
  accentColor: string;
  climate: string;
  leader: string;
  mapX: number;
  mapY: number;
  clans: ApiClan[];
  organizations: ApiOrganization[];
}

/** Lista as vilas com cla's e organizacoes. */
export function listVillages(): Promise<ApiVillage[]> {
  return apiFetch('/villages');
}

/** Ficha de uma vila pelo id. */
export function getVillage(id: string): Promise<ApiVillage> {
  return apiFetch(`/villages/${id}`);
}

// ---- Edicao de Vilas, Clas e Organizacoes (painel; exige permissao de Lore) ----

export interface ClanInput {
  id: string;
  name: string;
  description: string;
  // Vazio = a DeepL traduz EN -> PT ao salvar
  namePt?: string | null;
  descriptionPt?: string | null;
  image?: string | null;
}

export interface VillageInput {
  id: string;
  name: string;
  namePt?: string | null;
  element: string;
  motto: string;
  description: string;
  longDescription: string;
  // Vazio = a DeepL traduz EN -> PT ao salvar
  mottoPt?: string | null;
  descriptionPt?: string | null;
  longDescriptionPt?: string | null;
  climatePt?: string | null;
  emblem: string;
  image: string | null;
  accentColor: string;
  climate: string;
  leader: string;
  mapX: number;
  mapY: number;
  // A lista de clas enviada SUBSTITUI a atual (mesmo padrao de attributes/drops).
  clans: ClanInput[];
}

/** Cria uma vila com seus cla's (painel; exige lore.edit). */
export function createVillage(payload: VillageInput): Promise<ApiVillage> {
  return apiFetch('/villages', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita uma vila; a lista de cla's enviada substitui a atual. */
export function updateVillage(id: string, payload: VillageInput): Promise<ApiVillage> {
  return apiFetch(`/villages/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Apaga uma vila e seus cla's (painel; exige lore.delete). */
export function deleteVillage(id: string): Promise<void> {
  return apiFetch(`/villages/${id}`, { method: 'DELETE' });
}

// Organizacao + em quais vilas ela atua (a ligacao e' editada do lado da organizacao).
export interface ApiOrganizationAdmin extends ApiOrganization {
  villageIds: string[];
}

export interface OrganizationInput {
  id: string;
  name: string;
  description: string;
  // Vazio = a DeepL traduz EN -> PT ao salvar
  namePt?: string | null;
  descriptionPt?: string | null;
  villageIds: string[];
}

/** Lista as organizacoes e as vilas em que atuam. */
export function listOrganizations(): Promise<ApiOrganizationAdmin[]> {
  return apiFetch('/organizations');
}

/** Cria uma organizacao (painel). */
export function createOrganization(payload: OrganizationInput): Promise<ApiOrganizationAdmin> {
  return apiFetch('/organizations', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita uma organizacao e suas vilas. */
export function updateOrganization(id: string, payload: OrganizationInput): Promise<ApiOrganizationAdmin> {
  return apiFetch(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Apaga uma organizacao. */
export function deleteOrganization(id: string): Promise<void> {
  return apiFetch(`/organizations/${id}`, { method: 'DELETE' });
}

// ---- Extras de Guia: Profissoes, Ranks Ninja, Story Arcs, Summons ----

export interface ApiProfession {
  id: string;
  name: string;
  // `name` e' o ingles (principal); `namePt` a traducao (ver lib/localized.ts)
  namePt: string | null;
  group: 'gathering' | 'crafting';
  description: string;
  descriptionPt?: string | null;
  icon: string;
}

export interface ApiNinjaRank {
  id: string;
  name: string;
  // `name` e' o ingles (principal); `namePt` a traducao (ver lib/localized.ts)
  namePt: string | null;
  order: number;
  description: string;
  descriptionPt?: string | null;
}

export interface ApiStoryArc {
  id: string;
  name: string;
  namePt?: string | null;
  levelRange: string;
  description: string;
  descriptionPt?: string | null;
}

export interface ApiSummon {
  id: string;
  name: string;
  // `name` e' o ingles (principal); `namePt` a traducao (ver lib/localized.ts)
  namePt: string | null;
  village: string;
  villagePt?: string | null;
  stageYoung: string;
  stageTeen: string;
  stageAdult: string;
  stageYoungPt?: string | null;
  stageTeenPt?: string | null;
  stageAdultPt?: string | null;
}

/** Lista as profissoes (aba do Guia). */
export function listProfessions(): Promise<ApiProfession[]> {
  return apiFetch('/professions');
}

/** Lista os ranks ninja (aba do Guia). */
export function listNinjaRanks(): Promise<ApiNinjaRank[]> {
  return apiFetch('/ninja-ranks');
}

/** Lista os arcos de historia (aba do Guia). */
export function listStoryArcs(): Promise<ApiStoryArc[]> {
  return apiFetch('/story-arcs');
}

/** Lista os summons (aba do Guia). */
export function listSummons(): Promise<ApiSummon[]> {
  return apiFetch('/summons');
}

// ---- Fase 2: login, sessao e equipe ----

export type StaffRole = 'super_admin' | 'admin' | 'creator';

// Nomes das permissoes - espelham app/core/permissions.py::Permission no backend.
export type PermissionName =
  | 'content.create' | 'content.edit' | 'content.publish' | 'content.delete' | 'content.import'
  | 'posts.create' | 'posts.edit' | 'posts.publish' | 'posts.delete' | 'comments.moderate'
  | 'lore.edit' | 'lore.delete' | 'uploads.create' | 'translation.retranslate'
  | 'staff.view' | 'staff.create' | 'staff.edit' | 'staff.deactivate' | 'roles.manage' | 'errors.view'
  | 'notices.view' | 'notices.manage'
  | 'audit.view' | 'audit.view_all' | 'audit.clear' | 'analytics.view';

export interface ApiMe {
  id: string;
  // Discord ID vem como TEXTO de proposito: o JavaScript so' guarda inteiros
  // exatos ate' 2^53 e um ID do Discord passa disso (viraria um numero errado).
  discordId: string;
  username: string;
  avatarUrl: string | null;
  role: StaffRole;
  roleLabel: string;
  permissions: PermissionName[];
  assignableRoles: StaffRole[];
}

export interface ApiStaff {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
  role: StaffRole;
  isActive: boolean;
  isOwner: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthConfig {
  discordEnabled: boolean;
  devLoginEnabled: boolean;
}

// URL que inicia o login (a API redireciona pro Discord e depois de volta pro painel).
export const DISCORD_LOGIN_URL = `${API_URL}/auth/discord/login`;

/** Pergunta a' API se o login com Discord e o login de desenvolvimento estao ligados. */
export function getAuthConfig(): Promise<AuthConfig> {
  return apiFetch('/auth/config');
}

/** Quem esta' logado (ou erro 401): cargo, permissoes e cargos que pode dar. */
export function getMe(): Promise<ApiMe> {
  return apiFetch('/auth/me');
}

/** Login de desenvolvimento por Discord ID (so' funciona em ambiente local). */
export function devLogin(discordId: string): Promise<ApiMe> {
  return apiFetch('/auth/dev-login', { method: 'POST', body: JSON.stringify({ discordId }) });
}

/** Encerra a sessao. */
export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

/** Lista a equipe (so' S.Adm). */
export function listStaff(): Promise<ApiStaff[]> {
  return apiFetch('/staff');
}

/** Cadastra alguem na equipe (so' S.Adm). */
export function createStaff(payload: { discordId: string; role: StaffRole; username?: string }): Promise<ApiStaff> {
  return apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) });
}

/** Troca o cargo de alguem da equipe. */
export function updateStaffRole(id: string, role: StaffRole): Promise<ApiStaff> {
  return apiFetch(`/staff/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
}

/** Troca o nome (nick) de alguem da equipe (so' S.Adm, inclusive o proprio). */
export function updateStaffName(id: string, username: string): Promise<ApiStaff> {
  return apiFetch(`/staff/${id}/name`, { method: 'PATCH', body: JSON.stringify({ username }) });
}

/** Ativa ou desativa alguem da equipe. */
export function setStaffActive(id: string, active: boolean): Promise<ApiStaff> {
  return apiFetch(`/staff/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' });
}

// ---- Blog (posts) ----

export interface ApiTag {
  id: string; // slug (usado no filtro ?tag=)
  name: string; // ingles
  namePt?: string | null;
}

export interface ApiTagWithCount extends ApiTag {
  postCount: number;
}

export interface ApiPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  // Traducao EN -> PT (DeepL); title/excerpt/content sao o ingles (principal)
  titlePt?: string | null;
  excerptPt?: string | null;
  coverImage: string | null;
  status: 'draft' | 'published';
  authorName: string | null;
  tags: ApiTag[];
  publishedAt: string | null;
  isScheduled: boolean; // publicado com data no futuro (ainda invisivel ao publico)
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPost extends ApiPostSummary {
  // Tiptap JSON (texto rico) ou texto simples - mesmo formato de Conteudo
  content: string;
  contentPt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface PostInput {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  // Vazio = a DeepL traduz EN -> PT ao salvar
  titlePt?: string | null;
  excerptPt?: string | null;
  contentPt?: string | null;
  coverImage: string | null;
  status: 'draft' | 'published';
  tags: string[]; // slugs
  metaTitle?: string | null;
  metaDescription?: string | null;
  publishedAt?: string | null; // ISO; futuro = agendado
}

/** Lista posts do blog (o publico so' recebe os publicados e ja' no ar). `tag` filtra pelo slug da tag. */
export function listPosts(status?: 'draft' | 'published', tag?: string): Promise<ApiPostSummary[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (tag) params.set('tag', tag);
  const query = params.toString();
  return apiFetch(`/posts${query ? `?${query}` : ''}`);
}

/** Tags do blog com a contagem de posts no ar. */
export function listTags(): Promise<ApiTagWithCount[]> {
  return apiFetch('/tags');
}

/** Cria uma tag nova (so' o nome em ingles; exige posts.create). */
export function createTag(name: string): Promise<ApiTag> {
  return apiFetch('/tags', { method: 'POST', body: JSON.stringify({ name }) });
}

/** Procura itens/masteries para o "@" do editor (exige posts.create). */
export interface ApiMentionResult {
  id: string;
  label: string;
  href: string;
  kind: string;
}
export function searchMentions(q: string): Promise<ApiMentionResult[]> {
  return apiFetch(`/search/mentions?q=${encodeURIComponent(q)}`);
}

// ---- Leitores, curtidas e comentarios (site publico) ----
// Todas usam `quiet`: um 401 aqui so' quer dizer "entre com o Discord" - nunca deve derrubar a sessao da equipe.

export interface ApiReader {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface ApiEngagement {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface ApiComment {
  id: string;
  body: string;
  createdAt: string;
  author: { username: string; avatarUrl: string | null };
  mine: boolean;
}

/** Leitor logado agora (ou null). */
export function getReaderMe(): Promise<ApiReader | null> {
  return apiFetch('/auth/reader/me', undefined, true);
}

/** Sai da conta de leitor. */
export function readerLogout(): Promise<void> {
  return apiFetch('/auth/reader/logout', { method: 'POST' }, true);
}

/** Endereco que inicia o login de leitor com o Discord e volta para `returnTo` (caminho interno). */
export function readerLoginUrl(returnTo: string): string {
  return `${API_URL}/auth/discord/login?mode=reader&returnTo=${encodeURIComponent(returnTo)}`;
}

/** Curtidas/comentarios do post e se o leitor logado ja' curtiu. */
export function getEngagement(slug: string): Promise<ApiEngagement> {
  return apiFetch(`/posts/${encodeURIComponent(slug)}/engagement`, undefined, true);
}

/** Curte (liked=true) ou descurte o post. */
export function setLike(slug: string, liked: boolean): Promise<ApiEngagement> {
  return apiFetch(`/posts/${encodeURIComponent(slug)}/like`, { method: liked ? 'PUT' : 'DELETE' }, true);
}

/** Comentarios visiveis do post. */
export function listComments(slug: string): Promise<ApiComment[]> {
  return apiFetch(`/posts/${encodeURIComponent(slug)}/comments`, undefined, true);
}

/** Comenta no post (texto simples). */
export function addComment(slug: string, body: string): Promise<ApiComment> {
  return apiFetch(`/posts/${encodeURIComponent(slug)}/comments`, { method: 'POST', body: JSON.stringify({ body }) }, true);
}

/** Apaga o proprio comentario. */
export function deleteOwnComment(slug: string, id: string): Promise<void> {
  return apiFetch(`/posts/${encodeURIComponent(slug)}/comments/${id}`, { method: 'DELETE' }, true);
}

// ---- Moderacao de comentarios (painel; exige comments.moderate) ----

export interface ApiModerationComment {
  id: string;
  body: string;
  createdAt: string;
  hidden: boolean;
  hiddenBy: string | null;
  postSlug: string;
  postTitle: string;
  readerId: string;
  readerName: string;
  readerDiscordId: string;
  readerBanned: boolean;
}

/** Comentarios mais recentes (filtro: so' escondidos, busca por texto/nome). */
export function listModerationComments(onlyHidden: boolean, q: string): Promise<ApiModerationComment[]> {
  const params = new URLSearchParams();
  if (onlyHidden) params.set('only_hidden', 'true');
  if (q.trim()) params.set('q', q.trim());
  const query = params.toString();
  return apiFetch(`/comments/moderation${query ? `?${query}` : ''}`);
}

/** Esconde ou mostra um comentario. */
export function setCommentHidden(id: string, hidden: boolean): Promise<void> {
  return apiFetch(`/comments/moderation/${id}`, { method: 'PATCH', body: JSON.stringify({ hidden }) });
}

/** Apaga um comentario de vez. */
export function deleteCommentModeration(id: string): Promise<void> {
  return apiFetch(`/comments/moderation/${id}`, { method: 'DELETE' });
}

/** Bane ou desbane um leitor. */
export function setReaderBanned(readerId: string, banned: boolean): Promise<void> {
  return apiFetch(`/comments/moderation/readers/${readerId}`, { method: 'PATCH', body: JSON.stringify({ banned }) });
}

/** Ficha de um post pelo slug (pagina publica do blog). */
export function getPostBySlug(slug: string): Promise<ApiPost> {
  return apiFetch(`/posts/slug/${encodeURIComponent(slug)}`);
}

/** Ficha de um post pelo id (painel). */
export function getPost(id: string): Promise<ApiPost> {
  return apiFetch(`/posts/${id}`);
}

/** Cria um post (painel). */
export function createPost(payload: PostInput): Promise<ApiPost> {
  return apiFetch('/posts', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita um post (painel). */
export function updatePost(id: string, payload: PostInput): Promise<ApiPost> {
  return apiFetch(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Apaga um post (painel). */
export function deletePost(id: string): Promise<void> {
  return apiFetch(`/posts/${id}`, { method: 'DELETE' });
}


// ---- Cargos e permissoes editaveis (so' S.Adm) ----

export interface ApiPermissionInfo {
  name: PermissionName;
  group: string;
  // Exclusiva do S.Adm: nao pode ser dada a Adm/Creator
  superOnly: boolean;
  defaults: Record<string, boolean>;
}

export interface ApiRolePermissions {
  role: StaffRole;
  label: string;
  editable: boolean;
  permissions: PermissionName[];
}

export interface ApiRolesOverview {
  roles: ApiRolePermissions[];
  permissions: ApiPermissionInfo[];
}

/** Catalogo de permissoes + o que cada cargo tem hoje (so' S.Adm). */
export function getRolesOverview(): Promise<ApiRolesOverview> {
  return apiFetch('/roles/permissions');
}

/** Define as permissoes de um cargo (Adm ou Creator). */
export function setRolePermissions(role: StaffRole, permissions: PermissionName[]): Promise<ApiRolesOverview> {
  return apiFetch(`/roles/${role}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) });
}

/** Volta as permissoes de um cargo ao padrao de fabrica. */
export function resetRolePermissions(role: StaffRole): Promise<ApiRolesOverview> {
  return apiFetch(`/roles/${role}/permissions/reset`, { method: 'POST' });
}

// ---- Quadro de avisos da equipe ----

export interface ApiNoticeFile {
  id: string;
  filename: string;
  size: number;
}

export interface ApiNotice {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  files: ApiNoticeFile[];
}

export interface NoticeInput {
  title: string;
  body: string;
  pinned: boolean;
}

/** Lista os avisos do quadro da equipe (fixados primeiro). */
export function listNotices(): Promise<ApiNotice[]> {
  return apiFetch('/notices');
}

/** Posta um aviso no quadro da equipe. */
export function createNotice(payload: NoticeInput): Promise<ApiNotice> {
  return apiFetch('/notices', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita um aviso. */
export function updateNotice(id: string, payload: NoticeInput): Promise<ApiNotice> {
  return apiFetch(`/notices/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Apaga um aviso e seus arquivos. */
export function deleteNotice(id: string): Promise<void> {
  return apiFetch(`/notices/${id}`, { method: 'DELETE' });
}

/**
 * Anexa um arquivo a um aviso (multipart) com PROGRESSO (0-100) e limite de tempo. Usa XMLHttpRequest (e nao fetch) porque so'
 * ele informa o andamento do envio - arquivo grande (.zip/.rar) leva tempo e a tela nao pode ficar "girando" sem dizer nada.
 * Sempre termina: ou devolve o aviso atualizado, ou lanca ApiError com o motivo (inclusive queda de conexao e tempo esgotado).
 */
export function uploadNoticeFile(noticeId: string, file: File, onProgress?: (percent: number) => void): Promise<ApiNotice> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/notices/${noticeId}/files`);
    xhr.withCredentials = true; // manda o cookie de sessao; o Content-Type multipart o navegador define sozinho
    xhr.timeout = 10 * 60 * 1000; // 10 minutos
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { detail?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // resposta que nao e' JSON (ex: erro de um proxy no meio do caminho)
      }
      if (xhr.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      if (xhr.status >= 200 && xhr.status < 300 && body) return resolve(body as unknown as ApiNotice);
      const hint = xhr.status === 413 ? ' (file too large for the server)' : '';
      reject(new ApiError(xhr.status, body?.detail ?? `Erro ${xhr.status}${hint}`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Connection lost while sending the file (it may be too large for the server).'));
    xhr.ontimeout = () => reject(new ApiError(0, 'The upload took too long and was cancelled.'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.'));
    xhr.send(formData);
  });
}

/** Remove um arquivo anexado de um aviso. */
export function deleteNoticeFile(noticeId: string, fileId: string): Promise<ApiNotice> {
  return apiFetch(`/notices/${noticeId}/files/${fileId}`, { method: 'DELETE' });
}

// Link direto de download (o navegador manda o cookie de sessao; a API devolve como anexo).
export function noticeFileUrl(fileId: string): string {
  return `${API_URL}/notices/files/${fileId}`;
}

// ---- Retraducao forcada (EN -> PT, DeepL) de vilas, organizacoes e posts ----

/** Refaz a traducao em portugues dos textos da vila e dos cla's. */
export function retranslateVillage(id: string): Promise<ApiVillage> {
  return apiFetch(`/villages/${id}/retranslate`, { method: 'POST' });
}

/** Refaz a traducao em portugues de nome e descricao da organizacao. */
export function retranslateOrganization(id: string): Promise<ApiOrganizationAdmin> {
  return apiFetch(`/organizations/${id}/retranslate`, { method: 'POST' });
}

/** Refaz a traducao em portugues de titulo, resumo e texto do post. */
export function retranslatePost(id: string): Promise<ApiPost> {
  return apiFetch(`/posts/${id}/retranslate`, { method: 'POST' });
}

// ---- Registro de erros do wiki (so' S.Adm: permissao errors.view) ----

export interface ApiErrorEvent {
  id: string;
  source: 'api' | 'web' | 'deepl' | 'security';
  level: 'error' | 'warning';
  title: string;
  message: string;
  location: string | null;
  path: string | null;
  method: string | null;
  status: number | null;
  // Traceback mascarado da ULTIMA ocorrencia e IP: so' o painel (S.Adm) recebe
  trace: string | null;
  ipAddress: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

/** Lista os problemas registrados (abertos por padrao), o mais recente primeiro. */
export function listErrors(status: 'open' | 'resolved' | 'all' = 'open', source?: string): Promise<ApiErrorEvent[]> {
  const params = new URLSearchParams({ status });
  if (source) params.set('source', source);
  return apiFetch(`/errors?${params.toString()}`);
}

/** Marca um problema como resolvido (se voltar a acontecer, reabre sozinho). */
export function resolveError(id: string): Promise<ApiErrorEvent> {
  return apiFetch(`/errors/${id}/resolve`, { method: 'POST' });
}

/** Reabre um problema resolvido. */
export function reopenError(id: string): Promise<ApiErrorEvent> {
  return apiFetch(`/errors/${id}/reopen`, { method: 'POST' });
}

/** Apaga o registro de um problema. */
export function deleteError(id: string): Promise<void> {
  return apiFetch(`/errors/${id}`, { method: 'DELETE' });
}


// ---- Acessos ao site (Visao Geral) ----

export interface ApiTrafficDay { day: string; views: number; visitors: number }
export interface ApiTrafficCountry { code: string; views: number; visitors: number; share: number }
export interface ApiTrafficPage { path: string; views: number }
export interface ApiTrafficSummary {
  days: number;
  totalViews: number;
  totalVisitors: number;
  series: ApiTrafficDay[];
  countries: ApiTrafficCountry[];
  pages: ApiTrafficPage[];
}

/** Resumo dos acessos dos ultimos `days` dias (grafico, paises e paginas mais vistas). Exige analytics.view. */
export function getTrafficSummary(days = 30): Promise<ApiTrafficSummary> {
  return apiFetch(`/analytics/summary?days=${days}`);
}

/** Avisa a API que uma pagina publica foi aberta (so' contagem anonima; falha em silencio). */
export function sendPageHit(path: string): void {
  fetch(`${API_URL}/analytics/hit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
}
