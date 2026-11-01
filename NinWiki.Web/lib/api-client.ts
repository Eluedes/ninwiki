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

/** Drop enviado ao salvar: igual ao lido, mas a raridade e' opcional (a API a tira do item ligado). */
export type DropInput = Omit<ApiDropEntry, 'rarity' | 'droppedItemSlug'> & { rarity?: Rarity; droppedItemSlug?: string | null };

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
  // Jutsu do catalogo ligado ao ataque: com ele, `name`/`namePt` ja' vem do jutsu e masteryId serve para o link da pagina publica.
  jutsuId?: string | null;
  namePt?: string | null;
  masteryId?: string | null;
}

/** Ataque enviado ao salvar: um jutsu ligado (sem precisar de nome) ou so' o texto. */
export type AttackInput = { name?: string; jutsuId?: string | null };

/** Zonas de um lugar (cor do ponto e nome na ficha). */
export const LOCATION_ZONES = ['safe', 'danger', 'war', 'arena', 'parkour', 'none'] as const;
export type LocationZone = (typeof LOCATION_ZONES)[number];
/** Uma loja de NPC que vende o item: onde fica, quantas unidades por esse preco, o preco e a moeda (nome de um item, ex.: Ryo). */
export type SaleEntry = { shop: string; places?: string[]; qty?: number; price?: number; currency?: string };

/** Um lugar onde o mob aparece (a ficha mostra um por linha, com a zona). */
export type LocationEntry = { name: string; namePt?: string | null; zone?: LocationZone | null };

export interface ApiContentItem {
  id: string;
  slug: string;
  category: Category;
  name: string;
  level: number;
  levelUnknown?: boolean;   // nivel ainda nao descoberto: mostrar "???"
  icon: string;
  image: string | null;
  rarity: Rarity;
  description: string;
  lore: string | null;
  synergy: string | null;
  // So' usado quando category === 'mobs' - onde o mob spawna no mapa
  // (texto livre por enquanto, ex: "Floresta Negra, Campos Iniciais").
  spawnLocation: string | null;
  spawnLocations: LocationEntry[];   // lista de lugares (vazia = usa o texto acima)
  soldAt: SaleEntry[];               // lojas de NPC que vendem este item/arma, com o preco
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
  weaponNpcId?: string | null;        // NPC ligado a uma pagina do wiki (opcional)
  weaponNpcSlug?: string | null;      // slug da pagina ligada (so' vem se ela esta' publicada)
  weaponNpcNamePt?: string | null;    // nome dela em portugues
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
  // Mobs que dropam esta entry - calculado pela API a partir das paginas de mob (nunca cadastrado a mao).
  droppedBy: ApiDroppedBy[];
  // Receitas das profissoes que produzem esta entry - calculado pela API a partir de Profession.details (somente leitura).
  craftedBy?: ApiCraftedBy[];
  updatedAt?: string | null;       // ultima edicao ('Atualizado em')
  translationAuto?: boolean;       // portugues veio da traducao automatica e ninguem revisou (selo no site)
  status: 'draft' | 'published';
}

/** Uma receita das profissoes que produz a entry (espelha CraftedByEntry no backend). */
export interface ApiCraftedBy {
  professionId: string;
  professionName: string;
  professionNamePt: string | null;
  professionIcon: string;
  level: number;
  workbench: boolean;
  needs: { name: string; namePt: string | null; slug: string | null; qty: number }[];
}

/** Um mob que dropa a entry (espelha DroppedByEntry no backend). */
export interface ApiDroppedBy {
  slug: string;
  name: string;
  namePt: string | null;
  image: string | null;
  icon: string;
  chance: number;
  chanceQualifier: 'over' | 'below' | null;
}

