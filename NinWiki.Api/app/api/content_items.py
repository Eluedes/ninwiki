"""
Endpoints REST de content_items (mobs/itens/armas/missoes/guias).

Rotas (todas sob o prefixo /content-items, definido no main.py):
  GET    /content-items              lista (com filtro opcional ?category=)
  GET    /content-items/{id}         ficha completa de uma entry
  POST   /content-items              cria uma nova entry (nasce DRAFT)
  PUT    /content-items/{id}         atualiza uma entry existente
  DELETE /content-items/{id}         apaga uma entry
  PATCH  /content-items/bulk-status  muda o status de VARIAS entries de uma vez
  POST   /content-items/bulk-delete  apaga VARIAS entries de uma vez
  POST   /content-items/bulk-import  cria VARIAS entries em rascunho a partir de uma lista de nomes

PERMISSOES: toda rota de escrita exige login + a permissao certa (content.create/edit/publish/delete/import -
ver app/core/permissions.py). Rascunho so' aparece para a equipe; o publico so' ve' entries PUBLICADAS.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.auth import get_optional_user, require_permission
from app.core.permissions import Permission
from app.core.publishing import guard_edit, guard_publish
from app.core.slug import slugify
from app.core.text import escape_like
from app.core.media_refs import resolve_images
from app.core.database import get_db
from app.models.users import User
from app.core.translation import translate_field
from app.models.enums import ContentStatus, ItemType, MobType, Rarity
from app.models.masteries import Jutsu
from app.models.content import ContentItem, ContentItemAttribute, ContentItemAttack, ContentItemDrop, ContentVersion
from app.models.enums import ContentCategory
from app.schemas.content import CamelModel, ContentItemCreate, ContentItemRead, ContentVersionRead, DroppedByEntry, ContentItemSummary, ContentItemUpdate

router = APIRouter(prefix="/content-items", tags=["content-items"])


class BulkStatusUpdate(CamelModel):
    """Corpo de mudar o status (rascunho/publicado) de varias entries de uma vez."""
    ids: list[UUID] = Field(min_length=1)
    status: ContentStatus


class BulkDelete(CamelModel):
    """Corpo de apagar varias entries de uma vez (lista de ids)."""
    ids: list[UUID] = Field(min_length=1)


@router.patch("/bulk-status", response_model=list[ContentItemSummary])
async def bulk_update_status(
    payload: BulkStatusUpdate,
    staff: User = Depends(require_permission(Permission.CONTENT_PUBLISH)),
    db: AsyncSession = Depends(get_db),
):
    """
    Muda o status de VARIAS entries numa unica requisicao - usado pelo
    botao "Publicar selecionados"/"Marcar como rascunho" da tabela do
    painel. Mais eficiente que o front chamar PUT uma vez por item
    (N requisicoes) e mais simples que criar um PATCH parcial generico
    so' pra' esse UM campo.

    ATENCAO DE ROTA: esta rota fica ANTES de "/{item_id}" no arquivo de
    proposito - por seguranca/clareza, mesmo o metodo (PATCH) sendo
    diferente do usado em "/{item_id}" hoje (GET/PUT/DELETE) e nao
    colidir na pratica: se um dia alguem adicionar um PATCH "/{item_id}"
    tambem, a ORDEM de definicao e' o que decide qual rota o FastAPI
    tenta primeiro - "bulk-status" viraria um valor de {item_id}
    (e falharia a validacao de UUID) se viesse depois.
    """
    stmt = select(ContentItem).where(ContentItem.id.in_(payload.ids))
    result = await db.execute(stmt)
    items = result.scalars().all()

    for item in items:
        item.status = payload.status

    await log_action(
        db, actor=staff, action="bulk-status", entity_type="content_item", entity_id=f"{len(items)} itens",
        diff={"status": payload.status.value, "ids": [str(i) for i in payload.ids]},
    )
    await db.commit()
    for item in items:
        await db.refresh(item)
    return items


@router.post("/bulk-delete", status_code=204)
async def bulk_delete(
    payload: BulkDelete,
    staff: User = Depends(require_permission(Permission.CONTENT_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga VARIAS entries de uma vez - usado pelo botão "Apagar selecionados" da tabela."""
    stmt = select(ContentItem).where(ContentItem.id.in_(payload.ids))
    result = await db.execute(stmt)
    items = result.scalars().all()

    for item in items:
        await db.delete(item)

    await log_action(
        db, actor=staff, action="bulk-delete", entity_type="content_item", entity_id=f"{len(items)} itens",
        diff={"ids": [str(i) for i in payload.ids]},
    )
    await db.commit()


