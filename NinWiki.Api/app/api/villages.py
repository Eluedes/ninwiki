"""
Vilas, Clas e Organizacoes.

Leitura (publica, o site usa):
  GET /villages, GET /villages/{id}      vilas com clas/organizacoes aninhados
  GET /organizations                     organizacoes + em quais vilas atuam
Escrita (painel - exige permissao de Lore: lore.edit / lore.delete):
  POST /villages, PUT /villages/{id}, DELETE /villages/{id}
  POST /organizations, PUT /organizations/{id}, DELETE /organizations/{id}

Os CLAS sao editados JUNTO com a vila (a lista enviada no PUT substitui a atual,
mesmo padrao de attributes/drops em content_items): clan so' existe dentro de uma
vila e nao tem pagina propria. Ja' a ligacao Organizacao <-> Vila (N:N) e' editada
do lado da ORGANIZACAO (village_ids), pra ter uma unica fonte de verdade.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.payloads import apply_scalar_fields
from app.core.translation import fill_missing_translations, retranslate_fields
from app.core.permissions import Permission
from app.models.users import User
from app.models.villages import Clan, Organization, OrganizationVillage, Village
from app.schemas.villages import (
    ClanWrite, OrganizationAdminRead, OrganizationWrite, VillageRead, VillageWrite,
)

router = APIRouter(prefix="/villages", tags=["villages"])
organizations_router = APIRouter(prefix="/organizations", tags=["organizations"])

# Pares (campo EN, campo PT) que a DeepL traduz sozinha. Os campos sem sufixo sao o INGLES (principal).
VILLAGE_TRANSLATABLE = [("motto", "motto_pt"), ("description", "description_pt"),
                        ("long_description", "long_description_pt"), ("climate", "climate_pt")]
CLAN_TRANSLATABLE = [("name", "name_pt"), ("description", "description_pt")]
ORG_TRANSLATABLE = [("name", "name_pt"), ("description", "description_pt")]


async def _translate_village(village: Village, force: bool = False) -> None:
    """Traduz EN -> PT os textos da vila e de cada cla' (so' o que esta' vazio; force=True refaz tudo)."""
    fn = retranslate_fields if force else fill_missing_translations
    await fn(village, VILLAGE_TRANSLATABLE)
    for clan in village.clans:
        await fn(clan, CLAN_TRANSLATABLE)


_WITH_RELATIONS = (selectinload(Village.clans), selectinload(Village.organizations))


async def _load_village(db: AsyncSession, village_id: str) -> Village | None:
    """Carrega uma vila com cla's e organizacoes ja' prontos (necessario no SQLAlchemy async)."""
    # clans/organizations PRECISAM vir carregados (selectinload): em SQLAlchemy async,
    # apagar/editar uma vila que carrega essas listas "sob demanda" da erro.
    stmt = select(Village).where(Village.id == village_id).options(*_WITH_RELATIONS)
    return (await db.execute(stmt)).scalar_one_or_none()


# ---------------- vilas: leitura ----------------

@router.get("", response_model=list[VillageRead])
async def list_villages(db: AsyncSession = Depends(get_db)):
    """Lista as vilas com cla's e organizacoes (publico)."""
    stmt = select(Village).options(*_WITH_RELATIONS).order_by(Village.name)
    return (await db.execute(stmt)).scalars().all()


@router.get("/{village_id}", response_model=VillageRead)
async def get_village(village_id: str, db: AsyncSession = Depends(get_db)):
    """Ficha de UMA vila (publico)."""
    village = await _load_village(db, village_id)
    if village is None:
        raise HTTPException(status_code=404, detail="Village not found")
    return village


# ---------------- vilas: escrita ----------------

