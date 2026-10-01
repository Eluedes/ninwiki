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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // credentials: 'include' = manda o cookie de SESSAO (httpOnly) junto. Sem
    // isso o navegador nao anexa o cookie em chamadas pra' outra porta/origem
    // e todo endpoint protegido responderia 401.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
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

export function getContentItem(id: string): Promise<ApiContentItem> {
  return apiFetch(`/content-items/${id}`);
}

// Busca pelo SLUG (ex: "larva"), nao o uuid - usado pelo site publico,
// que quer URLs legiveis (/detail/larva) em vez do id tecnico do banco.
export function getContentItemBySlug(slug: string): Promise<ApiContentItem> {
  return apiFetch(`/content-items/slug/${slug}`);
}

export function createContentItem(payload: ContentItemInput): Promise<ApiContentItem> {
  return apiFetch('/content-items', { method: 'POST', body: JSON.stringify(payload) });
}

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
}

// Corpo aceito em criar/editar um jutsu - igual a ApiJutsu, mas `id`
// e' obrigatorio na CRIACAO tambem (o slug e' escolhido por quem
// cria, nao gerado pelo servidor como em content_items).
export type JutsuInput = ApiJutsu;

export function listMasteries(): Promise<ApiMastery[]> {
  return apiFetch('/masteries');
}

export function getMastery(id: string): Promise<ApiMastery> {
  return apiFetch(`/masteries/${id}`);
}