_DEFAULT_ICON_BY_CATEGORY: dict[str, str] = {
    "mobs": "👹",
    "items": "📦",
    "weapons": "⚔️",
    "missions": "📜",
    "guides": "📖",
}


class BulkImportEntry(CamelModel):
    """Uma entry da importacao em massa: so' nome e categoria."""
    name: str = Field(min_length=1, max_length=200)
    category: ContentCategory
    mob_type: MobType | None = None
    item_type: ItemType | None = None
    name_pt: str | None = Field(default=None, max_length=200)   # nome oficial em portugues (vem do arquivo de traducao do jogo)


class BulkImportRequest(CamelModel):
    """Corpo da importacao em massa: lista de entries a criar como rascunho."""
    entries: list[BulkImportEntry] = Field(min_length=1, max_length=5000)


class BulkImportResult(CamelModel):
    """Resultado da importacao em massa: quantas foram criadas e quantas puladas por duplicata."""
    created: int
    skipped_duplicates: int


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import(
    payload: BulkImportRequest,
    staff: User = Depends(require_permission(Permission.CONTENT_IMPORT)),
    db: AsyncSession = Depends(get_db),
):
    """
    Importacao de JSON em massa - cria VARIAS entries de uma vez, todas
    como RASCUNHO com so' o essencial preenchido (nome, categoria, slug
    gerado, icone padrao da categoria). Pensado pra' quando a pessoa ja'
    tem uma lista de nomes de verdade (extraida do jogo, por exemplo) e
    quer parar de clicar "+ Nova entry" centenas de vezes - ela sobe o
    JSON aqui, e as entries nascem prontas pra' ela so' abrir cada uma
    e completar nivel/descricao/imagem depois, ao inves de digitar tudo
    do zero.

    NAO tenta adivinhar nivel, raridade ou descricao - esses campos
    exigem conhecimento real do jogo que so' um JSON bruto de nomes nao
    tem. Fica tudo como valor padrao (nivel 0, raridade comum, descricao
    vazia) ate' alguem editar de verdade.

    Duplicatas (slug que ja existe) sao puladas silenciosamente, sem
    dar erro pro resto do lote - contadas em `skippedDuplicates` pra'
    quem importou saber quantas ja existiam.
    """
    # Busca TODOS os slugs existentes de uma vez (1 query), em vez de
    # checar um por um dentro do loop (o que seria 1 query por entry -
    # lento demais pra' um lote de milhares).
    existing_slugs_result = await db.execute(select(ContentItem.slug))
    existing_slugs = set(existing_slugs_result.scalars().all())

    created = 0
    skipped = 0
    new_items: list[ContentItem] = []

    for entry in payload.entries:
        # fold_accents=False: mantem o slug de sempre (letra acentuada vira hifen); "item" se nada sobrar
        base_slug = slugify(entry.name, fold_accents=False) or "item"
        slug = base_slug
        # Colisao DENTRO do proprio lote (dois nomes que geram o mesmo
        # slug) tambem conta, nao so' contra o banco - por isso
        # `existing_slugs` recebe cada slug novo assim que decidido,
        # nao so' no final.
        if slug in existing_slugs:
            skipped += 1
            continue
        existing_slugs.add(slug)

        item = ContentItem(
            slug=slug,
            category=entry.category,
            name=entry.name,
            level=0,
            icon=_DEFAULT_ICON_BY_CATEGORY.get(entry.category.value, "❔"),
            rarity=Rarity.COMMON,
            description="",
            name_pt=(entry.name_pt or "").strip() or None,
            mob_type=entry.mob_type,
            item_type=entry.item_type,
            status=ContentStatus.DRAFT,
        )
        new_items.append(item)
        created += 1

    db.add_all(new_items)
    await log_action(
        db, actor=staff, action="bulk-import", entity_type="content_item", entity_id=f"{created} itens",
        diff={"created": created, "skipped_duplicates": skipped},
    )
    await db.commit()

    return BulkImportResult(created=created, skipped_duplicates=skipped)