async def _sync_clans(db: AsyncSession, village: Village, clans: list[ClanWrite]) -> None:
    """Deixa a lista de clas da vila IGUAL a' enviada: atualiza os que ja' existem, cria os novos, remove os que sumiram."""
    ids = [c.id for c in clans]
    if ids:
        rows = (await db.execute(select(Clan.id, Clan.village_id).where(Clan.id.in_(ids)))).all()
        for clan_id, owner in rows:
            if owner != village.id:
                raise HTTPException(status_code=409, detail=f"The clan '{clan_id}' already belongs to another village")
    existing = {c.id: c for c in village.clans}
    for c in clans:
        if c.id in existing:
            apply_scalar_fields(existing[c.id], c, exclude={"id"})
        else:
            village.clans.append(Clan(village_id=village.id, **c.model_dump()))
    keep = set(ids)
    for clan_id, clan in existing.items():
        if clan_id not in keep:
            village.clans.remove(clan)  # delete-orphan: apaga do banco


@router.post("", response_model=VillageRead, status_code=201)
async def create_village(
    payload: VillageWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Cria uma vila com seus cla's (exige lore.edit)."""
    if await db.get(Village, payload.id) is not None:
        raise HTTPException(status_code=409, detail=f"A village with the id '{payload.id}' already exists")
    village = Village(**payload.model_dump(exclude={"clans"}))
    db.add(village)
    await db.flush()
    await db.refresh(village, attribute_names=["clans"])
    await _sync_clans(db, village, payload.clans)
    await _translate_village(village)
    await log_action(db, action="create", entity_type="village", entity_id=village.id,
                     diff={"name": village.name, "clans": len(payload.clans)}, actor=staff)
    await db.commit()
    return await _load_village(db, village.id)


@router.put("/{village_id}", response_model=VillageRead)
async def update_village(
    village_id: str,
    payload: VillageWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Edita a vila; a lista de cla's enviada substitui a atual."""
    village = await _load_village(db, village_id)
    if village is None:
        raise HTTPException(status_code=404, detail="Village not found")
    if payload.id != village_id:
        raise HTTPException(status_code=400, detail="The village id cannot be changed")
    before = {"name": village.name}
    apply_scalar_fields(village, payload, exclude={"id", "clans"})
    await _sync_clans(db, village, payload.clans)
    await _translate_village(village)
    await log_action(db, action="update", entity_type="village", entity_id=village.id,
                     diff={"before": before, "after": {"name": village.name}, "clans": len(payload.clans)}, actor=staff)
    await db.commit()
    db.expire_all()
    return await _load_village(db, village_id)


@router.post("/{village_id}/retranslate", response_model=VillageRead)
async def retranslate_village(
    village_id: str,
    staff: User = Depends(require_permission(Permission.LORE_EDIT, Permission.TRANSLATION_RETRANSLATE)),
    db: AsyncSession = Depends(get_db),
):
    """Forca a traducao nova (EN -> PT) dos textos da vila e dos cla's - para quando o ingles mudou."""
    village = await _load_village(db, village_id)
    if village is None:
        raise HTTPException(status_code=404, detail="Village not found")
    await _translate_village(village, force=True)
    await db.commit()
    db.expire_all()
    return await _load_village(db, village_id)


@router.delete("/{village_id}", status_code=204)
async def delete_village(
    village_id: str,
    staff: User = Depends(require_permission(Permission.LORE_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga a vila (e seus cla's) - exige lore.delete."""
    village = await _load_village(db, village_id)
    if village is None:
        raise HTTPException(status_code=404, detail="Village not found")
    name = village.name
    await db.delete(village)  # clas vao junto (cascade); entries que usavam a vila ficam sem vila (SET NULL)
    await log_action(db, action="delete", entity_type="village", entity_id=village_id, diff={"name": name}, actor=staff)
    await db.commit()


# ---------------- organizacoes ----------------

async def _org_read(db: AsyncSession, org: Organization) -> OrganizationAdminRead:
    """Converte uma organizacao na versao do painel, com as vilas em que atua."""
    rows = (await db.execute(
        select(OrganizationVillage.village_id).where(OrganizationVillage.organization_id == org.id)
    )).scalars().all()
    return OrganizationAdminRead(id=org.id, name=org.name, description=org.description, name_pt=org.name_pt,
                                 description_pt=org.description_pt, village_ids=sorted(rows))


async def _set_org_villages(db: AsyncSession, org_id: str, village_ids: list[str]) -> None:
    """Deixa as vilas de uma organizacao IGUAIS a' lista enviada (valida que existem)."""
    if village_ids:
        found = set((await db.execute(select(Village.id).where(Village.id.in_(village_ids)))).scalars())
        missing = [v for v in village_ids if v not in found]
        if missing:
            raise HTTPException(status_code=400, detail=f"Village(s) do not exist: {', '.join(missing)}")
    await db.execute(delete(OrganizationVillage).where(OrganizationVillage.organization_id == org_id))
    for vid in village_ids:
        db.add(OrganizationVillage(organization_id=org_id, village_id=vid))


@organizations_router.get("", response_model=list[OrganizationAdminRead])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """Lista as organizacoes e em quais vilas atuam (publico)."""
    orgs = (await db.execute(select(Organization).order_by(Organization.name))).scalars().all()
    links = (await db.execute(select(OrganizationVillage))).scalars().all()
    by_org: dict[str, list[str]] = {}
    for link in links:
        by_org.setdefault(link.organization_id, []).append(link.village_id)
    return [
        OrganizationAdminRead(id=o.id, name=o.name, description=o.description, name_pt=o.name_pt,
                              description_pt=o.description_pt, village_ids=sorted(by_org.get(o.id, [])))
        for o in orgs
    ]


@organizations_router.post("", response_model=OrganizationAdminRead, status_code=201)
async def create_organization(
    payload: OrganizationWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Cria uma organizacao e liga as vilas (exige lore.edit)."""
    if await db.get(Organization, payload.id) is not None:
        raise HTTPException(status_code=409, detail=f"An organization with the id '{payload.id}' already exists")
    org = Organization(id=payload.id, name=payload.name, description=payload.description,
                       name_pt=payload.name_pt, description_pt=payload.description_pt)
    db.add(org)
    await fill_missing_translations(org, ORG_TRANSLATABLE)  # DeepL EN -> PT (so' o que veio vazio)
    await db.flush()
    await _set_org_villages(db, org.id, payload.village_ids)
    await log_action(db, action="create", entity_type="organization", entity_id=org.id,
                     diff={"name": org.name, "villages": payload.village_ids}, actor=staff)
    await db.commit()
    return await _org_read(db, org)


@organizations_router.put("/{org_id}", response_model=OrganizationAdminRead)
async def update_organization(
    org_id: str,
    payload: OrganizationWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Edita uma organizacao e suas vilas."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    if payload.id != org_id:
        raise HTTPException(status_code=400, detail="The organization id cannot be changed")
    before = {"name": org.name}
    org.name = payload.name
    org.description = payload.description
    org.name_pt = payload.name_pt
    org.description_pt = payload.description_pt
    await fill_missing_translations(org, ORG_TRANSLATABLE)  # DeepL EN -> PT (so' o que ficou vazio)
    await _set_org_villages(db, org.id, payload.village_ids)
    await log_action(db, action="update", entity_type="organization", entity_id=org.id,
                     diff={"before": before, "after": {"name": org.name}, "villages": payload.village_ids}, actor=staff)
    await db.commit()
    return await _org_read(db, org)


@organizations_router.post("/{org_id}/retranslate", response_model=OrganizationAdminRead)
async def retranslate_organization(
    org_id: str,
    staff: User = Depends(require_permission(Permission.LORE_EDIT, Permission.TRANSLATION_RETRANSLATE)),
    db: AsyncSession = Depends(get_db),
):
    """Forca a traducao nova (EN -> PT) de nome e descricao da organizacao."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    await retranslate_fields(org, ORG_TRANSLATABLE)
    await db.commit()
    return await _org_read(db, org)


@organizations_router.delete("/{org_id}", status_code=204)
async def delete_organization(
    org_id: str,
    staff: User = Depends(require_permission(Permission.LORE_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga uma organizacao (exige lore.delete)."""
    org = await db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    name = org.name
    await db.delete(org)  # as ligacoes com vilas somem pelo ON DELETE CASCADE do banco
    await log_action(db, action="delete", entity_type="organization", entity_id=org_id, diff={"name": name}, actor=staff)
    await db.commit()
