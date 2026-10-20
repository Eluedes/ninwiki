'use client';

// Formulario de criar/editar uma entry de Conteudo - agora com
// validacao de verdade via React Hook Form + Zod (ver lib/validation.ts):
// nivel negativo, campos obrigatorios vazios, etc. sao pegos NA HORA,
// campo por campo, antes de qualquer requisicao sair pra API - em vez
// de so descobrir o erro depois do POST, como a versao anterior fazia.
//
// Mesmo padrao de rota catch-all opcional [[...id]] dos editores
// antigos: /admin/content/edit/new cria, /admin/content/edit/{uuid} edita.

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { FieldHint } from '@/components/admin/field-hint';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { DropItemPicker } from '@/components/admin/drop-item-picker';
import { VersionHistory } from '@/components/admin/version-history';
import { EntryHistory } from '@/components/admin/entry-history';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Send, Plus, Trash2, Loader2, Languages } from 'lucide-react';
import {
  getContentItem,
  createContentItem,
  updateContentItem,
  retranslateContentItem,
  listVillages,
  ApiError,
  LOCATION_ZONES,
  type LocationEntry,
  type SaleEntry,
  type ContentItemInput,
  type ApiVillage,
} from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { WARDROBE_GROUP, isWardrobeType } from '@/lib/item-types';
import { SignedStepperInput } from '@/components/admin/signed-stepper-input';
import { JutsuPicker } from '@/components/admin/jutsu-picker';
import { EmojiPicker } from '@/components/admin/emoji-picker';
import { itemHasStack, shouldShowLevel } from '@/lib/utils';
import { contentItemSchema, type ContentItemFormValues } from '@/lib/validation';
import type { Category, ItemType, MobType, Rarity } from '@/lib/types';
import type { Dictionary } from '@/lib/i18n';

// Essas 4 listas de opcoes dependem do dicionario (dict.admin.contentEditor)
// pra' mostrar o rotulo certo no idioma escolhido - por isso viraram
// funcoes que recebem `t`, em vez de constantes de modulo fixas como
// eram antes (constante de modulo nao tem acesso ao dict, que so'
// existe depois que o componente renderiza com o LanguageProvider).
function getCategoryOptions(t: Dictionary['admin']['contentEditor']): { value: Category; label: string }[] {
  return [
    { value: 'mobs', label: t.catMobs },
    { value: 'items', label: t.catItems },
    { value: 'weapons', label: t.catWeapons },
    { value: 'missions', label: t.catMissions },
    { value: 'guides', label: t.catGuides },
  ];
}

/** Opcoes do campo 'tipo de mob' no idioma atual. */
function getMobTypeOptions(t: Dictionary['admin']['contentEditor']): { value: MobType; label: string }[] {
  return [
    { value: 'monster', label: t.mobMonster },
    { value: 'boss', label: t.mobBoss },
    { value: 'npc', label: t.mobNpc },
    { value: 'mount', label: t.mobMount },
  ];
}

/** Opcoes do campo 'tipo de item' no idioma atual. */
function getItemTypeOptions(t: Dictionary['admin']['contentEditor'], current?: ItemType | null): { value: string; label: string }[] {
  // O 1o seletor tem "Wardrobe / Guarda-roupa" (grupo) em vez de cada peca: a peca (Hat, Shirt...) escolhe-se num 2o seletor logo abaixo (ver getWardrobeOptions).
  // O Ring NAO entra no grupo: tem opcao propria aqui.
  // 'Material' saiu da lista (o que era material agora e' Moeda/Currency); so' aparece se o item JA' for desse tipo (itens antigos nao perdem o tipo).
  const all: { value: string; label: string }[] = [
    { value: 'general', label: t.itemGeneral },
    { value: WARDROBE_GROUP, label: t.itemWardrobe },
    { value: 'ring', label: t.itemRing },
    { value: 'consumable', label: t.itemConsumable },
    { value: 'material', label: t.itemMaterial },
    { value: 'currency', label: t.itemCurrency },
    { value: 'cast', label: t.itemCast },
    { value: 'authority', label: t.itemAuthority },
    { value: 'pack', label: t.itemPack },
  ];
  return all.filter((o) => o.value !== 'material' || current === 'material');
}

/** As pecas do grupo Wardrobe (2o seletor): Accessory, Shirt, Vest, Pant, Hat, Mask e Shoe. */
function getWardrobeOptions(t: Dictionary['admin']['contentEditor']): { value: ItemType; label: string }[] {
  return [
    { value: 'accessory', label: t.itemAccessory }, { value: 'shirt', label: t.itemShirt },
    { value: 'vest', label: t.itemVest }, { value: 'pant', label: t.itemPant }, { value: 'hat', label: t.itemHat },
    { value: 'mask', label: t.itemMask }, { value: 'shoe', label: t.itemShoe },
  ];
}

