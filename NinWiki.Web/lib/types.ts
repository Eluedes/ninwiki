// Tipos centrais do wiki. Hoje alimentam apenas o mock em lib/data.ts,
// mas devem ficar espelhados no schema real do banco (NinWiki.Api)
// quando a Fase 1 (modelo de dados) estiver pronta - qualquer campo
// novo aqui precisa de um campo equivalente na tabela do backend.

// Raridade de um item/drop. Usado tanto para exibir cor/selo quanto
// para ordenar visualmente do mais comum ao mais raro.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'enchanted' | 'unique' | 'event';

// Categorias do catalogo publico (aparecem no menu e nas rotas /catalog/[category]).
// "masteries" tem pagina propria em /masteries (nao usa mais o catalogo
// generico) - ver app/(wiki)/(lore)/masteries/.
export type Category = 'mobs' | 'items' | 'guides' | 'masteries' | 'weapons' | 'missions';

// Subtipo de uma entry dentro da categoria "mobs". A categoria "mobs"
// cobre TUDO que e' um personagem nao-jogavel no mundo do jogo, nao so'
// monstro comum de farm - por isso a necessidade deste campo extra pra
// diferenciar visualmente cada tipo na listagem (badge/filtro).
// 'monster'  -> mob comum de farm (o que ja existia antes)
// 'boss'     -> muito mais forte, geralmente precisa de grupo, dropa itens raros
// 'npc'      -> personagem nao-jogavel amigavel (vendedor, dono de missao, etc.)
// 'mount'    -> montaria (mob domesticavel/comum, nao e' hostil)
export type MobType = 'monster' | 'boss' | 'npc' | 'mount';

// Subtipo de uma entry dentro da categoria "items". Sem isso, um Ring
// (anel) ficaria indistinguível de uma poção ou material de crafting
// na listagem - o valor por padrao (quando ausente) e' tratado como
// 'general' no catalogo, entao entries antigas nao precisam de migracao.
export type ItemType = 'general' | 'ring' | 'consumable' | 'material' | 'currency' | 'cast' | 'authority' | 'accessory' | 'shirt' | 'vest' | 'pant' | 'hat' | 'mask' | 'shoe' | 'pack';

// Um item que pode "dropar" (cair) de um mob ao ser derrotado.
export interface DropEntry {
  name: string;
  rarity: Rarity;
  chance: number;      // percentual de chance de drop (ex: 25 = 25%)
  minQty?: number;      // quantidade minima recebida, se dropar
  maxQty?: number;      // quantidade maxima recebida, se dropar
}

// Linha generica de atributo exibida na ficha de detalhe
// (ex: { label: "Health", value: 45 }). Generico de proposito para
// servir tanto para mobs (HP/Dano) quanto para armas (Ataque/Durabilidade).
export interface AttributeRow {
  label: string;
  value: string | number;
}

// Entrada principal do wiki (um mob, item, arma, missao ou guia).
// Representa uma "pagina" do catalogo.
export interface WikiEntry {
  id: string;         // hoje e' usado como slug tambem (ex: "larva") -
                       // na Fase 1 do backend isso vira um slug proprio,
                       // separado do id tecnico (uuid) da tabela.
  name: string;
  category: Category;
  // So' relevante quando category === 'mobs'. Opcional porque entries
  // antigas (antes desse campo existir) nao tem valor - o catalogo
  // trata a ausencia como 'monster' (o tipo mais comum).
  mobType?: MobType;
  // So' relevante quando category === 'items'. Opcional pelo mesmo
  // motivo do mobType - entries antigas nao tem valor.
  itemType?: ItemType;
  level: number;
  icon: string;        // emoji usado como icone (ex: um bicho)
  // Caminho local ou URL devolvida pelo back-end. Pode ficar vazio/null
  // enquanto a entrada ainda usa o `icon` como fallback visual.
  image?: string | null;
  rarity: Rarity;
  description: string;   // texto curto, sempre visivel
  lore?: string;          // texto de "historia"/flavor text, opcional
  synergy?: string;        // dica de estrategia/sinergia, opcional
  attributes: AttributeRow[];
  drops?: DropEntry[];       // so' faz sentido para mobs
}

// Metadados exibidos nos cards da home e usados para identificar uma
// categoria do catalogo. O menu principal tem sua propria configuracao
// em components/header.tsx, porque nem todos os links do menu sao
// categorias do catalogo.
// title/description sao objetos com pt/en porque o site e' bilingue
// (ver lib/i18n.ts e components/providers/language-provider.tsx).
export interface CategoryInfo {
  key: Category;
  // Destino do card na home. Pode ser uma rota de catalogo, uma rota
  // especial (ex: /masteries) ou qualquer outro href valido.
  href: string;
  // Imagem opcional exibida no card da home. Se estiver vazia, o componente
  // usa o `icon` como fallback, então nenhum card quebra sem imagem.
  image?: string | null;
  icon: string;
  title: { pt: string; en: string };
  description: { pt: string; en: string };
}

// Idiomas suportados pelo seletor de idioma no header.
export type Locale = 'pt' | 'en';