export function updateMastery(id: string, payload: MasteryInput): Promise<ApiMastery> {
  return apiFetch(`/masteries/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function retranslateMastery(id: string): Promise<ApiMastery> {
  return apiFetch(`/masteries/${id}/retranslate`, { method: 'POST' });
}

export function listAttributes(): Promise<ApiAttribute[]> {
  return apiFetch('/attributes');
}

export function listJutsus(masteryId?: string): Promise<ApiJutsu[]> {
  const query = masteryId ? `?masteryId=${masteryId}` : '';
  return apiFetch(`/jutsus${query}`);
}

export function getJutsu(id: string): Promise<ApiJutsu> {
  return apiFetch(`/jutsus/${id}`);
}

export function createJutsu(payload: JutsuInput): Promise<ApiJutsu> {
  return apiFetch('/jutsus', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateJutsu(id: string, payload: JutsuInput): Promise<ApiJutsu> {
  return apiFetch(`/jutsus/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function retranslateJutsu(id: string): Promise<ApiJutsu> {
  return apiFetch(`/jutsus/${id}/retranslate`, { method: 'POST' });
}

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

export function listAuditLog(limit = 50, entityType?: string): Promise<ApiAuditLogEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (entityType) params.set('entityType', entityType);
  return apiFetch(`/audit-log?${params.toString()}`);
}

// Historico de UMA entry especifica (usado na aba "Historico" dentro
// do editor) - mesmo endpoint do feed geral, so' filtrado por
// entityType+entityId. Ver a limitacao sobre bulk actions no
// docstring de list_audit_log no backend.
// Tipos de registro que tem historico por entry (o backend so' libera os de conteudo pra quem nao e' S.Adm).
export type HistoryEntityType = 'content_item' | 'jutsu' | 'post';

export function listEntryHistory(entityType: HistoryEntityType, entityId: string): Promise<ApiAuditLogEntry[]> {
  return apiFetch(`/audit-log?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}&limit=50`);
}

// ---- Acoes em massa (bulk) ----

export function bulkUpdateContentStatus(ids: string[], status: 'draft' | 'published'): Promise<ApiContentItemSummary[]> {
  return apiFetch('/content-items/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) });
}

export function bulkDeleteContentItems(ids: string[]): Promise<void> {
  return apiFetch('/content-items/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });
}

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

export function bulkImportContentItems(entries: BulkImportEntry[]): Promise<BulkImportResult> {
  return apiFetch('/content-items/bulk-import', { method: 'POST', body: JSON.stringify({ entries }) });
}

// ---- Vilas, Clas e Organizacoes ----

export interface ApiClan {
  id: string;
  name: string;
  villageId: string;
  levelRequirement: number;
  priceRyo: number;
  description: string;
}

export interface ApiOrganization {
  id: string;
  name: string;
  description: string;
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

export function listVillages(): Promise<ApiVillage[]> {
  return apiFetch('/villages');
}

export function getVillage(id: string): Promise<ApiVillage> {
  return apiFetch(`/villages/${id}`);
}

// ---- Edicao de Vilas, Clas e Organizacoes (painel; exige permissao de Lore) ----

export interface ClanInput {
  id: string;
  name: string;
  levelRequirement: number;
  priceRyo: number;
  description: string;
}

export interface VillageInput {
  id: string;
  name: string;
  namePt?: string | null;
  element: string;
  motto: string;
  description: string;
  longDescription: string;
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

export function createVillage(payload: VillageInput): Promise<ApiVillage> {
  return apiFetch('/villages', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateVillage(id: string, payload: VillageInput): Promise<ApiVillage> {
  return apiFetch(`/villages/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

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
  villageIds: string[];
}

export function listOrganizations(): Promise<ApiOrganizationAdmin[]> {
  return apiFetch('/organizations');
}

export function createOrganization(payload: OrganizationInput): Promise<ApiOrganizationAdmin> {
  return apiFetch('/organizations', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateOrganization(id: string, payload: OrganizationInput): Promise<ApiOrganizationAdmin> {
  return apiFetch(`/organizations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

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
  icon: string;
}

export interface ApiNinjaRank {
  id: string;
  name: string;
  // `name` e' o ingles (principal); `namePt` a traducao (ver lib/localized.ts)
  namePt: string | null;
  order: number;
  description: string;
}

export interface ApiStoryArc {
  id: string;
  name: string;
  levelRange: string;
  description: string;
}

export interface ApiSummon {
  id: string;
  name: string;
  // `name` e' o ingles (principal); `namePt` a traducao (ver lib/localized.ts)
  namePt: string | null;
  village: string;
  stageYoung: string;
  stageTeen: string;
  stageAdult: string;
}

export function listProfessions(): Promise<ApiProfession[]> {
  return apiFetch('/professions');
}

export function listNinjaRanks(): Promise<ApiNinjaRank[]> {
  return apiFetch('/ninja-ranks');
}

export function listStoryArcs(): Promise<ApiStoryArc[]> {
  return apiFetch('/story-arcs');
}

export function listSummons(): Promise<ApiSummon[]> {
  return apiFetch('/summons');
}

// ---- Fase 2: login, sessao e equipe ----

export type StaffRole = 'super_admin' | 'admin' | 'creator';

// Nomes das permissoes - espelham app/core/permissions.py::Permission no backend.
export type PermissionName =
  | 'content.create' | 'content.edit' | 'content.publish' | 'content.delete' | 'content.import'
  | 'posts.create' | 'posts.edit' | 'posts.publish' | 'posts.delete'
  | 'lore.edit' | 'lore.delete' | 'uploads.create' | 'translation.retranslate'
  | 'staff.view' | 'staff.create' | 'staff.edit' | 'staff.deactivate'
  | 'audit.view' | 'audit.view_all';

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

export function getAuthConfig(): Promise<AuthConfig> {
  return apiFetch('/auth/config');
}

export function getMe(): Promise<ApiMe> {
  return apiFetch('/auth/me');
}

export function devLogin(discordId: string): Promise<ApiMe> {
  return apiFetch('/auth/dev-login', { method: 'POST', body: JSON.stringify({ discordId }) });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/auth/logout', { method: 'POST' });
}

export function listStaff(): Promise<ApiStaff[]> {
  return apiFetch('/staff');
}

export function createStaff(payload: { discordId: string; role: StaffRole; username?: string }): Promise<ApiStaff> {
  return apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateStaffRole(id: string, role: StaffRole): Promise<ApiStaff> {
  return apiFetch(`/staff/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
}

export function setStaffActive(id: string, active: boolean): Promise<ApiStaff> {
  return apiFetch(`/staff/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' });
}

// ---- Blog (posts) ----

export interface ApiPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  status: 'draft' | 'published';
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPost extends ApiPostSummary {
  // Tiptap JSON (texto rico) ou texto simples - mesmo formato de Conteudo
  content: string;
}

export interface PostInput {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  status: 'draft' | 'published';
}

export function listPosts(status?: 'draft' | 'published'): Promise<ApiPostSummary[]> {
  return apiFetch(`/posts${status ? `?status=${status}` : ''}`);
}

export function getPost(id: string): Promise<ApiPost> {
  return apiFetch(`/posts/${id}`);
}

export function createPost(payload: PostInput): Promise<ApiPost> {
  return apiFetch('/posts', { method: 'POST', body: JSON.stringify(payload) });
}

export function updatePost(id: string, payload: PostInput): Promise<ApiPost> {
  return apiFetch(`/posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export function deletePost(id: string): Promise<void> {
  return apiFetch(`/posts/${id}`, { method: 'DELETE' });
}