// Raridade fica de fora de proposito: os 6 nomes (Common/Uncommon/Rare/
// Epic/Legendary/Enchanted) sao termos de jogo em ingles ja' usados como convencao
// em toda a interface (ver badges do site publico) - traduzir so' esses
// 5 pra portugues destoaria do resto, sem ganho real de clareza.
const rarityOptions: { value: Rarity; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'enchanted', label: 'Enchanted' },
  { value: 'unique', label: 'Unique' },
  { value: 'event', label: 'Event' },   // itens de evento do jogo
  { value: 'premium', label: 'Premium' },
  { value: 'organization', label: 'Organization' },
];

// Atributos que um item/arma pode dar (lista fixa do jogo): escolhidos num seletor no editor.
const ATTRIBUTE_NAMES = ['Fortitude', 'Chakra', 'Strength', 'Intellect', 'Agility'] as const;

const emptyForm: ContentItemFormValues = {
  slug: '',
  category: 'mobs',
  name: '',
  level: 1,
  levelUnknown: false,
  icon: '',
  image: '',
  rarity: 'common',
  description: '',
  lore: '',
  synergy: '',
  spawnLocation: '',
  namePt: '',
  descriptionPt: '',
  lorePt: '',
  synergyPt: '',
  spawnLocationPt: '',
  mobHealth: '',
  mobDamage: '',
  mobExperience: '',
  mobRange: '',
  mobRespawnTime: '',
  weaponSpeed: '',
  weaponRequirement: '',
  weaponNpc: '',
  weaponType: '',
  weaponBaseDamage: '',
  weaponSpecialAbility: '',
  weaponKnockbackDistance: '',
  maxStack: null,
  castVillageId: null,
  mobType: null,
  itemType: null,
};