@router.get("", response_model=list[ContentItemSummary])
async def list_content_items(
    category: ContentCategory | None = Query(None, description="Filtra por categoria (ex: mobs)"),
    status: ContentStatus | None = Query(None, description="Filtra por status (draft/published) - o site publico usa isso pra' nunca mostrar rascunho"),
    search: str | None = Query(None, min_length=1, max_length=100, description="Busca por nome (contem, sem diferenciar maiusculas) - usado pelo seletor de item ao ligar um drop"),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista entries, mais recentes primeiro. Sem attributes/drops (ver ContentItemSummary)."""
    stmt = select(ContentItem).order_by(ContentItem.created_at.desc())
    if category:
        stmt = stmt.where(ContentItem.category == category)
    if status:
        stmt = stmt.where(ContentItem.status == status)
    # RASCUNHO NUNCA aparece pra' quem nao e' da equipe, mesmo pedindo
    # ?status=draft ou sem filtro nenhum - so' o painel (logado) ve' tudo.
    if user is None:
        stmt = stmt.where(ContentItem.status == ContentStatus.PUBLISHED)
    if search:
        # Escapa % e _ digitados pela pessoa: sem isso "%" casaria com tudo (e "_" com qualquer letra).
        stmt = stmt.where(ContentItem.name.ilike(f"%{escape_like(search)}%", escape="\\")).limit(20)
    result = await db.execute(stmt)
    return result.scalars().all()


async def _dropped_by(item: ContentItem, db: AsyncSession) -> list[DroppedByEntry]:
    """
    Mobs PUBLICADOS que dropam `item`, calculado na hora (nada e' cadastrado a mao): conta o drop que esta' LIGADO ao item
    (dropped_item_id) e tambem o drop so' com o NOME igual (sem ligacao). Um mob aparece uma vez, com a maior chance.
    """
    if item.category == ContentCategory.MOBS:
        return []   # mob nao e' dropado por ninguem
    stmt = (
        select(ContentItem, ContentItemDrop)
        .join(ContentItemDrop, ContentItemDrop.content_item_id == ContentItem.id)
        .where(
            ContentItem.status == ContentStatus.PUBLISHED,
            or_(
                ContentItemDrop.dropped_item_id == item.id,
                (ContentItemDrop.dropped_item_id.is_(None)) & (func.lower(ContentItemDrop.item_name) == item.name.lower()),
            ),
        )
        .order_by(ContentItem.name)
    )
    best: dict[UUID, DroppedByEntry] = {}
    for mob, drop in (await db.execute(stmt)).all():
        entry = DroppedByEntry(
            slug=mob.slug, name=mob.name, name_pt=mob.name_pt, image=mob.image, icon=mob.icon,
            chance=float(drop.chance), chance_qualifier=drop.chance_qualifier,
        )
        if mob.id not in best or entry.chance > best[mob.id].chance:
            best[mob.id] = entry
    return list(best.values())


@router.get("/{item_id}", response_model=ContentItemRead)
async def get_content_item(
    item_id: UUID, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    """Ficha completa de UMA entry, com attributes, drops e (automatico) os mobs que dropam o item."""
    item = await _get_item_or_404(item_id, db)
    _hide_draft_from_public(item, user)
    read = ContentItemRead.model_validate(item)
    read.dropped_by = await _dropped_by(item, db)
    return read


@router.get("/slug/{slug}", response_model=ContentItemRead)
async def get_content_item_by_slug(
    slug: str, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db),
):
    """
    Mesma ficha completa de get_content_item, so' que buscando pelo
    SLUG (ex: "larva") em vez do UUID interno - usado pelo site
    publico, que quer URLs legiveis (/detail/larva), nao o uuid feio
    do banco. O painel admin continua usando o UUID normalmente (ele
    edita pelo id que já tem em mãos, não precisa de slug).

    SEM COLISAO DE ROTA: "/slug/{slug}" tem DOIS segmentos depois de
    /content-items/ ("slug" + o valor), enquanto "/{item_id}" logo
    acima tem UM so' - formatos diferentes, o FastAPI nunca confunde
    os dois nem depende da ordem entre eles (diferente do caso de
    "/bulk-status" vs "/{item_id}", que tinham o MESMO formato de um
    segmento so' e por isso a ordem importava).
    """
    stmt = (
        select(ContentItem)
        .where(ContentItem.slug == slug)
        .options(
            selectinload(ContentItem.attributes),
            selectinload(ContentItem.attacks),
            selectinload(ContentItem.cast_village),
            selectinload(ContentItem.drops).selectinload(ContentItemDrop.dropped_item),
        )
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    _hide_draft_from_public(item, user)
    read = ContentItemRead.model_validate(item)
    read.dropped_by = await _dropped_by(item, db)
    return read


async def _validate_dropped_item_ids(drops: list, db: AsyncSession) -> None:
    """
    Confere que todo dropped_item_id mandado aponta pra uma entry que
    existe de verdade, antes de gravar - sem isso, um id invalido so'
    falharia la' na hora do INSERT, com um erro cru de constraint em
    vez de uma mensagem clara. Mesma ideia de _validate_mastery_and_path
    em app/api/masteries.py.
    """
    await _drop_rarities(drops, db)


async def _drop_rarities(drops: list, db: AsyncSession) -> dict:
    """
    Valida os dropped_item_id (ver acima) e devolve {id do item ligado: raridade dele}. A raridade de um drop vem do item ligado;
    drop so' com texto (sem item ligado) usa a raridade mandada ou Common.
    """
    ids = {d.dropped_item_id for d in drops if d.dropped_item_id is not None}
    if not ids:
        return {}
    result = await db.execute(select(ContentItem.id, ContentItem.rarity).where(ContentItem.id.in_(ids)))
    found = {row[0]: row[1] for row in result.all()}
    missing = ids - set(found)
    if missing:
        raise HTTPException(status_code=400, detail=f"Item(s) linked to the drop do not exist: {', '.join(str(i) for i in missing)}")
    return found


async def _attack_jutsu_names(attacks: list, db: AsyncSession) -> dict[str, str]:
    """Confere que todo jutsu ligado a um ataque existe e devolve {id do jutsu: nome dele} (o ataque guarda o nome como reserva)."""
    ids = {a.jutsu_id for a in attacks if a.jutsu_id}
    if not ids:
        return {}
    result = await db.execute(select(Jutsu.id, Jutsu.name).where(Jutsu.id.in_(ids)))
    found = {row[0]: row[1] for row in result.all()}
    missing = ids - set(found)
    if missing:
        raise HTTPException(status_code=400, detail=f"Jutsu(s) linked to the attack do not exist: {', '.join(sorted(missing))}")
    return found


async def _weapon_npc_link(npc_id, category, db: AsyncSession, own_id=None) -> "ContentItem | None":
    """
    Confere que o NPC ligado a uma ARMA existe (e nao e' a propria arma) e o devolve. Sem ligacao, ou em categoria que nao e' arma, devolve None
    (o editor so' manda o vinculo em armas; qualquer outra coisa e' ignorada).
    """
    if npc_id is None or category != ContentCategory.WEAPONS:
        return None
    if own_id is not None and npc_id == own_id:
        raise HTTPException(status_code=400, detail="A weapon cannot be linked to itself")
    npc = await db.get(ContentItem, npc_id)
    if npc is None:
        raise HTTPException(status_code=400, detail=f"The NPC linked to the weapon does not exist: {npc_id}")
    return npc


def _rarity_of_drop(drop, linked_rarities: dict) -> Rarity:
    """Raridade gravada no drop: a do item ligado; sem ligacao, a enviada (ou Common)."""
    if drop.dropped_item_id is not None and drop.dropped_item_id in linked_rarities:
        return linked_rarities[drop.dropped_item_id]
    return drop.rarity or Rarity.COMMON


async def _validate_cast_village_id(cast_village_id: str | None, db: AsyncSession) -> None:
    """Mesma ideia de _validate_dropped_item_ids, pro village escolhido no item tipo Cast."""
    if cast_village_id is None:
        return
    from app.models.villages import Village
    village = await db.get(Village, cast_village_id)
    if village is None:
        raise HTTPException(status_code=400, detail=f"Village '{cast_village_id}' does not exist")


# Pares (campo EN, campo PT) - usado tanto por _fill_missing_translations
# quanto pelo endpoint de retraducao forcada, pra nao repetir essa
# lista duas vezes.
_TRANSLATABLE_FIELDS = [
    ("name", "name_pt"),
    ("description", "description_pt"),
    ("lore", "lore_pt"),
    ("synergy", "synergy_pt"),
    ("spawn_location", "spawn_location_pt"),
]


async def _fill_missing_translations(item: ContentItem) -> bool:
    """
    Preenche SO' os campos "_pt" que estao vazios, traduzindo o campo
    EN correspondente via DeepL - nunca sobrescreve um "_pt" que ja'
    tem algum valor (seja uma traducao automatica anterior, seja uma
    correcao manual de alguem) - ver POST /content-items/{id}/retranslate
    pra' quando a pessoa realmente QUISER forcar uma traducao nova por
    cima do que ja existe.

    Devolve True se preencheu algum campo.

    Sem efeito nenhum se DEEPL_API_KEY nao estiver configurada -
    translate_field ja' devolve None nesse caso, e o campo so' fica
    vazio ate' alguem preencher a mao ou configurar a chave depois.
    """
    filled = False
    for field_en, field_pt in _TRANSLATABLE_FIELDS:
        if getattr(item, field_pt):
            continue
        translated = await translate_field(getattr(item, field_en))
        if translated:
            setattr(item, field_pt, translated)
            filled = True
    return filled


@router.post("", response_model=ContentItemRead, status_code=201)
async def create_content_item(
    payload: ContentItemCreate,
    staff: User = Depends(require_permission(Permission.CONTENT_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """
    Cria uma entry nova. slug precisa ser unico - se ja existir,
    devolve 409 (Conflict) em vez de deixar o Postgres estourar um
    erro de constraint cru pro cliente.
    """
    await resolve_images(db, payload)  # image: aceita o ID do banco de imagens (img:12)
    # (criar sempre gera RASCUNHO - ver ContentItemCreate; quem publica e' o
    # PUT com status/bulk-status, ambos protegidos por CONTENT_PUBLISH)
    existing = await db.execute(select(ContentItem).where(ContentItem.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"An entry with the slug '{payload.slug}' already exists")

    linked_rarities = await _drop_rarities(payload.drops, db)
    jutsu_names = await _attack_jutsu_names(payload.attacks, db)
    await _validate_cast_village_id(payload.cast_village_id, db)
    npc = await _weapon_npc_link(payload.weapon_npc_id, payload.category, db)

    item = ContentItem(
        slug=payload.slug, category=payload.category, name=payload.name, level=0 if payload.level_unknown else payload.level, level_unknown=payload.level_unknown,
        icon=payload.icon, image=payload.image, rarity=payload.rarity, description=payload.description,
        lore=payload.lore, synergy=payload.synergy, spawn_location=payload.spawn_location,
        spawn_locations=[loc.model_dump() for loc in payload.spawn_locations] or None,
        sold_at=[sale.model_dump() for sale in payload.sold_at] or None,
        name_pt=payload.name_pt, description_pt=payload.description_pt, lore_pt=payload.lore_pt,
        synergy_pt=payload.synergy_pt, spawn_location_pt=payload.spawn_location_pt,
        mob_health=payload.mob_health, mob_damage=payload.mob_damage, mob_experience=payload.mob_experience,
        mob_range=payload.mob_range, mob_respawn_time=payload.mob_respawn_time,
        weapon_speed=payload.weapon_speed, weapon_requirement=payload.weapon_requirement,
        weapon_npc=npc.name if npc is not None else payload.weapon_npc, weapon_npc_id=npc.id if npc is not None else None, weapon_type=payload.weapon_type,
        weapon_base_damage=payload.weapon_base_damage, weapon_special_ability=payload.weapon_special_ability,
        weapon_knockback_distance=payload.weapon_knockback_distance,
        max_stack=payload.max_stack, cast_village_id=payload.cast_village_id,
        mob_type=payload.mob_type, item_type=payload.item_type,
    )
    for i, attr in enumerate(payload.attributes):
        item.attributes.append(ContentItemAttribute(label=attr.label, value=attr.value, sort_order=i))
    for i, attack in enumerate(payload.attacks):
        item.attacks.append(ContentItemAttack(name=jutsu_names.get(attack.jutsu_id, attack.name.strip()), jutsu_id=attack.jutsu_id or None, sort_order=i))
    for drop in payload.drops:
        item.drops.append(ContentItemDrop(
            item_name=drop.item_name, rarity=_rarity_of_drop(drop, linked_rarities), chance=drop.chance,
            chance_qualifier=drop.chance_qualifier, min_qty=drop.min_qty, max_qty=drop.max_qty,
            dropped_item_id=drop.dropped_item_id,
        ))

    # Selo 'traducao automatica': so' se a DeepL preencheu algo e ninguem escreveu o portugues a mao neste envio
    human_wrote = any(getattr(item, pt) for _, pt in _TRANSLATABLE_FIELDS)
    filled = await _fill_missing_translations(item)
    item.translation_auto = filled and not human_wrote

    db.add(item)
    await db.commit()
    await db.refresh(item, attribute_names=["attributes", "attacks", "drops"])

    await log_action(db, actor=staff, action="create", entity_type="content_item", entity_id=str(item.id),
                      diff={"name": item.name, "category": item.category.value})
    await db.commit()
    return await _get_item_or_404(item.id, db)


@router.put("/{item_id}", response_model=ContentItemRead)
async def update_content_item(
    item_id: UUID,
    payload: ContentItemUpdate,
    staff: User = Depends(require_permission(Permission.CONTENT_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """
    Atualiza uma entry existente. attributes/drops sao substituidos por
    completo (apaga os antigos, grava os novos) - mais simples e mais
    seguro do que tentar "casar" cada linha antiga com a nova por
    posicao, que facilmente bagunçaria a ordem em edicoes parciais.
    """
    item = await _get_item_or_404(item_id, db)
    await resolve_images(db, payload)  # campos de imagem aceitam o ID do banco de imagens (img:12)
    _guard_edit(staff, item, payload.status)
    before = {"name": item.name, "status": item.status.value}
    previous_pt = {pt: getattr(item, pt) for _, pt in _TRANSLATABLE_FIELDS}   # para saber se alguem mexeu no portugues nesta edicao
    # Historico: guarda o estado ATUAL (antes desta edicao) para poder desfazer; entra na mesma transacao da edicao.
    db.add(ContentVersion(
        content_item_id=item.id, saved_by=staff.username,
        snapshot=ContentItemRead.model_validate(item).model_dump(mode="json", by_alias=True, exclude={"dropped_by"}),
    ))

    linked_rarities = await _drop_rarities(payload.drops, db)
    jutsu_names = await _attack_jutsu_names(payload.attacks, db)
    await _validate_cast_village_id(payload.cast_village_id, db)
    npc = await _weapon_npc_link(payload.weapon_npc_id, payload.category, db, own_id=item.id)

    item.category = payload.category
    item.name = payload.name
    item.level = 0 if payload.level_unknown else payload.level   # nivel desconhecido: o numero fica 0
    item.level_unknown = payload.level_unknown
    item.icon = payload.icon
    item.image = payload.image
    item.rarity = payload.rarity
    item.description = payload.description
    item.lore = payload.lore
    item.synergy = payload.synergy
    item.spawn_location = payload.spawn_location
    item.spawn_locations = [loc.model_dump() for loc in payload.spawn_locations] or None
    item.sold_at = [sale.model_dump() for sale in payload.sold_at] or None
    # name_pt/description_pt/etc: aceita o que o payload mandou (a
    # pessoa pode ter corrigido a mao no editor) - _fill_missing_translations
    # logo abaixo so' preenche o que CONTINUAR vazio depois disso, nunca
    # sobrescreve um valor que acabou de vir preenchido no payload.
    item.name_pt = payload.name_pt
    item.description_pt = payload.description_pt
    item.lore_pt = payload.lore_pt
    item.synergy_pt = payload.synergy_pt
    item.spawn_location_pt = payload.spawn_location_pt
    item.mob_health = payload.mob_health
    item.mob_damage = payload.mob_damage
    item.mob_experience = payload.mob_experience
    item.mob_range = payload.mob_range
    item.mob_respawn_time = payload.mob_respawn_time
    item.weapon_speed = payload.weapon_speed
    item.weapon_requirement = payload.weapon_requirement
    item.weapon_npc = npc.name if npc is not None else payload.weapon_npc
    item.weapon_npc_id = npc.id if npc is not None else None
    item.weapon_type = payload.weapon_type
    item.weapon_base_damage = payload.weapon_base_damage
    item.weapon_special_ability = payload.weapon_special_ability
    item.weapon_knockback_distance = payload.weapon_knockback_distance
    item.max_stack = payload.max_stack
    item.cast_village_id = payload.cast_village_id
    item.mob_type = payload.mob_type
    item.item_type = payload.item_type
    item.status = payload.status

    # slug pode mudar, mas precisa continuar unico.
    if payload.slug != item.slug:
        existing = await db.execute(select(ContentItem).where(ContentItem.slug == payload.slug))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"An entry with the slug '{payload.slug}' already exists")
        item.slug = payload.slug

    item.attributes.clear()
    for i, attr in enumerate(payload.attributes):
        item.attributes.append(ContentItemAttribute(label=attr.label, value=attr.value, sort_order=i))
    item.attacks.clear()
    for i, attack in enumerate(payload.attacks):
        item.attacks.append(ContentItemAttack(name=jutsu_names.get(attack.jutsu_id, attack.name.strip()), jutsu_id=attack.jutsu_id or None, sort_order=i))
    item.drops.clear()
    for drop in payload.drops:
        item.drops.append(ContentItemDrop(
            item_name=drop.item_name, rarity=_rarity_of_drop(drop, linked_rarities), chance=drop.chance,
            chance_qualifier=drop.chance_qualifier, min_qty=drop.min_qty, max_qty=drop.max_qty,
            dropped_item_id=drop.dropped_item_id,
        ))

    human_touched = any(getattr(item, pt) != previous_pt[pt] for pt in previous_pt)   # alguem escreveu/corrigiu o portugues nesta edicao
    filled = await _fill_missing_translations(item)
    if human_touched:
        item.translation_auto = False
    elif filled:
        item.translation_auto = True

    await db.commit()
    await _prune_versions(item.id, db)

    after = {"name": item.name, "status": item.status.value}
    await log_action(db, actor=staff, action="update", entity_type="content_item", entity_id=str(item.id),
                      diff={"before": before, "after": after})
    await db.commit()
    # Re-busca (em vez de so' db.refresh) pelo mesmo motivo do create:
    # db.refresh(attribute_names=[...]) so' recarregaria o proprio
    # `drops`, nao o `dropped_item` ANINHADO dentro de cada drop -
    # sem re-buscar assim, a resposta poderia devolver
    # dropped_item_slug desatualizado ou ausente pra' drops que
    # acabaram de ganhar/trocar de dropped_item_id nesta mesma edicao.
    return await _get_item_or_404(item.id, db)


MAX_VERSIONS_PER_ITEM = 25   # versoes anteriores guardadas por entry (as mais antigas somem sozinhas)


async def _prune_versions(item_id: UUID, db: AsyncSession) -> None:
    """Mantem so' as MAX_VERSIONS_PER_ITEM versoes mais novas da entry."""
    old_ids = (await db.execute(
        select(ContentVersion.id).where(ContentVersion.content_item_id == item_id)
        .order_by(ContentVersion.created_at.desc()).offset(MAX_VERSIONS_PER_ITEM)
    )).scalars().all()
    if old_ids:
        await db.execute(delete(ContentVersion).where(ContentVersion.id.in_(old_ids)))
        await db.commit()


@router.get("/{item_id}/versions", response_model=list[ContentVersionRead])
async def list_versions(
    item_id: UUID, staff: User = Depends(require_permission(Permission.CONTENT_EDIT)), db: AsyncSession = Depends(get_db),
):
    """Historico da entry: versoes anteriores, da mais nova para a mais antiga."""
    await _get_item_or_404(item_id, db)
    rows = (await db.execute(
        select(ContentVersion).where(ContentVersion.content_item_id == item_id).order_by(ContentVersion.created_at.desc())
    )).scalars().all()
    return [ContentVersionRead(id=v.id, created_at=v.created_at, saved_by=v.saved_by,
                               name=str(v.snapshot.get("name", "")), status=str(v.snapshot.get("status", ""))) for v in rows]


@router.post("/{item_id}/versions/{version_id}/restore", response_model=ContentItemRead)
async def restore_version(
    item_id: UUID, version_id: UUID,
    staff: User = Depends(require_permission(Permission.CONTENT_EDIT)), db: AsyncSession = Depends(get_db),
):
    """
    Volta a entry para uma versao anterior, pela MESMA edicao do painel (mesmas regras de permissao e de rascunho/publicado).
    O estado de antes da restauracao tambem vai para o historico, entao da' para desfazer a restauracao.
    """
    version = await db.get(ContentVersion, version_id)
    if version is None or version.content_item_id != item_id:
        raise HTTPException(status_code=404, detail="Version not found")
    try:
        payload = ContentItemUpdate.model_validate(version.snapshot)
    except ValueError:
        raise HTTPException(status_code=422, detail="This version can no longer be restored")
    return await update_content_item(item_id, payload, staff, db)


@router.post("/{item_id}/retranslate", response_model=ContentItemRead)
async def retranslate_content_item(
    item_id: UUID,
    staff: User = Depends(require_permission(Permission.TRANSLATION_RETRANSLATE)),
    db: AsyncSession = Depends(get_db),
):
    """
    Forca uma traducao NOVA em TODOS os campos traduziveis, mesmo os
    que ja' tem algum "_pt" preenchido - diferente do preenchimento
    automatico do create/update (que so' toca em campo vazio), essa
    rota e' pra' quando a pessoa CONSCIENTEMENTE quer substituir a
    traducao atual (ex: mudou bastante o texto em ingles e quer
    recomecar do zero em portugues). O botao "Retraduzir" no editor chama
    essa rota, sempre com uma confirmacao antes no front - sobrescreve
    sem perguntar aqui no backend, a certeza tem que vir de quem chamou.
    """
    item = await _get_item_or_404(item_id, db)
    _guard_edit(staff, item, None)
    for field_en, field_pt in _TRANSLATABLE_FIELDS:
        translated = await translate_field(getattr(item, field_en))
        if translated:
            setattr(item, field_pt, translated)
            item.translation_auto = True   # retraduzir sobrescreve com a traducao automatica
    await db.commit()
    return await _get_item_or_404(item.id, db)


@router.delete("/{item_id}", status_code=204)
async def delete_content_item(
    item_id: UUID,
    staff: User = Depends(require_permission(Permission.CONTENT_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga a entry (e, em cascata, seus attributes/drops - ver ondelete='CASCADE' no modelo)."""
    item = await _get_item_or_404(item_id, db)
    deleted_name = item.name
    await db.delete(item)
    await log_action(db, actor=staff, action="delete", entity_type="content_item", entity_id=str(item_id),
                      diff={"name": deleted_name})
    await db.commit()


def _hide_draft_from_public(item: ContentItem, user: User | None) -> None:
    """Rascunho e' invisivel pra' quem nao e' da equipe: responde 404, como se nao existisse."""
    if user is None and item.status != ContentStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Entry not found")


def _guard_publish(staff: User, new_status: ContentStatus) -> None:
    """Quem nao tem CONTENT_PUBLISH (Creator) nao coloca nada no ar."""
    guard_publish(staff, Permission.CONTENT_PUBLISH, new_status)


def _guard_edit(staff: User, item: ContentItem, new_status: ContentStatus | None) -> None:
    """
    Creator so' mexe em RASCUNHO: uma entry publicada e' a pagina ao vivo do
    site e so' Adm/S.Adm alteram. (Ver Permission.CONTENT_PUBLISH em
    app/core/permissions.py - a regra segue a permissao, nao o nome do cargo.)
    """
    guard_edit(staff, Permission.CONTENT_PUBLISH, item.status, new_status,
               "This entry is already published. Only an Adm can change it.")


async def _get_item_or_404(item_id: UUID, db: AsyncSession) -> ContentItem:
    """
    Helper compartilhado pelos 3 endpoints que operam em UMA entry
    (get/put/delete) - evita repetir a mesma query+checagem 3 vezes.
    selectinload: carrega attributes/drops numa segunda query eficiente
    (em vez de N+1 queries, uma por atributo/drop). O segundo
    selectinload encadeado (.dropped_item) carrega, pra cada drop, o
    ContentItem que ele aponta (quando aponta pra algum) - e' o que o
    DropEntryRead.dropped_item_slug (ver schemas/content.py) precisa
    pra' calcular o link.
    """
    stmt = (
        select(ContentItem)
        .where(ContentItem.id == item_id)
        .options(
            selectinload(ContentItem.attributes),
            selectinload(ContentItem.attacks),
            selectinload(ContentItem.cast_village),
            selectinload(ContentItem.drops).selectinload(ContentItemDrop.dropped_item),
        )
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return item