// Versao enxuta usada nas listagens (sem attributes/drops/lore/synergy) -
// espelha ContentItemSummary no backend.
export interface ApiContentItemSummary {
  id: string;
  slug: string;
  category: Category;
  name: string;
  level: number;
  levelUnknown?: boolean;   // nivel ainda nao descoberto: mostrar "???"
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
  spawnLocation?: string | null;      // so' mobs: onde aparece (texto livre antigo)
  spawnLocationPt?: string | null;
  spawnLocations?: LocationEntry[];   // so' mobs: lista de lugares com zona (vazia = usa o texto)
}
// controla os dois: id e' gerado, status so' muda explicitamente no
// PUT, nunca no POST, que sempre nasce "draft").
export interface ContentItemInput {
  slug: string;
  category: Category;
  name: string;
  level: number;
  levelUnknown?: boolean;   // nivel ainda nao descoberto: mostrar "???"
  icon: string;
  image?: string | null;
  rarity: Rarity;
  description: string;
  lore?: string | null;
  synergy?: string | null;
  spawnLocation?: string | null;
  spawnLocations?: LocationEntry[];
  soldAt?: SaleEntry[];
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
  attacks: AttackInput[];
  weaponSpeed?: string | null;
  weaponRequirement?: string | null;
  weaponNpc?: string | null;
  weaponNpcId?: string | null;
  weaponType?: string | null;
  weaponBaseDamage?: string | null;
  weaponSpecialAbility?: string | null;
  weaponKnockbackDistance?: string | null;
  maxStack?: number | null;
  castVillageId?: string | null;
  mobType?: MobType | null;
  itemType?: ItemType | null;
  attributes: ApiAttributeRow[];
  drops: DropInput[];   // sem raridade: a API usa a do item ligado (ou Common se o drop for so' texto)
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
    throw new ApiError(res.status, body?.detail ?? `Error ${res.status}`);
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
  masteryId: string | null;   // null = jutsu de Utilidade (Utility): nao pertence a nenhuma mastery
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
  nameByLevel?: string[];   // nome do jutsu em cada nivel (vazio = igual ao nome principal)
  nameByLevelPt?: string[]; // traducao (DeepL) do nome por nivel; vazio = mostra o ingles
  castType: string;
  jutsuClass: string;
  debuff: string;
  isNpc: boolean;          // Jutsu NPC: versao do jutsu ensinada/usada por NPC (secao propria no site)
  allowedWeapons: string;  // "Allowed weapons" (ex.: Blunt); vazio = nao aparece
  status?: 'draft' | 'published';   // rascunho: so' a equipe ve (ausente = publicado)
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
/** So' os jutsus de Utilidade (sem mastery). */
export function listUtilityJutsus(): Promise<ApiJutsu[]> {
  return apiFetch('/jutsus?utility=true&npc=false');   // Utilidade sem os jutsus de NPC (esses ficam na secao NPC)
}

/** So' os Jutsus NPC (de qualquer mastery ou de Utilidade). */
export function listNpcJutsus(): Promise<ApiJutsu[]> {
  return apiFetch('/jutsus?npc=true');
}

export function listJutsus(masteryId?: string, publicOnly = false): Promise<ApiJutsu[]> {
  // publicOnly = so' jutsus normais (sem os de NPC): usado nas paginas de mastery, onde os de NPC tem secao propria
  const query = masteryId ? `?masteryId=${masteryId}${publicOnly ? '&npc=false' : ''}` : (publicOnly ? '?npc=false' : '');
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

/** Envia uma imagem (campo de imagem, editor do blog) e devolve o endereco dela; `onProgress` alimenta a barra de envio. */
export async function uploadImage(file: File, onProgress?: (p: UploadProgress) => void): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const data = await xhrUpload<{ url: string }>('/uploads/image', formData, onProgress);
  return data.url;
}

// ---- Importacao de JSON em massa ----

export interface BulkImportEntry {
  name: string;
  namePt?: string | null;   // nome oficial em portugues (do arquivo de traducao do jogo)
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

/** Referencia a um item do wiki dentro dos detalhes de uma profissao (slug so' vem se a pagina esta' publicada: vira link). */
export type ItemRef = { name: string; namePt?: string | null; slug?: string | null; image?: string | null };   // image: caminho (/uploads/...) - o site poe o endereco da API

/** O que a pagina da profissao mostra alem da descricao (preenchido por scripts/importar_profissoes_atlas.py). */
export interface ProfessionDetails {
  resources?: { name: string; loot: (ItemRef & { min: number; max: number })[] }[];
  recipes?: { result: ItemRef; level: number; workbench: boolean; needs: (ItemRef & { qty: number })[]; learnedFrom?: ItemRef | null }[];
  tools?: (ItemRef & { level?: number | null; price?: { amount: number; currency: string } | null })[];
}

export interface ApiProfession {
  id: string;
  name: string;
  // `name` e' o ingles (principal); `namePt` a traducao (ver lib/localized.ts)
  namePt: string | null;
  group: 'gathering' | 'crafting';
  description: string;
  descriptionPt?: string | null;
  icon: string;
  details?: ProfessionDetails | null;
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

/** Uma profissao com todos os detalhes (pagina /profession/[id]); 404 se nao existe. */
export function getProfession(id: string): Promise<ApiProfession> {
  return apiFetch(`/professions/${id}`);
}

/** Corpo de criar/editar uma proficiencia (os `details` vem do importador e nao sao enviados). */
export type ProfessionInput = Omit<ApiProfession, 'details'>;

/** Cria uma proficiencia (painel; exige lore.edit). */
export function createProfession(payload: ProfessionInput): Promise<ApiProfession> {
  return apiFetch('/professions', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita uma proficiencia (os `details` ficam como estao). */
export function updateProfession(id: string, payload: ProfessionInput): Promise<ApiProfession> {
  return apiFetch(`/professions/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Apaga uma proficiencia (painel; exige lore.delete). */
export function deleteProfession(id: string): Promise<void> {
  return apiFetch(`/professions/${id}`, { method: 'DELETE' });
}

// ---------------- Artigos do Guia ----------------

/** Secoes do Guia, na ordem em que aparecem no site (o rotulo de cada uma fica em lib/i18n.ts). */
export const GUIDE_SECTIONS = ['new-player', 'combat', 'progression', 'interface', 'economy'] as const;
export type GuideSection = (typeof GUIDE_SECTIONS)[number];

/** Artigo do Guia como a API devolve (title/summary/body em ingles; `Pt` = traducao). */
export interface ApiGuideArticle {
  id: string;
  section: GuideSection;
  position: number;
  title: string;
  titlePt?: string | null;
  summary: string;
  summaryPt?: string | null;
  body: string;      // texto rico (documento Tiptap em JSON)
  bodyPt?: string | null;
  icon: string;      // nome de icone (components/lore/guide-icons.tsx)
  status: 'draft' | 'published';
}

export type GuideArticleInput = ApiGuideArticle;

/** Artigos do Guia (o visitante so' recebe os publicados; a equipe logada recebe tambem os rascunhos). */
export function listGuideArticles(section?: GuideSection): Promise<ApiGuideArticle[]> {
  return apiFetch(`/guide-articles${section ? `?section=${section}` : ''}`);
}

/** Um artigo do Guia pelo id (404 se nao existe ou se e' rascunho e voce nao e' da equipe). */
export function getGuideArticle(id: string): Promise<ApiGuideArticle> {
  return apiFetch(`/guide-articles/${id}`);
}

/** Cria um artigo do Guia (painel; exige lore.edit). */
export function createGuideArticle(payload: GuideArticleInput): Promise<ApiGuideArticle> {
  return apiFetch('/guide-articles', { method: 'POST', body: JSON.stringify(payload) });
}

/** Edita um artigo do Guia. */
export function updateGuideArticle(id: string, payload: GuideArticleInput): Promise<ApiGuideArticle> {
  return apiFetch(`/guide-articles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** Apaga um artigo do Guia (painel; exige lore.delete). */
export function deleteGuideArticle(id: string): Promise<void> {
  return apiFetch(`/guide-articles/${id}`, { method: 'DELETE' });
}

// ---------------- Modo manutencao do site ----------------

/** Estado publico do site; `access` = o passe enviado e' valido (so' faz sentido no servidor do site). */
export interface ApiSiteStatus {
  maintenance: boolean;
  message?: string | null;
  messagePt?: string | null;
  access: boolean;
}

/** O site esta' em manutencao? (publico; nunca em cache) */
export function getSiteStatus(): Promise<ApiSiteStatus> {
  return apiFetch('/site/status', { cache: 'no-store' }, true);
}

/** Liga/desliga a manutencao e muda a mensagem (so' S.Adm; os outros recebem 404). */
export function setMaintenance(payload: { enabled: boolean; message: string; messagePt: string | null }): Promise<ApiSiteStatus> {
  return apiFetch('/site/maintenance', { method: 'PUT', body: JSON.stringify(payload) });
}

/** Troca a sessao da equipe por um passe de manutencao (401 = nao esta' logado na equipe; chamada "quiet": nao derruba a sessao). */
export function createMaintenancePass(): Promise<{ token: string; hours: number; maintenance: boolean }> {
  return apiFetch('/site/pass', { method: 'POST' }, true);
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
  | 'posts.create' | 'posts.edit' | 'posts.publish' | 'posts.delete' | 'comments.moderate' | 'reports.manage' | 'volunteers.manage' | 'tournaments.manage' | 'discord.links' | 'translation.import'
  | 'lore.edit' | 'lore.delete' | 'uploads.create' | 'translation.retranslate'
  | 'staff.view' | 'staff.create' | 'staff.edit' | 'staff.deactivate' | 'staff.delete' | 'roles.manage' | 'errors.view'
  | 'notices.view' | 'notices.manage' | 'announcement.manage' | 'media.manage' | 'media.categorize' | 'site.maintenance' | 'media.upload' | 'media.reset_ids' | 'media.closed'
  | 'audit.view' | 'audit.view_all' | 'audit.clear' | 'analytics.view'
  | `media.cat.${string}`;   // ver uma categoria do banco de imagens (media.cat.weapon, media.cat.none = Sem categoria...)

export interface ApiMe {
  id: string;
  // Discord ID vem como TEXTO de proposito: o JavaScript so' guarda inteiros
  // exatos ate' 2^53 e um ID do Discord passa disso (viraria um numero errado).
  discordId: string;
  username: string;
  avatarUrl: string | null;
  role: StaffRole;
  roleLabel: string;
  customRole: ApiCustomRoleBrief | null;
  permissions: PermissionName[];
  assignableRoles: StaffRole[];
}

/** Cargo personalizado resumido (nome e cor). */
export interface ApiCustomRoleBrief {
  id: string;
  name: string;
  color: string;
}

export interface ApiStaff {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
  role: StaffRole;
  roleLabel: string;
  customRole: ApiCustomRoleBrief | null;
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

/** Apaga o cookie do passe de manutencao (rota do proprio site). Nunca falha: se nao der, o passe so' vence sozinho em 12 h. */
export async function clearMaintenancePass(): Promise<void> {
  try {
    await fetch('/maintenance-pass', { method: 'DELETE' });
  } catch {
    /* sem rede: tudo bem */
  }
}

/** Encerra a sessao (e tira o passe de manutencao: sair da conta fecha o site de novo durante a manutencao). */
export async function logout(): Promise<{ ok: boolean }> {
  try {
    return await apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  } finally {
    await clearMaintenancePass();
  }
}

/** Lista a equipe (so' S.Adm). */
export function listStaff(): Promise<ApiStaff[]> {
  return apiFetch('/staff');
}

/** Cadastra alguem na equipe (so' S.Adm). */
export function createStaff(payload: { discordId: string; role: StaffRole; username?: string; customRoleId?: string | null }): Promise<ApiStaff> {
  return apiFetch('/staff', { method: 'POST', body: JSON.stringify(payload) });
}

/** Troca o cargo de alguem da equipe. */
export function updateStaffRole(id: string, role: StaffRole, customRoleId: string | null = null): Promise<ApiStaff> {
  return apiFetch(`/staff/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role, customRoleId }) });
}

/** Troca o nome (nick) de alguem da equipe (so' S.Adm, inclusive o proprio). */
export function updateStaffName(id: string, username: string): Promise<ApiStaff> {
  return apiFetch(`/staff/${id}/name`, { method: 'PATCH', body: JSON.stringify({ username }) });
}

/** Remove alguem da equipe de vez (so' S.Adm). */
export function deleteStaff(id: string): Promise<void> {
  return apiFetch(`/staff/${id}`, { method: 'DELETE' });
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
  bannerImage?: string | null;   // banner largo do topo do post (vazio = usa a capa)
  status: 'draft' | 'published';
  authorName: string | null;
  tags: ApiTag[];
  publishedAt: string | null;
  isScheduled: boolean; // publicado com data no futuro (ainda invisivel ao publico)
  isSteam?: boolean;    // importado da Steam (post oficial da desenvolvedora): mostra o selo da logo dela
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
  bannerImage?: string | null;
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

/** Cargo personalizado criado pelo S.Adm. */
export interface ApiCustomRole {
  id: string;
  name: string;
  color: string;
  description: string;
  permissions: PermissionName[];
  members: number;
}

export interface ApiRolesOverview {
  roles: ApiRolePermissions[];
  permissions: ApiPermissionInfo[];
  customRoles: ApiCustomRole[];
}

export interface CustomRoleInput {
  name: string;
  color: string;
  description: string;
  permissions: PermissionName[];
}

/** Cria um cargo personalizado (so' S.Adm). */
export function createCustomRole(input: CustomRoleInput): Promise<ApiRolesOverview> {
  return apiFetch('/roles/custom', { method: 'POST', body: JSON.stringify(input) });
}

/** Edita um cargo personalizado (nome, cor, descricao, permissoes). */
export function updateCustomRole(id: string, input: CustomRoleInput): Promise<ApiRolesOverview> {
  return apiFetch(`/roles/custom/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

/** Apaga um cargo personalizado (so' se ninguem o tiver). */
export function deleteCustomRole(id: string): Promise<ApiRolesOverview> {
  return apiFetch(`/roles/custom/${id}`, { method: 'DELETE' });
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

/** Andamento de um envio: bytes mandados, total e porcentagem (0-100). */
export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Envio multipart (arquivo) com PROGRESSO e limite de tempo. Usa XMLHttpRequest (e nao fetch) porque so' ele informa o andamento do envio -
 * arquivo grande (GIF, .zip) leva tempo e a tela nao pode ficar "girando" sem dizer nada. Todos os envios do site passam por aqui.
 * Sempre termina: ou devolve o JSON da resposta, ou lanca ApiError com o motivo (inclusive queda de conexao e tempo esgotado).
 * Nao usa apiFetch() de proposito: ele forca "Content-Type: application/json", o que quebraria o multipart (o navegador define o boundary sozinho).
 */
function xhrUpload<T>(path: string, formData: FormData, onProgress?: (p: UploadProgress) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    xhr.withCredentials = true; // manda o cookie de sessao
    xhr.timeout = 10 * 60 * 1000; // 10 minutos
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
    };
    xhr.onload = () => {
      let body: { detail?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // resposta que nao e' JSON (ex: erro de um proxy no meio do caminho)
      }
      if (xhr.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      if (xhr.status >= 200 && xhr.status < 300 && body) return resolve(body as unknown as T);
      const hint = xhr.status === 413 ? ' (file too large for the server)' : '';
      reject(new ApiError(xhr.status, body?.detail ?? `Error ${xhr.status}${hint}`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Connection lost while sending the file (it may be too large for the server).'));
    xhr.ontimeout = () => reject(new ApiError(0, 'The upload took too long and was cancelled.'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.'));
    xhr.send(formData);
  });
}

/** Anexa um arquivo a um aviso (multipart) com progresso; devolve o aviso atualizado. */
export function uploadNoticeFile(noticeId: string, file: File, onProgress?: (p: UploadProgress) => void): Promise<ApiNotice> {
  const formData = new FormData();
  formData.append('file', file);
  return xhrUpload<ApiNotice>(`/notices/${noticeId}/files`, formData, onProgress);
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
  // Explicacao em portugues (causa provavel + o que fazer), gerada pela API
  hintPt?: string;
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
export interface ApiTrafficPlace { country: string; region: string; city: string; views: number; visitors: number; share: number }
export interface ApiTrafficPage { path: string; views: number }
export interface ApiTrafficSummary {
  days: number;
  totalViews: number;
  totalVisitors: number;
  series: ApiTrafficDay[];
  countries: ApiTrafficCountry[];
  places: ApiTrafficPlace[];   // cidade/estado/pais (so' com os cabecalhos de localizacao da Cloudflare ligados)
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


// ---- Anuncio da pagina inicial ----

export type AnnouncementLevel = 'info' | 'success' | 'warning' | 'event';

export interface ApiAnnouncement {
  active: boolean;
  message: string;
  messagePt: string | null;
  linkUrl: string;
  linkLabel: string;
  level: AnnouncementLevel;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AnnouncementInput {
  message: string;
  messagePt?: string | null;
  linkUrl: string;
  linkLabel: string;
  level: AnnouncementLevel;
}

/** Anuncio atual da Home (publico). `active: false` = nada para mostrar. */
export function getAnnouncement(): Promise<ApiAnnouncement> {
  return apiFetch('/announcement');
}

/** Publica/troca o anuncio da Home (mensagem vazia remove). Exige announcement.manage. */
export function saveAnnouncement(input: AnnouncementInput): Promise<ApiAnnouncement> {
  return apiFetch('/announcement', { method: 'PUT', body: JSON.stringify(input) });
}

/** Remove o anuncio da Home. */
export function clearAnnouncement(): Promise<ApiAnnouncement> {
  return apiFetch('/announcement', { method: 'DELETE' });
}


// ---- Banco de imagens ----

/** Categorias do banco de imagens (a API aceita so' estas; vazio = sem categoria). */
export const MEDIA_CATEGORIES = ['weapon', 'gear', 'consumable', 'currency', 'material', 'ring', 'scroll', 'npc', 'monster', 'furniture', 'hair_beard', 'skin', 'vanity', 'tools', 'closed', 'other'] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export interface ApiMedia {
  id: number;
  name: string;
  category: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export interface ApiMediaPage {
  items: ApiMedia[];
  total: number;
  restricted?: boolean;             // true: a busca bateu com imagem(ns) da categoria 'closed' que voce nao pode ver (mostrar o aviso)
  counts: Record<string, number>;   // imagens por categoria ('' = sem categoria), da biblioteca toda
}

export interface ApiMediaUse {
  kind: string;
  label: string;
}

/** Lista/busca o banco de imagens (mais novas primeiro). `q` busca no nome ou pelo ID (12, #12, img:12). */
export function listMedia(q = '', limit = 50, offset = 0, category?: string): Promise<ApiMediaPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q.trim()) params.set('q', q.trim());
  if (category) params.set('category', category);   // 'none' = so' as sem categoria
  return apiFetch(`/media?${params.toString()}`);
}

/** Uma imagem do banco pelo ID. */
export function getMedia(id: number): Promise<ApiMedia> {
  return apiFetch(`/media/${id}`);
}

/** Envia uma imagem para o banco de imagens (multipart) e devolve o ID dela. */
export function uploadMedia(file: File, name = '', category = '', onProgress?: (p: UploadProgress) => void): Promise<ApiMedia> {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  if (category) formData.append('category', category);
  return xhrUpload<ApiMedia>('/media', formData, onProgress);
}

/** Muda o rotulo de uma imagem (so' quem tem media.manage). */
export function renameMedia(id: number, name: string): Promise<ApiMedia> {
  return apiFetch(`/media/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

/** Renumera os IDs do banco de imagens a partir de 1 (so' S.Adm). */
export function renumberMedia(): Promise<{ renumbered: number }> {
  return apiFetch('/media/renumber', { method: 'POST' });
}

/** Muda a categoria de uma imagem ('' tira a categoria; so' quem tem media.manage). */
export function setMediaCategory(id: number, category: string): Promise<ApiMedia> {
  return apiFetch(`/media/${id}`, { method: 'PATCH', body: JSON.stringify({ category }) });
}

/** Muda a categoria de varias imagens de uma vez. */
export function bulkSetMediaCategory(ids: number[], category: string): Promise<{ updated: number }> {
  return apiFetch('/media/bulk-category', { method: 'POST', body: JSON.stringify({ ids, category }) });
}

/** Onde a imagem esta' sendo usada. */
export function getMediaUsage(id: number): Promise<ApiMediaUse[]> {
  return apiFetch(`/media/${id}/usage`);
}

/** Apaga a imagem (409 se estiver em uso, a menos que `force`). */
export function deleteMedia(id: number, force = false): Promise<void> {
  return apiFetch(`/media/${id}${force ? '?force=true' : ''}`, { method: 'DELETE' });
}

/** Registra no banco as imagens que ja' estavam na pasta de uploads sem ID. */
export function syncMedia(): Promise<{ added: number }> {
  return apiFetch('/media/sync', { method: 'POST' });
}

/** ID de imagem escrito num campo (`img:12`, `#12`, `12`...) ou null se for outra coisa (um endereco, por exemplo). */
export function parseImageRef(value: string): number | null {
  const m = /^\s*(?:img\s*[:\-_ ]\s*|id\s*:\s*|#\s*)?(\d{1,9})\s*$/i.exec(value);
  return m ? Number(m[1]) : null;
}

export interface ApiMediaBulkResult {
  deleted: number[];
  inUse: { id: number; uses: ApiMediaUse[] }[];
  notFound: number[];
}

/** Apaga varias imagens; as em uso voltam em `inUse` (nao apagadas) a menos que `force`. */
export function bulkDeleteMedia(ids: number[], force = false): Promise<ApiMediaBulkResult> {
  return apiFetch('/media/bulk-delete', { method: 'POST', body: JSON.stringify({ ids, force }) });
}


// ---- Importador de noticias da Steam (posts.publish) ----

export interface ApiSteamRun {
  at: string;
  fetched: number;
  matched: number;
  imported: number;
  skipped: number;
  errors: string[];
  notes?: string[];   // avisos da busca de miniaturas (capsule) na Steam
  titles: string[];
  seen?: { title: string; tags: string[]; date: number }[];   // o que a Steam devolveu (diagnostico)
}

export interface ApiSteamStatus {
  enabled: boolean;
  appId: string;
  intervalMinutes: number;
  mode: string;
  requireTag: string;
  lastRun: ApiSteamRun | null;
}

/** Estado do importador de noticias da Steam (ligado?, jogo, modo e ultima conferencia). */
export function getSteamNewsStatus(): Promise<ApiSteamStatus> {
  return apiFetch('/steam-news/status');
}

/** Confere a Steam agora e importa os posts de atualizacao novos; com `post` (link ou numero de um post) importa so' esse, mesmo antigo ou sem a tag. */
export function runSteamNewsImport(post?: string, refresh = false): Promise<ApiSteamStatus> {
  const q = post?.trim() ? `?post=${encodeURIComponent(post.trim())}` : refresh ? '?refresh=true' : '';   // refresh = refaz TODOS os posts ja' importados   // com `post` (link ou numero) importa SO' esse post da Steam
  return apiFetch(`/steam-news/import${q}`, { method: 'POST' });
}


// ---- Reports de visitantes (conteudo desatualizado / erro de traducao) ----

export type ReportTargetType = 'content' | 'jutsu' | 'mastery';
export type ReportKind = 'outdated' | 'translation' | 'other';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

/** Um report como o painel ve' (espelha ReportRead no backend; sem IP). */
export interface ApiReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetName: string;
  targetPath: string;
  kind: ReportKind;
  message: string;
  locale: string | null;
  status: ReportStatus;
  createdAt: string;
  handledBy: string | null;
  handledAt: string | null;
}

/** Publico: o formulario de voluntarios esta' aberto? (so' leitura) */
export function getVolunteerFormStatus(): Promise<{ enabled: boolean }> {
  return apiFetch('/volunteers/status', { cache: 'no-store' });
}

/** Painel (volunteers.manage): abre ou fecha o formulario de voluntarios. */
export function setVolunteerFormStatus(enabled: boolean): Promise<{ enabled: boolean }> {
  return apiFetch('/volunteers/status', { method: 'PUT', body: JSON.stringify({ enabled }) });
}

/** Visitante (sem login) envia um report sobre uma pagina. `website` e' a "isca" anti-robo e deve ir sempre vazia. */
export function submitReport(input: { targetType: ReportTargetType; targetId: string; kind: ReportKind; message: string; locale: string; website: string }): Promise<void> {
  return apiFetch('/reports', { method: 'POST', body: JSON.stringify(input) }, true);
}

/** Painel: lista os reports (por padrao os abertos). */
export function listReports(status: ReportStatus | 'all', kind?: ReportKind): Promise<ApiReport[]> {
  const params = new URLSearchParams({ status });
  if (kind) params.set('kind', kind);
  return apiFetch(`/reports?${params}`);
}

/** Painel: marca o report como resolvido, descartado ou reabre. */
export function setReportStatus(id: string, status: ReportStatus): Promise<ApiReport> {
  return apiFetch(`/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

/** Painel: apaga o report. */
export function deleteReport(id: string): Promise<void> {
  return apiFetch(`/reports/${id}`, { method: 'DELETE' });
}

// ---- Voluntarios (formulario publico /volunteer + painel /admin/volunteers) ----

export const VOLUNTEER_AREAS = ['translation', 'wiki-editing', 'data-collection', 'mapping', 'moderation', 'other'] as const;
export type VolunteerArea = (typeof VOLUNTEER_AREAS)[number];
export const VOLUNTEER_STATUSES = ['new', 'reviewing', 'approved', 'rejected', 'contacted'] as const;
export type VolunteerStatus = (typeof VOLUNTEER_STATUSES)[number];

/** O que o visitante envia (espelha VolunteerApply no backend). `website` e' a isca anti-robo e deve ir sempre vazia. */
export interface VolunteerApplyInput {
  discord: string; gameNick: string; languages: string; areas: VolunteerArea[];
  availability: string; motivation: string; contactEmail: string | null; consent: true; website: string;
}

/** Uma inscricao como o painel ve' (espelha VolunteerRead). */
export interface ApiVolunteer {
  id: string; createdAt: string; discord: string; gameNick: string; languages: string; areas: string[];
  availability: string; motivation: string; contactEmail: string | null; status: VolunteerStatus;
  staffNotes: string | null; reviewedBy: string | null; reviewedAt: string | null;
}

/** Visitante (sem login) envia a inscricao de voluntario. */
export function applyAsVolunteer(input: VolunteerApplyInput): Promise<void> {
  return apiFetch('/volunteers/apply', { method: 'POST', body: JSON.stringify(input) }, true);
}

/** Painel: lista as inscricoes (filtro de status, busca e paginacao) + total + quantas estao NOVAS. */
export function listVolunteers(opts: { status?: VolunteerStatus; q?: string; limit: number; offset: number }): Promise<{ items: ApiVolunteer[]; total: number; newCount: number }> {
  const params = new URLSearchParams({ limit: String(opts.limit), offset: String(opts.offset) });
  if (opts.status) params.set('status', opts.status);
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  return apiFetch(`/volunteers?${params}`);
}

/** Painel: muda o status e/ou as notas internas de uma inscricao. */
export function updateVolunteer(id: string, patch: { status?: VolunteerStatus; staffNotes?: string }): Promise<ApiVolunteer> {
  return apiFetch(`/volunteers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

/** Painel: apaga a inscricao (pedido de exclusao de dados). */
export function deleteVolunteer(id: string): Promise<void> {
  return apiFetch(`/volunteers/${id}`, { method: 'DELETE' });
}

// ---- Historico de versoes do conteudo (desfazer edicao) ----

/** Uma versao anterior de uma entry (espelha ContentVersionRead no backend). */
export interface ApiContentVersion {
  id: string;
  createdAt: string;
  savedBy: string | null;
  name: string;
  status: string;
}

/** Versoes anteriores da entry, da mais nova para a mais antiga. */
export function listContentVersions(itemId: string): Promise<ApiContentVersion[]> {
  return apiFetch(`/content-items/${itemId}/versions`);
}

/** Volta a entry para uma versao anterior (a API grava o estado atual no historico antes). */
export function restoreContentVersion(itemId: string, versionId: string): Promise<ApiContentItem> {
  return apiFetch(`/content-items/${itemId}/versions/${versionId}/restore`, { method: 'POST' });
}

// ---- Importacao das traducoes oficiais do jogo (painel; exige translation.import) ----

export interface ApiTranslationBreakdown { entity: string; records: number; changes: number; unmatched: number; unmatchedNames: string[] }
export interface ApiTranslationSample { entity: string; label: string; field: string; old: string | null; new: string }
export interface ApiTranslationResult { dictionaryEntries: number; totalChanges: number; applied: boolean; breakdown: ApiTranslationBreakdown[]; samples: ApiTranslationSample[] }

/** Calcula o que mudaria com o dicionario do arquivo (nada e' gravado) - `apply: true` grava de verdade. */
export function importOfficialTranslations(
  apply: boolean, body: { translations: Record<string, string>; language: string | null; overwrite: boolean },
): Promise<ApiTranslationResult> {
  return apiFetch(`/translations/${apply ? 'apply' : 'preview'}`, { method: 'POST', body: JSON.stringify(body) });
}

// ---- Nomes novos do arquivo do jogo (painel; exige content.import) ----

export interface ApiNewName { name: string; namePt: string | null; hint: 'jutsu' | 'recipe' | null }
export interface ApiNewNamesResult { totalStrings: number; nameLike: number; alreadyInWiki: number; candidates: ApiNewName[]; truncated: boolean }

/** Acha no arquivo em ingles do jogo os nomes que o wiki ainda nao tem (o de portugues, opcional, traz o nome oficial em PT). */
export function findNewGameNames(english: Record<string, string>, portuguese: Record<string, string> | null): Promise<ApiNewNamesResult> {
  return apiFetch('/translations/new-names', { method: 'POST', body: JSON.stringify({ english, portuguese }) });
}

// ---- Torneios (publico + organizador logado com o Discord) e perfis de jogadores ----
// Espelham app/schemas/tournaments.py. Quem cria o torneio e' o ORGANIZADOR (leitor logado); a equipe so' modera.
export type TournamentStatus = 'draft' | 'open' | 'running' | 'finished';
export type TournamentVisibility = 'public' | 'unlisted';
export type PhaseFormat = 'single_elimination' | 'round_robin';
export type PhaseStatus = 'setup' | 'running' | 'finished';
export const TOURNAMENT_STATUSES: TournamentStatus[] = ['draft', 'open', 'running', 'finished'];

/** Dono do torneio / do perfil (so' dados publicos; nunca o Discord ID). */
export interface ApiPlayerRef { id: string; username: string; avatarUrl: string | null; gameName: string | null }

export interface ApiTournamentSummary {
  id: string; name: string; status: TournamentStatus; visibility: TournamentVisibility; startsAt: string | null; createdAt: string;
  championName: string | null; hidden: boolean; organizerHidden: boolean; owner: ApiPlayerRef; entryCount: number; phaseCount: number;
}
export interface ApiEntry {
  id: string; displayName: string; seed: number; readerId: string | null; avatarUrl: string | null;
  villageId: string | null; ninjaRankId: string | null; placement: number | null;
}
export interface ApiCompetitor { id: string; name: string; seed: number; entryIds: string[] }
export interface ApiMatch {
  id: string; round: number; slot: number; competitorAId: string | null; competitorBId: string | null;
  scoreA: number | null; scoreB: number | null; winnerId: string | null; done: boolean;
}
export interface ApiStanding { competitorId: string; played: number; wins: number; draws: number; losses: number; pointsFor: number; pointsAgainst: number; points: number }
export interface ApiPhase {
  id: string; position: number; name: string; teamSize: number; format: PhaseFormat; status: PhaseStatus;
  competitors: ApiCompetitor[]; matches: ApiMatch[]; standings: ApiStanding[] | null; suggestedEntryIds: string[] | null;
}
export interface ApiTournament extends ApiTournamentSummary {
  description: string; isOrganizer: boolean; myEntryId: string | null; entries: ApiEntry[]; phases: ApiPhase[];
}
export interface ApiNamedRef { id: string; name: string; namePt: string | null }
export interface ApiHistoryItem { tournamentId: string; name: string; status: TournamentStatus; placement: number | null; wins: number; losses: number; date: string }
export interface ApiPlayerProfile {
  id: string; username: string; avatarUrl: string | null; gameName: string | null; village: ApiNamedRef | null; ninjaRank: ApiNamedRef | null;
  /** So' em GET /players/me: de onde vieram vila e rank (cargo no servidor `guildName` do Discord ou o padrao). */
  source?: { kind: 'discord' | 'default'; guildName: string | null } | null;
  stats: { tournaments: number; wins: number; losses: number; titles: number }; history: ApiHistoryItem[]; trophies: ApiHistoryItem[];
}
export interface TournamentInput { name: string; description: string; startsAt?: string | null; visibility: TournamentVisibility; organizerHidden?: boolean }
export interface PhaseInput { name: string; teamSize: number; format: PhaseFormat }
export interface ApiModerationTournament {
  id: string; name: string; status: TournamentStatus; visibility: TournamentVisibility; hidden: boolean; organizerHidden: boolean; hiddenBy: string | null;
  createdAt: string; ownerId: string; ownerName: string; ownerBanned: boolean; entryCount: number;
}

const tPath = (id: string) => `/tournaments/${id}`;
const jsonInit = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Lista publica de torneios (filtro de status, busca). `mine`: os meus (exige login de leitor). */
export function listTournaments(opts: { status?: TournamentStatus; q?: string; mine?: boolean; limit?: number; offset?: number } = {}): Promise<{ items: ApiTournamentSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.q) params.set('q', opts.q);
  if (opts.mine) params.set('mine', 'true');
  params.set('limit', String(opts.limit ?? 20));
  params.set('offset', String(opts.offset ?? 0));
  return apiFetch(`/tournaments?${params}`, { cache: 'no-store' }, true);
}
/** Torneio completo (a resposta depende de quem esta' logado: isOrganizer, myEntryId...). */
export function getTournament(id: string): Promise<ApiTournament> { return apiFetch(tPath(id), { cache: 'no-store' }, true); }
export function createTournament(input: TournamentInput): Promise<ApiTournament> { return apiFetch('/tournaments', jsonInit('POST', input), true); }
export function updateTournament(id: string, patch: Partial<TournamentInput> & { status?: 'draft' | 'open' | 'running'; clearStartsAt?: boolean }): Promise<ApiTournament> { return apiFetch(tPath(id), jsonInit('PATCH', patch), true); }
export function deleteTournament(id: string): Promise<void> { return apiFetch(tPath(id), jsonInit('DELETE'), true); }
export function joinTournament(id: string): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/join`, jsonInit('POST'), true); }
export function leaveTournament(id: string): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/join`, jsonInit('DELETE'), true); }
export function addGuestEntry(id: string, displayName: string): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/entries`, jsonInit('POST', { displayName }), true); }
/** Importa uma lista de nomes de uma vez; `skipped` traz os que a API recusou (duplicate, too_long, invalid, full). */
export function importEntries(id: string, names: string[], position: 'end' | 'start' = 'end'): Promise<{ added: number; skipped: { name: string; reason: string }[]; tournament: ApiTournament }> { return apiFetch(`${tPath(id)}/entries/bulk`, jsonInit('POST', { names, position }), true); }
export function removeEntry(id: string, entryId: string): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/entries/${entryId}`, jsonInit('DELETE'), true); }
export function reorderEntries(id: string, ids: string[]): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/entries/order`, jsonInit('PUT', { ids }), true); }
export function createPhase(id: string, input: PhaseInput): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/phases`, jsonInit('POST', input), true); }
export function updatePhase(id: string, phaseId: string, input: PhaseInput): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/phases/${phaseId}`, jsonInit('PATCH', input), true); }
export function deletePhase(id: string, phaseId: string): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/phases/${phaseId}`, jsonInit('DELETE'), true); }
/** Monta a chave da fase com os competidores (na ordem de semente); cada um com os ids dos inscritos que o formam. */
export function startPhase(id: string, phaseId: string, competitors: { name?: string; entryIds: string[] }[]): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/phases/${phaseId}/start`, jsonInit('POST', { competitors }), true); }
export function phaseAction(id: string, phaseId: string, action: 'reset' | 'finish' | 'reopen'): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/phases/${phaseId}/${action}`, jsonInit('POST'), true); }
export function setMatchResult(id: string, matchId: string, result: { scoreA?: number | null; scoreB?: number | null; winner?: 'a' | 'b' | null }): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/matches/${matchId}/result`, jsonInit('PUT', result), true); }
export function tournamentAction(id: string, action: 'finish' | 'reopen'): Promise<ApiTournament> { return apiFetch(`${tPath(id)}/${action}`, jsonInit('POST'), true); }
/** Perfil publico de um jogador. */
export function getPlayer(id: string): Promise<ApiPlayerProfile> { return apiFetch(`/players/${id}`, { cache: 'no-store' }, true); }
/** Meu perfil (leitor logado). */
export function getMyProfile(): Promise<ApiPlayerProfile> { return apiFetch('/players/me', { cache: 'no-store' }, true); }
/** Edita o proprio perfil: so' o nome no jogo (vila e rank vem do Discord; a API recusa esses campos). */
export function updateMyProfile(input: { gameName: string | null }): Promise<ApiPlayerProfile> { return apiFetch('/players/me', jsonInit('PUT', input), true); }

// ---- Ligacao Discord -> perfil (painel; permissao discord.links) ----
export interface ApiDiscordRole { roleId: string; name: string; ninjaRankId: string | null }
export interface ApiDiscordGuild { guildId: string; name: string; active: boolean; memberCount: number; villageId: string | null; readers: number; membersStored: number; membersSyncedAt: string | null; membersPartial: boolean; roles: ApiDiscordRole[] }
/** Servidores que o bot informou, com a vila e o mapeamento cargo -> rank. */
export function listDiscordLinks(): Promise<ApiDiscordGuild[]> { return apiFetch('/discord-links', { cache: 'no-store' }); }
export interface ApiDiscordMember { discordId: string; username: string; displayName: string; isBot: boolean; joinedAt: string | null; roles: string[] }
export interface ApiDiscordMembersPage { total: number; items: ApiDiscordMember[]; syncedAt: string | null; partial: boolean }
/** Membros de um servidor (paginado; `q` busca por nome ou ID). So' quem tem discord.links. */
export function listDiscordGuildMembers(guildId: string, opts: { q?: string; limit?: number; offset?: number } = {}): Promise<ApiDiscordMembersPage> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  params.set('limit', String(opts.limit ?? 50));
  params.set('offset', String(opts.offset ?? 0));
  return apiFetch(`/discord-links/guilds/${guildId}/members?${params}`, { cache: 'no-store' });
}
/** Salva a vila do servidor e os cargos -> rank (a API recalcula na hora o perfil dos jogadores do servidor). */
export function saveDiscordLinks(guildId: string, input: { villageId: string | null; roles: { roleId: string; ninjaRankId: string | null }[] }): Promise<ApiDiscordGuild> {
  return apiFetch(`/discord-links/guilds/${guildId}`, jsonInit('PUT', input));
}
/** Painel (tournaments.manage): todos os torneios, inclusive rascunhos, nao listados e escondidos. */
export function listTournamentsForModeration(opts: { q?: string; hidden?: boolean; status?: TournamentStatus } = {}): Promise<ApiModerationTournament[]> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.hidden !== undefined) params.set('hidden', String(opts.hidden));
  if (opts.status) params.set('status', opts.status);
  return apiFetch(`/tournaments-moderation?${params}`);
}
export function moderateTournament(id: string, patch: { hidden?: boolean; name?: string; description?: string }): Promise<void> { return apiFetch(`/tournaments-moderation/${id}`, jsonInit('PATCH', patch)); }
export function deleteTournamentModeration(id: string): Promise<void> { return apiFetch(`/tournaments-moderation/${id}`, jsonInit('DELETE')); }
/** Ranks ninja (Genin ate' Kage) - usados no perfil do jogador. */
export function listNinjaRanks(): Promise<ApiNinjaRank[]> { return apiFetch('/ninja-ranks'); }