// Pequeno componente pra mostrar a mensagem de erro embaixo de um campo -
// so' renderiza algo se `message` existir, evita repetir o mesmo JSX
// de "if (erro) mostra <p>" em cada campo do formulario.
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Editor de uma entry do catalogo (criar/editar), com campos que mudam conforme a categoria. */
export default function ContentEditorPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const router = useRouter();
  const { id } = use(params);
  const rawId = id?.[0];
  const isEdit = Boolean(rawId && rawId !== 'new');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // attributes/drops ficam FORA do schema Zod de proposito - sao listas
  // dinamicas (o usuario adiciona/remove linha), controladas com
  // useState puro. Juntar os dois na hora de salvar (ver onValid).
  const [attributes, setAttributes] = useState<{ label: string; value: string }[]>([]);
  const [drops, setDrops] = useState<
    { itemName: string; chance: number; chanceQualifier?: 'over' | 'below' | null; droppedItemId?: string | null }[]
  >([]);
  // attacks: mesmo padrao de attributes/drops - lista dinamica fora do
  // Zod, so' usada quando category === 'mobs'.
  const [attacks, setAttacks] = useState<{ name: string; jutsuId?: string | null }[]>([]);
  // Lugares onde o mob aparece (lista com zona) e NPC da arma ligado a uma pagina: tambem fora do Zod, como attacks/drops.
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [weaponNpcId, setWeaponNpcId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleEntry[]>([]);   // lojas de NPC que vendem o item/arma (so' items e weapons)
  // Vilas de verdade, pro seletor do item tipo Cast - busca uma vez so',
  // ja' que sao poucas (3 hoje) e raramente mudam.
  const [villages, setVillages] = useState<ApiVillage[]>([]);
  useEffect(() => {
    listVillages().then(setVillages).catch(() => setVillages([]));
  }, []);

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ContentItemFormValues>({
    resolver: zodResolver(contentItemSchema),
    defaultValues: emptyForm,
  });

  const { dict } = useLanguage();
  const { can } = useAuth();
  const t = dict.admin.contentEditor;
  const categoryOptions = getCategoryOptions(t);
  const mobTypeOptions = getMobTypeOptions(t);
  const category = useWatch({ control, name: 'category' });
  const itemType = useWatch({ control, name: 'itemType' });
  const levelUnknown = useWatch({ control, name: 'levelUnknown' });   // marcado: o numero fica desabilitado e o site mostra ???
  const spawnText = useWatch({ control, name: 'spawnLocation' });   // texto livre antigo (para mostrar o botao de transformar em lista)
  const itemTypeOptions = getItemTypeOptions(t, itemType);
  const wardrobeOptions = getWardrobeOptions(t);

  // Entrada nova vinda da pagina de uma categoria do menu (?category=mobs): ja' abre com essa categoria escolhida.
  useEffect(() => {
    if (isEdit) return;
    const wanted = new URLSearchParams(window.location.search).get('category');
    if (wanted && ['mobs', 'items', 'weapons', 'missions', 'guides'].includes(wanted)) setValue('category', wanted as ContentItemFormValues['category']);
  }, [isEdit, setValue]);

  useEffect(() => {
    if (!isEdit || !rawId) return;
    getContentItem(rawId)
      .then((item) => {
        reset({
          slug: item.slug,
          // "as" seguro aqui: content_items nunca tem category "masteries"
          // de verdade (isso e' um valor legado do tipo Category no front,
          // masteries tem tabela propria) - ja' limpamos essas entries.
          category: item.category as ContentItemFormValues['category'],
          name: item.name,
          level: item.level,
          levelUnknown: item.levelUnknown ?? false,
          icon: item.icon,
          image: item.image ?? '',
          rarity: item.rarity,
          description: item.description,
          lore: item.lore ?? '',
          synergy: item.synergy ?? '',
          spawnLocation: item.spawnLocation ?? '',
          namePt: item.namePt ?? '',
          descriptionPt: item.descriptionPt ?? '',
          lorePt: item.lorePt ?? '',
          synergyPt: item.synergyPt ?? '',
          spawnLocationPt: item.spawnLocationPt ?? '',
          mobHealth: item.mobHealth ?? '',
          mobDamage: item.mobDamage ?? '',
          mobExperience: item.mobExperience ?? '',
          mobRange: item.mobRange ?? '',
          mobRespawnTime: item.mobRespawnTime ?? '',
          weaponSpeed: item.weaponSpeed ?? '',
          weaponRequirement: item.weaponRequirement ?? '',
          weaponNpc: item.weaponNpc ?? '',
          weaponType: item.weaponType ?? '',
          weaponBaseDamage: item.weaponBaseDamage ?? '',
          weaponSpecialAbility: item.weaponSpecialAbility ?? '',
          weaponKnockbackDistance: item.weaponKnockbackDistance ?? '',
          maxStack: item.maxStack,
          castVillageId: item.castVillageId,
          mobType: item.mobType,
          itemType: item.itemType,
        });
        setAttributes(item.attributes.map((a) => ({ ...a, label: a.label || ATTRIBUTE_NAMES[0] })));
        setDrops(item.drops.map(({ rarity: _rarity, ...rest }) => rest));   // a raridade do drop vem do item ligado (nao e' mais editada aqui)
        setAttacks(item.attacks.map((a) => ({ name: a.name, jutsuId: a.jutsuId ?? null })));
        setLocations(item.spawnLocations ?? []);
        setWeaponNpcId(item.weaponNpcId ?? null);
        setSales(item.soldAt ?? []);
      })
      .catch((err) => setApiError(err instanceof ApiError ? err.message : 'Error loading the entry.'))
      .finally(() => setLoading(false));
  }, [isEdit, rawId, reset]);

  function addAttribute() {
    setAttributes((prev) => [...prev, { label: ATTRIBUTE_NAMES[0], value: '0' }]);   // ja' nasce com um atributo escolhido (o seletor nunca fica vazio)
  }
  function updateAttribute(index: number, field: 'label' | 'value', value: string) {
    setAttributes((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }
  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }

  function addDrop() {
    setDrops((prev) => [...prev, { itemName: '', chance: 10 }]);
  }
  function updateDrop(index: number, patch: Partial<(typeof drops)[number]>) {
    setDrops((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }
  function removeDrop(index: number) {
    setDrops((prev) => prev.filter((_, i) => i !== index));
  }

  function addLocation() {
    setLocations((prev) => [...prev, { name: '', zone: 'safe' }]);
  }
  function updateLocation(index: number, patch: Partial<LocationEntry>) {
    setLocations((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  /** Transforma o texto livre antigo ("A, B, C") em linhas da lista e limpa o texto. */
  function convertSpawnText() {
    const parts = (getValues('spawnLocation') ?? '').split(/[,;\n]/).map((p) => p.trim().replace(/\.$/, '')).filter(Boolean);
    setLocations((prev) => [...prev, ...parts.map((name) => ({ name, zone: null }))]);
    setValue('spawnLocation', '', { shouldDirty: true });
  }

  function updateSale(index: number, patch: Partial<SaleEntry>) {
    setSales((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addAttack() {
    setAttacks((prev) => [...prev, { name: '' }]);
  }
  function updateAttack(index: number, patch: { name?: string; jutsuId?: string | null }) {
    setAttacks((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  function removeAttack(index: number) {
    setAttacks((prev) => prev.filter((_, i) => i !== index));
  }

  // handleSubmit(onValid) so' chama onValid DEPOIS que o Zod validou
  // tudo com sucesso - se algum campo estiver invalido, o RHF preenche
  // `errors` e a funcao nem chega a rodar, o form nem tenta salvar.
  // Forca uma traducao nova em todos os campos, mesmo os que ja' tem
  // valor - so' existe quando esta' editando (precisa de um id de
  // verdade). Recarrega o formulario com o resultado depois, igual
  // fazemos no reset() inicial.
  async function handleRetranslate() {
    if (!rawId) return;
    if (!window.confirm(dict.admin.translation.retranslateConfirm)) return;
    setRetranslating(true);
    setApiError(null);
    try {
      const item = await retranslateContentItem(rawId);
      reset({
        ...getValues(),
        namePt: item.namePt ?? '',
        descriptionPt: item.descriptionPt ?? '',
        lorePt: item.lorePt ?? '',
        synergyPt: item.synergyPt ?? '',
        spawnLocationPt: item.spawnLocationPt ?? '',
      });
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : dict.admin.translation.retranslateError);
    } finally {
      setRetranslating(false);
    }
  }

  async function onValid(values: ContentItemFormValues, publish: boolean) {
    setSaving(true);
    setApiError(null);
    try {
      const payload: ContentItemInput = {
        ...values,
        rarity: values.category === 'mobs' ? 'common' : values.rarity,   // mob nao tem raridade: grava Common por baixo
        // Zera o nivel se a categoria/tipo atual nao usa nivel (ver
        // shouldShowLevel em lib/utils.ts) - evita um numero antigo
        // ficar "escondido" mas ainda salvo, de uma epoca em que a
        // entry era, por exemplo, uma Arma antes de virar Material.
        level: shouldShowLevel(values.category, values.itemType ?? null) && !values.levelUnknown ? values.level : 0,
        levelUnknown: shouldShowLevel(values.category, values.itemType ?? null) ? values.levelUnknown : false,   // "???" so' faz sentido onde o nivel aparece
        mobType: values.category === 'mobs' ? values.mobType : null,
        itemType: values.category === 'items' ? values.itemType : null,
        // lore/synergy/spawnLocation: mesmo raciocinio de mobType/
        // itemType acima - limpa o campo se a categoria mudou pra uma
        // onde ele nao faz sentido, em vez de deixar lixo salvo (ex:
        // spawnLocation preenchido numa entry que virou Item).
        // Lore/Synergy: removidos de vez da interface pra TODA
        // categoria (decisao do Rafael, 27/09) - sempre manda null,
        // nunca o que estiver em values.lore/synergy (o campo nem
        // aparece mais no formulario, mas o Zod ainda carrega o valor
        // antigo se a entry ja tinha um preenchido de antes).
        lore: null,
        synergy: null,
        lorePt: null,
        synergyPt: null,
        spawnLocation: values.category === 'mobs' ? values.spawnLocation : null,
        spawnLocationPt: values.category === 'mobs' ? values.spawnLocationPt : null,
        spawnLocations: values.category === 'mobs' ? locations.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), namePt: l.namePt || null, zone: l.zone ?? null })) : [],
        mobHealth: values.category === 'mobs' ? values.mobHealth : null,
        mobDamage: values.category === 'mobs' ? values.mobDamage : null,
        mobExperience: values.category === 'mobs' ? values.mobExperience : null,
        mobRange: values.category === 'mobs' ? values.mobRange : null,
        mobRespawnTime: values.category === 'mobs' ? values.mobRespawnTime : null,
        attacks: values.category === 'mobs' ? attacks : [],
        weaponSpeed: values.category === 'weapons' ? values.weaponSpeed : null,
        weaponRequirement: values.category === 'weapons' ? values.weaponRequirement : null,
        weaponNpc: values.category === 'weapons' ? values.weaponNpc : null,
        weaponNpcId: values.category === 'weapons' ? weaponNpcId : null,
        soldAt: values.category === 'items' || values.category === 'weapons'
          ? sales.filter((s) => s.shop.trim()).map((s) => ({ shop: s.shop.trim(), places: s.places ?? [], qty: Math.max(1, Number(s.qty) || 1), price: Math.max(0, Number(s.price) || 0), currency: (s.currency ?? '').trim() || 'Ryo' }))
          : [],
        weaponType: values.category === 'weapons' ? values.weaponType : null,
        weaponBaseDamage: values.category === 'weapons' ? values.weaponBaseDamage : null,
        weaponSpecialAbility: values.category === 'weapons' ? values.weaponSpecialAbility : null,
        weaponKnockbackDistance: values.category === 'weapons' ? values.weaponKnockbackDistance : null,
        maxStack: itemHasStack(values.category, values.itemType) ? values.maxStack : null,
        castVillageId: values.category === 'items' && values.itemType === 'cast' ? values.castVillageId : null,
        attributes,
        drops: values.category === 'mobs' ? drops : [],
        status: publish ? 'published' : 'draft',
      };
      if (isEdit && rawId) {
        await updateContentItem(rawId, payload);
      } else {
        await createContentItem(payload);
      }
      router.push(`/admin/content/${values.category}`);   // volta para a lista da categoria
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Error saving. Is the API running?');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/admin/content/${category}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">
        {isEdit ? t.editTitle : t.newTitle}
      </h1>

      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {apiError}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.name}</label>
            <Input {...register('name')} />
            <FieldHint id="content.name" />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">
              {t.slugLabel}
            </label>
            <Input {...register('slug')} />
            <FieldHint id="content.slug" />
            <FieldError message={errors.slug?.message} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.category}</label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {category === 'mobs' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.mobType}</label>
              <Controller
                name="mobType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {mobTypeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {category === 'items' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.itemType}</label>
              <Controller
                name="itemType"
                control={control}
                render={({ field }) => (
                  <>
                    {/* 1o seletor: tipo do item. "Wardrobe" e' um grupo: ao escolher, aparece o 2o seletor com a peca. */}
                    <Select
                      value={isWardrobeType(field.value) ? WARDROBE_GROUP : (field.value ?? undefined)}
                      onValueChange={(v) => field.onChange(v === WARDROBE_GROUP ? (isWardrobeType(field.value) ? field.value : 'shirt') : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {itemTypeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isWardrobeType(field.value) && (
                      <div className="space-y-2 pt-2">
                        <label className="text-sm font-semibold text-card-foreground">{t.wardrobeKind}</label>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {wardrobeOptions.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              />
            </div>
          )}

          {/* Arma: campos fixos so' pra' categoria Armas (nao e' um
              item_type, e' categoria propria) - reorganizados em
              secoes (Requirements/Acquisition/Weapon Details/Battle
              Data) na ficha publica, ver DetailSidebar. "Class" da
              ficha do jogo = rarity (ja existe acima); "Stat Bonus" =
              a lista generica de Atributos logo abaixo (reaproveitada,
              sem campo novo). */}
          {category === 'weapons' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponNpc}</label>
                <div className="flex items-center gap-2">
                  <Input {...register('weaponNpc')} placeholder={t.weaponNpcPlaceholder} readOnly={Boolean(weaponNpcId)} />
                  <DropItemPicker
                    linkedId={weaponNpcId}
                    onlyCategories={['mobs']}
                    onLink={(npc) => { setWeaponNpcId(npc.id); setValue('weaponNpc', npc.name, { shouldDirty: true }); }}
                    onUnlink={() => setWeaponNpcId(null)}
                  />
                </div>
                {weaponNpcId && <p className="text-xs text-emerald-400">{t.weaponNpcLinked}</p>}
                <p className="text-xs text-muted-foreground">{t.weaponNpcHint}</p>
                <FieldHint id="content.weaponNpc" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponType}</label>
                <Input {...register('weaponType')} placeholder={t.weaponTypePlaceholder} />
                <FieldHint id="content.weaponType" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponBaseDamage}</label>
                <Input {...register('weaponBaseDamage')} placeholder={t.weaponBaseDamagePlaceholder} />
                <FieldHint id="content.weaponBaseDamage" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponSpecialAbility}</label>
                <Input {...register('weaponSpecialAbility')} placeholder={t.weaponSpecialAbilityPlaceholder} />
                <FieldHint id="content.weaponSpecialAbility" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.speed}</label>
                <Input {...register('weaponSpeed')} placeholder={t.speedPlaceholder} />
                <FieldHint id="content.weaponSpeed" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.requirement}</label>
                {/* Ate' 3 requisitos: cada campo e' uma linha do mesmo valor ("60 Agility" / "20 Chakra" / ...). */}
                <Controller
                  control={control}
                  name="weaponRequirement"
                  render={({ field }) => {
                    const lines = (field.value ?? '').split('\n');
                    const rows = lines.length ? lines : [''];
                    const update = (next: string[]) => field.onChange(next.join('\n'));
                    return (
                      <div className="space-y-2">
                        {rows.map((line, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input value={line} placeholder={t.requirementPlaceholder} onChange={(e) => update(rows.map((l, j) => (j === i ? e.target.value.replace(/\n/g, ' ') : l)))} />
                            {rows.length > 1 && (
                              <button type="button" onClick={() => update(rows.filter((_, j) => j !== i))} className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-red-900/20 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {rows.length < 3 && (
                          <Button type="button" variant="outline" size="sm" onClick={() => update([...rows, ''])}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> {t.addRequirement}
                          </Button>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponKnockbackDistance}</label>
                <Input {...register('weaponKnockbackDistance')} placeholder={t.weaponKnockbackDistancePlaceholder} />
                <FieldHint id="content.weaponKnockbackDistance" />
              </div>
            </>
          )}

          {/* Itens que empilham (Moeda, Autoridade, Consumivel, Material): Max Stack. */}
          {itemHasStack(category, itemType) && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.maxStack}</label>
              <Input type="number" {...register('maxStack')} placeholder={t.maxStackPlaceholder} />
              <FieldHint id="content.maxStack" />
              <FieldError message={errors.maxStack?.message} />
            </div>
          )}

          {/* Item tipo Cast: qual vila pode usar - select de verdade,
              ligado a uma vila real do catalogo (nao texto solto). */}
          {category === 'items' && itemType === 'cast' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.castVillage}</label>
              <Controller
                name="castVillageId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {villages.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* Mobs nao tem raridade (o banco guarda Common por baixo e o site nao mostra) */}
          {category !== 'mobs' && <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.rarity}</label>
            <Controller
              name="rarity"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rarityOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {shouldShowLevel(category, itemType ?? null) && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.level}</label>
              <Input type="number" {...register('level')} disabled={levelUnknown} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" {...register('levelUnknown')} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                {t.levelUnknown}
              </label>
              {(category === 'items' || category === 'weapons') && <p className="text-xs text-muted-foreground">{t.levelZeroHint}</p>}
              <FieldError message={errors.level?.message} />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.icon}</label>
            <div className="flex gap-2">
              <Input {...register('icon')} placeholder="🦠" />
              <EmojiPicker onPick={(emoji) => setValue('icon', emoji, { shouldDirty: true, shouldValidate: true })} />
            </div>
            <FieldHint id="content.icon" />
            <FieldError message={errors.icon?.message} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.image}</label>
          <Controller
            name="image"
            control={control}
            render={({ field }) => <ImageUploadField value={field.value} onChange={field.onChange} />}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-card-foreground">{t.description}{category === 'mobs' ? ` ${t.optionalSuffix}` : ''}</label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <RichTextEditor value={field.value} onChange={field.onChange} placeholder={t.descriptionPlaceholder} />
            )}
          />
          <FieldError message={errors.description?.message} />
        </div>
        {/* Lore/Synergy: REMOVIDOS DE VEZ da interface (decisao final do
            Rafael, 27/09 - "nao iremos usar isso em nenhuma categoria").
            Os campos continuam existindo no banco (lore/synergy/
            lore_pt/synergy_pt) e no schema Zod so' porque tirar tudo
            isso agora seria uma migracao a mais sem necessidade real -
            o payload em onValid ja' forca null nos 4 sempre, entao
            salvar qualquer entry existente que ainda tivesse dado
            antigo aqui limpa ele sozinho, sem precisar de um DELETE
            em massa. Se um dia quiser apagar as colunas de vez, e'
            rapido.  */}

        {/* Spawn location: SO' pra Mob (onde ele aparece no jogo).
            Texto livre por enquanto (ex: "Floresta Negra, Campos
            Iniciais") - sem marcador de mapa clicavel ainda, o Mapa em
            si continua so' um placeholder ate' ter a imagem real do
            jogo (Fase 5). */}
        {category === 'mobs' && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.spawnLocation}</label>
            {locations.map((loc, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <Input placeholder={t.locationPlaceholder} value={loc.name} onChange={(e) => updateLocation(i, { name: e.target.value })} />
                <select value={loc.zone ?? 'none'} onChange={(e) => updateLocation(i, { zone: e.target.value as LocationEntry['zone'] })} aria-label={t.zoneLabel}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  {LOCATION_ZONES.map((z) => <option key={z} value={z}>{t.zones[z]}</option>)}
                </select>
                <Button type="button" variant="ghost" size="icon" title={t.removeLocation} aria-label={t.removeLocation} onClick={() => setLocations((prev) => prev.filter((_, k) => k !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addLocation}><Plus className="mr-1 h-3.5 w-3.5" />{t.addLocation}</Button>
              {Boolean((spawnText ?? '').trim()) && <Button type="button" variant="outline" size="sm" onClick={convertSpawnText}>{t.convertText}</Button>}
            </div>
            <Input {...register('spawnLocation')} placeholder={t.spawnLocationPlaceholder} />
            <FieldHint id="content.spawnLocation" />
          </div>
        )}
      </div>

      {/* Ficha de Mob: campos fixos (Health/Damage/Experience/Range/
          Respawn Time), na mesma ordem da ficha do proprio jogo -
          substitui a lista generica de Atributos so' pra essa
          categoria. */}
      {category === 'mobs' && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-semibold text-card-foreground">{t.mobSheet}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.health}</label>
              <Input {...register('mobHealth')} placeholder={t.healthPlaceholder} />
              <FieldHint id="content.mobHealth" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.damage}</label>
              <Input {...register('mobDamage')} placeholder={t.damagePlaceholder} />
              <FieldHint id="content.mobDamage" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.experience}</label>
              <Input {...register('mobExperience')} placeholder={t.experiencePlaceholder} />
              <FieldHint id="content.mobExperience" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.range}</label>
              <Input {...register('mobRange')} placeholder={t.rangePlaceholder} />
              <FieldHint id="content.mobRange" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.respawnTime}</label>
              <Input {...register('mobRespawnTime')} placeholder={t.respawnTimePlaceholder} />
              <FieldHint id="content.mobRespawnTime" />
            </div>
          </div>
        </div>
      )}

      {/* Jutsu/Attacks: liga cada ataque a um JUTSU do catalogo (o nome vem dele e o visitante clica para ir a' skill) OU deixa
          so' o texto livre (golpe que nao existe como jutsu). */}
      {category === 'mobs' && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-card-foreground">{t.attacksTitle}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addAttack}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {attacks.map((attack, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input placeholder={t.attackPlaceholder} value={attack.name} readOnly={Boolean(attack.jutsuId)} onChange={(e) => updateAttack(i, { name: e.target.value })} />
              <JutsuPicker
                linkedId={attack.jutsuId}
                onLink={(jutsu) => updateAttack(i, { jutsuId: jutsu.id, name: jutsu.name })}
                onUnlink={() => updateAttack(i, { jutsuId: null })}
              />
              <button type="button" onClick={() => removeAttack(i)} className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-red-900/20 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {attacks.length === 0 && <p className="text-sm text-muted-foreground">{t.noAttacks}</p>}
        </div>
      )}

      {/* Atributos: lista dinamica de pares label/valor (controlada por
          useState puro, fora do schema Zod - ver comentario no topo).
          Escondida pra Mob de proposito - a ficha fixa acima substitui
          ela pra essa categoria. Continua disponivel pras outras
          (Arma pode ter atributo extra alem de Speed/Requisito, Item/
          Missao/Guia nao tem campo fixo proprio ainda). */}
      {category !== 'mobs' && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-card-foreground">{category === 'weapons' ? dict.detail.statBonus : t.attributesTitle}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addAttribute}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {attributes.map((attr, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* Valor primeiro (ex.: +2) e, ao lado, o ATRIBUTO escolhido numa lista fixa. Um atributo antigo com outro nome continua
                  aparecendo como opcao extra (nao se perde ao editar). */}
              <SignedStepperInput placeholder={t.attributeValuePlaceholder} value={attr.value} onChange={(v) => updateAttribute(i, 'value', v)} />
              <Select value={attr.label || ATTRIBUTE_NAMES[0]} onValueChange={(v) => updateAttribute(i, 'label', v)}>
                <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...ATTRIBUTE_NAMES, ...(attr.label && !(ATTRIBUTE_NAMES as readonly string[]).includes(attr.label) ? [attr.label] : [])].map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button type="button" onClick={() => removeAttribute(i)} className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-red-900/20 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {attributes.length === 0 && <p className="text-sm text-muted-foreground">{t.noAttributes}</p>}
        </div>
      )}

      {(category === 'items' || category === 'weapons') && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-card-foreground">{t.salesTitle}</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setSales((prev) => [...prev, { shop: '', places: [], qty: 1, price: 0, currency: 'Ryo' }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {t.addSale}
            </Button>
          </div>
          {sales.map((sale, i) => (
            <div key={i} className="space-y-1">
              <div className="grid grid-cols-[1fr_7rem_5rem_9rem_auto] items-center gap-2">
                <Input placeholder={t.saleShop} value={sale.shop} onChange={(e) => updateSale(i, { shop: e.target.value })} />
                <Input type="number" min={0} placeholder={t.salePrice} aria-label={t.salePrice} value={sale.price ?? 0} onChange={(e) => updateSale(i, { price: Number(e.target.value) })} />
                <Input type="number" min={1} placeholder={t.saleQty} aria-label={t.saleQty} value={sale.qty ?? 1} onChange={(e) => updateSale(i, { qty: Number(e.target.value) })} />
                <Input placeholder={t.saleCurrency} aria-label={t.saleCurrency} value={sale.currency ?? 'Ryo'} onChange={(e) => updateSale(i, { currency: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" title={t.removeSale} aria-label={t.removeSale} onClick={() => setSales((prev) => prev.filter((_, k) => k !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {(sale.places ?? []).length > 0 && <p className="truncate text-xs text-muted-foreground">{(sale.places ?? []).join(', ')}</p>}
            </div>
          ))}
        </div>
      )}

      {category === 'mobs' && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-card-foreground">{t.dropsTitle}</h2>
            <Button type="button" variant="outline" size="sm" onClick={addDrop}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {drops.map((drop, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2">
              <Input placeholder={t.dropNamePlaceholder} value={drop.itemName} onChange={(e) => updateDrop(i, { itemName: e.target.value })} />
              <DropItemPicker
                linkedId={drop.droppedItemId}
                onLink={(item) => updateDrop(i, { droppedItemId: item.id, itemName: item.name })}
                onUnlink={() => updateDrop(i, { droppedItemId: null })}
              />
              {/* Exato/Over/Below: como a % vai aparecer na ficha
                  publica - "Exato" (chanceQualifier null) mostra o
                  numero cru, igual sempre foi. Over/Below espelham a
                  ficha do proprio jogo. */}
              <Select
                value={drop.chanceQualifier ?? 'exact'}
                onValueChange={(v) => updateDrop(i, { chanceQualifier: v === 'exact' ? null : (v as 'over' | 'below') })}
              >
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">{t.qualifierExact}</SelectItem>
                  <SelectItem value="over">{t.qualifierOver}</SelectItem>
                  <SelectItem value="below">{t.qualifierBelow}</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" placeholder="%" value={drop.chance} onChange={(e) => updateDrop(i, { chance: Number(e.target.value) })} className="w-20" />
              <button type="button" onClick={() => removeDrop(i)} className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-red-900/20 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {drops.length === 0 && <p className="text-sm text-muted-foreground">{t.noDrops}</p>}
        </div>
      )}

      {/* Traducao automatica (DeepL) - so' aparece quando editando uma
          entry que ja existe (retraduzir precisa de um id de verdade).
          Todos os campos continuam editaveis a mao mesmo depois de
          preenchidos automaticamente - salvar o formulario normal ja'
          grava qualquer correcao feita aqui, sem precisar de um botao
          separado pra isso. */}
      {isEdit && rawId && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-card-foreground">
              <Languages className="h-4 w-4" /> {dict.admin.translation.sectionTitle}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={handleRetranslate} disabled={retranslating}>
              {retranslating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Languages className="mr-1.5 h-3.5 w-3.5" />}
              {retranslating ? dict.admin.translation.retranslating : dict.admin.translation.retranslate}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{dict.admin.translation.nameLabel}</label>
            <Input {...register('namePt')} placeholder={dict.admin.translation.emptyHint} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{dict.admin.translation.descriptionLabel}</label>
            <Controller
              name="descriptionPt"
              control={control}
              render={({ field }) => (
                <RichTextEditor value={field.value ?? ''} onChange={field.onChange} placeholder={dict.admin.translation.emptyHint} />
              )}
            />
          </div>

          {category === 'mobs' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{dict.admin.translation.spawnLocationLabel}</label>
              <Input {...register('spawnLocationPt')} placeholder={dict.admin.translation.emptyHint} />
            </div>
          )}
        </div>
      )}

      {isEdit && rawId && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="font-semibold text-card-foreground">{t.history}</h2>
          <EntryHistory entityType="content_item" entityId={rawId} />
          {can('content.edit') && <VersionHistory itemId={rawId} />}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={handleSubmit((v) => onValid(v, false))} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Salvar rascunho
        </Button>
        {/* So' quem tem a permissao de publicar (Adm/S.Adm) ve o botao. A API
            recusa de qualquer jeito se um Creator tentar por fora. */}
        {can('content.publish') && (
          <Button type="button" onClick={handleSubmit((v) => onValid(v, true))} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Publicar
          </Button>
        )}
      </div>
    </form>
  );
}
