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
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { DropItemPicker } from '@/components/admin/drop-item-picker';
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
  type ContentItemInput,
  type ApiVillage,
} from '@/lib/api-client';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
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
function getItemTypeOptions(t: Dictionary['admin']['contentEditor']): { value: ItemType; label: string }[] {
  return [
    { value: 'general', label: t.itemGeneral },
    { value: 'ring', label: t.itemRing },
    { value: 'consumable', label: t.itemConsumable },
    { value: 'material', label: t.itemMaterial },
    { value: 'currency', label: t.itemCurrency },
    { value: 'cast', label: t.itemCast },
    { value: 'authority', label: t.itemAuthority },
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
];

const emptyForm: ContentItemFormValues = {
  slug: '',
  category: 'mobs',
  name: '',
  level: 1,
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
    { itemName: string; rarity: Rarity; chance: number; chanceQualifier?: 'over' | 'below' | null; droppedItemId?: string | null }[]
  >([]);
  // attacks: mesmo padrao de attributes/drops - lista dinamica fora do
  // Zod, so' usada quando category === 'mobs'.
  const [attacks, setAttacks] = useState<{ name: string }[]>([]);
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
  const itemTypeOptions = getItemTypeOptions(t);
  const category = useWatch({ control, name: 'category' });
  const itemType = useWatch({ control, name: 'itemType' });

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
        setAttributes(item.attributes);
        setDrops(item.drops);
        setAttacks(item.attacks);
      })
      .catch((err) => setApiError(err instanceof ApiError ? err.message : 'Error loading the entry.'))
      .finally(() => setLoading(false));
  }, [isEdit, rawId, reset]);

  function addAttribute() {
    setAttributes((prev) => [...prev, { label: '', value: '' }]);
  }
  function updateAttribute(index: number, field: 'label' | 'value', value: string) {
    setAttributes((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }
  function removeAttribute(index: number) {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  }

  function addDrop() {
    setDrops((prev) => [...prev, { itemName: '', rarity: 'common', chance: 10 }]);
  }
  function updateDrop(index: number, patch: Partial<(typeof drops)[number]>) {
    setDrops((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }
  function removeDrop(index: number) {
    setDrops((prev) => prev.filter((_, i) => i !== index));
  }

  function addAttack() {
    setAttacks((prev) => [...prev, { name: '' }]);
  }
  function updateAttack(index: number, name: string) {
    setAttacks((prev) => prev.map((a, i) => (i === index ? { name } : a)));
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
        // Zera o nivel se a categoria/tipo atual nao usa nivel (ver
        // shouldShowLevel em lib/utils.ts) - evita um numero antigo
        // ficar "escondido" mas ainda salvo, de uma epoca em que a
        // entry era, por exemplo, uma Arma antes de virar Material.
        level: shouldShowLevel(values.category, values.itemType ?? null) ? values.level : 0,
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
        mobHealth: values.category === 'mobs' ? values.mobHealth : null,
        mobDamage: values.category === 'mobs' ? values.mobDamage : null,
        mobExperience: values.category === 'mobs' ? values.mobExperience : null,
        mobRange: values.category === 'mobs' ? values.mobRange : null,
        mobRespawnTime: values.category === 'mobs' ? values.mobRespawnTime : null,
        attacks: values.category === 'mobs' ? attacks : [],
        weaponSpeed: values.category === 'weapons' ? values.weaponSpeed : null,
        weaponRequirement: values.category === 'weapons' ? values.weaponRequirement : null,
        weaponNpc: values.category === 'weapons' ? values.weaponNpc : null,
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
      router.push('/admin/content');
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
        href="/admin/content"
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
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">
              {t.slugLabel}
            </label>
            <Input {...register('slug')} />
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
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {itemTypeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Input {...register('weaponNpc')} placeholder={t.weaponNpcPlaceholder} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponType}</label>
                <Input {...register('weaponType')} placeholder={t.weaponTypePlaceholder} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponBaseDamage}</label>
                <Input {...register('weaponBaseDamage')} placeholder={t.weaponBaseDamagePlaceholder} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponSpecialAbility}</label>
                <Input {...register('weaponSpecialAbility')} placeholder={t.weaponSpecialAbilityPlaceholder} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.speed}</label>
                <Input {...register('weaponSpeed')} placeholder={t.speedPlaceholder} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.requirement}</label>
                <Input {...register('weaponRequirement')} placeholder={t.requirementPlaceholder} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-card-foreground">{t.weaponKnockbackDistance}</label>
                <Input {...register('weaponKnockbackDistance')} placeholder={t.weaponKnockbackDistancePlaceholder} />
              </div>
            </>
          )}

          {/* Itens que empilham (Moeda, Autoridade, Consumivel, Material): Max Stack. */}
          {itemHasStack(category, itemType) && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.maxStack}</label>
              <Input type="number" {...register('maxStack')} placeholder={t.maxStackPlaceholder} />
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

          <div className="space-y-2">
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
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {shouldShowLevel(category, itemType ?? null) && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.level}</label>
              <Input type="number" {...register('level')} />
              <FieldError message={errors.level?.message} />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-card-foreground">{t.icon}</label>
            <Input {...register('icon')} placeholder="🦠" />
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
            <Input {...register('spawnLocation')} placeholder={t.spawnLocationPlaceholder} />
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
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.damage}</label>
              <Input {...register('mobDamage')} placeholder={t.damagePlaceholder} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.experience}</label>
              <Input {...register('mobExperience')} placeholder={t.experiencePlaceholder} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.range}</label>
              <Input {...register('mobRange')} placeholder={t.rangePlaceholder} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-card-foreground">{t.respawnTime}</label>
              <Input {...register('mobRespawnTime')} placeholder={t.respawnTimePlaceholder} />
            </div>
          </div>
        </div>
      )}

      {/* Jutsu/Attacks: lista de texto livre (sem ligar a um Jutsu de
          verdade do catalogo - decisao com o Rafael, sao conceitos
          diferentes: Jutsu e' tecnica de JOGADOR). */}
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
              <Input placeholder={t.attackPlaceholder} value={attack.name} onChange={(e) => updateAttack(i, e.target.value)} />
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
              <Input placeholder={t.attributeLabelPlaceholder} value={attr.label} onChange={(e) => updateAttribute(i, 'label', e.target.value)} />
              <Input placeholder={t.attributeValuePlaceholder} value={attr.value} onChange={(e) => updateAttribute(i, 'value', e.target.value)} />
              <button type="button" onClick={() => removeAttribute(i)} className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-red-900/20 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {attributes.length === 0 && <p className="text-sm text-muted-foreground">{t.noAttributes}</p>}
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
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-2">
              <Input placeholder={t.dropNamePlaceholder} value={drop.itemName} onChange={(e) => updateDrop(i, { itemName: e.target.value })} />
              <DropItemPicker
                linkedId={drop.droppedItemId}
                onLink={(item) => updateDrop(i, { droppedItemId: item.id, itemName: item.name })}
                onUnlink={() => updateDrop(i, { droppedItemId: null })}
              />
              <Select value={drop.rarity} onValueChange={(v) => updateDrop(i, { rarity: v as Rarity })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rarityOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
