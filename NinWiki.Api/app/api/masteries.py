"""
Endpoints REST de Masteries (leitura + edicao do conteudo) e Jutsus (CRUD completo).

Rotas:
  GET    /masteries                lista as 8 masteries, com paths aninhados
  GET    /masteries/{id}           ficha completa de uma mastery
  PUT    /masteries/{id}           edita o CONTEUDO de uma mastery (textos, icone, cor,
                                    atributos ligados, e a lista de Paths inteira)
  GET    /attributes                lista os 5 atributos do personagem (so' leitura)
  GET    /jutsus                   lista jutsus (filtro opcional ?masteryId=)
  GET    /jutsus/{id}              ficha completa de um jutsu
  POST   /jutsus                   cria um jutsu novo
  PUT    /jutsus/{id}              atualiza um jutsu
  DELETE /jutsus/{id}              apaga um jutsu
  POST   /jutsus/bulk-delete       apaga VARIOS jutsus de uma vez

Mesmo aviso de sempre: sem autenticacao ainda (Fase 2) - so' seguro
rodar localmente por enquanto.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.permissions import Permission
from app.core.media_refs import resolve_images
from app.core.database import get_db
from app.models.users import User
from app.core.payloads import apply_scalar_fields
from app.core.translation import fill_missing_translations, translate_field
from app.models.masteries import Attribute, Jutsu, Mastery, MasteryPath
from app.schemas.content import CamelModel
from app.schemas.masteries import AttributeRead, JutsuRead, JutsuWrite, MasteryRead, MasteryWrite

router = APIRouter(tags=["masteries"])


class JutsuBulkDelete(CamelModel):
    """Corpo de apagar varios jutsus de uma vez (lista de ids)."""
    ids: list[str] = Field(min_length=1)


@router.post("/jutsus/bulk-delete", status_code=204)
async def bulk_delete_jutsus(payload: JutsuBulkDelete, staff: User = Depends(require_permission(Permission.LORE_DELETE)), db: AsyncSession = Depends(get_db)):
    """
    Apaga VARIOS jutsus de uma vez - usado pelo botão "Apagar
    selecionados" da tabela de Jutsus no painel. Ficando ANTES de
    "/jutsus/{jutsu_id}" no arquivo por segurança (ver o mesmo aviso
    em app/api/content_items.py::bulk_update_status).
    """
    stmt = select(Jutsu).where(Jutsu.id.in_(payload.ids))
    result = await db.execute(stmt)
    jutsus = result.scalars().all()

    for jutsu in jutsus:
        await db.delete(jutsu)

    await log_action(db, actor=staff, action="bulk-delete", entity_type="jutsu", entity_id=f"{len(jutsus)} itens",
                      diff={"ids": payload.ids})
    await db.commit()


@router.get("/attributes", response_model=list[AttributeRead])
async def list_attributes(db: AsyncSession = Depends(get_db)):
    """Os 5 atributos fixos do personagem - usado pelo editor de Mastery pra montar o multi-select."""
    stmt = select(Attribute).order_by(Attribute.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/masteries", response_model=list[MasteryRead])
async def list_masteries(db: AsyncSession = Depends(get_db)):
    """Lista as masteries com seus caminhos (publico)."""
    stmt = select(Mastery).options(selectinload(Mastery.paths), selectinload(Mastery.attributes)).order_by(Mastery.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/masteries/{mastery_id}", response_model=MasteryRead)
async def get_mastery(mastery_id: str, db: AsyncSession = Depends(get_db)):
    """Ficha de UMA mastery (publico)."""
    stmt = (
        select(Mastery)
        .where(Mastery.id == mastery_id)
        .options(selectinload(Mastery.paths), selectinload(Mastery.attributes))
    )
    result = await db.execute(stmt)
    mastery = result.scalar_one_or_none()
    if mastery is None:
        raise HTTPException(status_code=404, detail="Mastery not found")
    return mastery


@router.put("/masteries/{mastery_id}", response_model=MasteryRead)
async def update_mastery(mastery_id: str, payload: MasteryWrite, staff: User = Depends(require_permission(Permission.LORE_EDIT)), db: AsyncSession = Depends(get_db)):
    """
    Edita o CONTEUDO de uma mastery - id/type/element continuam fixos
    de proposito (sao a identidade do elemento do jogo em si), mas
    todo o resto e' editavel, incluindo os Paths aninhados.

    Paths: mesma logica de "substituir a lista inteira" que
    attributes/drops ja usam em content_items - compara os ids que
    vieram no payload contra os que ja existem no banco:
      - id que ja existia E veio de novo -> atualiza os campos
      - id que ja existia e NAO veio mais -> apaga (jutsus que
        apontavam pra esse path ficam com path_id=NULL sozinhos,
        via ON DELETE SET NULL - nao quebra o jutsu, so' desvincula)
      - id que NAO existia ainda -> cria um path novo
    """
    await resolve_images(db, payload)  # campos de imagem aceitam o ID do banco de imagens (img:12)
    stmt = (
        select(Mastery)
        .where(Mastery.id == mastery_id)
        .options(selectinload(Mastery.paths), selectinload(Mastery.attributes))
    )
    result = await db.execute(stmt)
    mastery = result.scalar_one_or_none()
    if mastery is None:
        raise HTTPException(status_code=404, detail="Mastery not found")

    before = {"name": mastery.name}

    # Campos "simples" (nome, descricoes, icone, cor, imagem, gif...):
    # copia TODOS automaticamente - ver app/core/payloads.py pro porque
    # (antes cada campo era escrito a mao aqui, e esquecer um deles
    # fazia o dado sumir em silencio ao salvar). attribute_ids e paths
    # sao relacionamentos e continuam tratados a mao logo abaixo.
    apply_scalar_fields(mastery, payload, exclude={"attribute_ids", "paths"})

    # Atributos ligados: confere que todo id mandado existe de verdade
    # antes de trocar a lista - um id invalido aqui falharia silencioso
    # (SQLAlchemy so' ignoraria) se nao checassemos.
    if payload.attribute_ids:
        attrs_result = await db.execute(select(Attribute).where(Attribute.id.in_(payload.attribute_ids)))
        attrs = attrs_result.scalars().all()
        if len(attrs) != len(set(payload.attribute_ids)):
            found_ids = {a.id for a in attrs}
            missing = set(payload.attribute_ids) - found_ids
            raise HTTPException(status_code=400, detail=f"Atributo(s) inexistente(s): {', '.join(missing)}")
        mastery.attributes = list(attrs)
    else:
        mastery.attributes = []

    # Paths: substitui a lista inteira, comparando ids como descrito
    # no docstring acima.
    existing_paths = {p.id: p for p in mastery.paths}
    incoming_ids = {p.id for p in payload.paths}

    for path_id, path in list(existing_paths.items()):
        if path_id not in incoming_ids:
            await db.delete(path)

    for path_payload in payload.paths:
        if path_payload.id in existing_paths:
            path = existing_paths[path_payload.id]
            path.label = path_payload.label
            path.description = path_payload.description
            path.requirement = path_payload.requirement
        else:
            # mastery.paths.append(...) em vez de db.add(...) direto: os
            # dois persistem igual no banco, mas so' o append mantem a
            # colecao EM MEMORIA sincronizada com o que acabou de ser
            # criado - sem isso, o reload "fresco" no final da funcao
            # (mesma sessao) reaproveita a lista antiga da selectinload
            # anterior e devolve a resposta sem o path que acabou de
            # nascer (o insert no banco acontece certo do mesmo jeito,
            # so' a resposta HTTP que fica errada ate' o proximo request).
            mastery.paths.append(MasteryPath(
                id=path_payload.id, mastery_id=mastery_id, label=path_payload.label,
                description=path_payload.description, requirement=path_payload.requirement,
            ))

    await fill_missing_translations(mastery, [("name", "name_pt"), ("description", "description_pt"), ("long_description", "long_description_pt")])

    await db.commit()
    await log_action(db, actor=staff, action="update", entity_type="mastery", entity_id=mastery_id,
                      diff={"before": before, "after": {"name": mastery.name}})
    await db.commit()

    # db.refresh(attribute_names=[...]) força reler ESSAS relações
    # direto do banco, mesmo que a colecao em memoria ja' pareça certa -
    # mais seguro que confiar so' no que foi montado a mao acima (mesmo
    # padrao usado em content_items.py depois de criar/editar uma entry).
    await db.refresh(mastery, attribute_names=["paths", "attributes"])
    return mastery


@router.post("/masteries/{mastery_id}/retranslate", response_model=MasteryRead)
async def retranslate_mastery(mastery_id: str, staff: User = Depends(require_permission(Permission.LORE_EDIT, Permission.TRANSLATION_RETRANSLATE)), db: AsyncSession = Depends(get_db)):
    """Forca traducao nova nos campos de texto - mesma ideia de POST /content-items/{id}/retranslate."""
    stmt = select(Mastery).where(Mastery.id == mastery_id).options(selectinload(Mastery.paths), selectinload(Mastery.attributes))
    result = await db.execute(stmt)
    mastery = result.scalar_one_or_none()
    if mastery is None:
        raise HTTPException(status_code=404, detail="Mastery not found")
    for field_en, field_pt in [("name", "name_pt"), ("description", "description_pt"), ("long_description", "long_description_pt")]:
        translated = await translate_field(getattr(mastery, field_en))
        if translated:
            setattr(mastery, field_pt, translated)
    await db.commit()
    await db.refresh(mastery, attribute_names=["paths", "attributes"])
    return mastery


@router.get("/jutsus", response_model=list[JutsuRead])
async def list_jutsus(
    mastery_id: str | None = Query(None, alias="masteryId", description="Filtra por mastery"),
    utility: bool = Query(False, description="So' os jutsus de Utilidade (sem mastery)"),
    db: AsyncSession = Depends(get_db),
):
    """Lista jutsus, opcionalmente so' os de uma mastery ou so' os de Utilidade (publico)."""
    stmt = select(Jutsu).order_by(Jutsu.name)
    if utility:
        stmt = stmt.where(Jutsu.mastery_id.is_(None))
    elif mastery_id:
        stmt = stmt.where(Jutsu.mastery_id == mastery_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/jutsus/{jutsu_id}", response_model=JutsuRead)
async def get_jutsu(jutsu_id: str, db: AsyncSession = Depends(get_db)):
    """Ficha de UM jutsu (publico)."""
    return await _get_jutsu_or_404(jutsu_id, db)


async def _translate_level_names(en: list[str], old_en: list[str], old_pt: list[str], given: list[str], force: bool = False) -> list[str]:
    """
    Traducao (PT) do nome por nivel, na mesma ordem de `en`. Para cada nivel com nome:
    1) valor digitado a mao (`given`) vale; 2) se o nome em ingles NAO mudou desde a ultima vez, mantem a traducao que ja' existe;
    3) senao pede a' DeepL (sem chave/falha = fica vazio e o site mostra o nome em ingles). `force` (botao Retraduzir) ignora 1 e 2.
    So' vazios = lista vazia.
    """
    out: list[str] = []
    for i, name in enumerate(en):
        if not name:
            out.append("")
        elif not force and i < len(given) and given[i]:
            out.append(given[i])
        elif not force and i < len(old_en) and old_en[i] == name and i < len(old_pt) and old_pt[i]:
            out.append(old_pt[i])
        else:
            out.append(await translate_field(name) or "")
    return out if any(out) else []


@router.post("/jutsus", response_model=JutsuRead, status_code=201)
async def create_jutsu(payload: JutsuWrite, staff: User = Depends(require_permission(Permission.LORE_EDIT)), db: AsyncSession = Depends(get_db)):
    """Cria um jutsu (exige lore.edit); valida mastery/caminho e registra no log."""
    await resolve_images(db, payload)  # campos de imagem aceitam o ID do banco de imagens (img:12)
    existing = await db.get(Jutsu, payload.id)
    if existing:
        raise HTTPException(status_code=409, detail=f"A jutsu with the id '{payload.id}' already exists")

    await _validate_mastery_and_path(payload, db)

    jutsu = Jutsu(**payload.model_dump())
    db.add(jutsu)
    await fill_missing_translations(jutsu, [("name", "name_pt"), ("description", "description_pt"), ("long_description", "long_description_pt")])
    jutsu.name_by_level_pt = await _translate_level_names(jutsu.name_by_level, [], [], payload.name_by_level_pt)
    await db.commit()
    await log_action(db, actor=staff, action="create", entity_type="jutsu", entity_id=jutsu.id, diff={"name": jutsu.name})
    await db.commit()
    await db.refresh(jutsu)
    return jutsu


@router.put("/jutsus/{jutsu_id}", response_model=JutsuRead)
async def update_jutsu(jutsu_id: str, payload: JutsuWrite, staff: User = Depends(require_permission(Permission.LORE_EDIT)), db: AsyncSession = Depends(get_db)):
    """Edita um jutsu (exige lore.edit); copia os campos do payload e registra no log."""
    await resolve_images(db, payload)  # campos de imagem aceitam o ID do banco de imagens (img:12)
    jutsu = await _get_jutsu_or_404(jutsu_id, db)
    if payload.id != jutsu_id:
        raise HTTPException(status_code=400, detail="Changing the id of an existing jutsu is not allowed")

    await _validate_mastery_and_path(payload, db)

    before_name = jutsu.name
    old_level_names, old_level_names_pt = list(jutsu.name_by_level or []), list(jutsu.name_by_level_pt or [])
    apply_scalar_fields(jutsu, payload)

    await fill_missing_translations(jutsu, [("name", "name_pt"), ("description", "description_pt"), ("long_description", "long_description_pt")])
    jutsu.name_by_level_pt = await _translate_level_names(jutsu.name_by_level, old_level_names, old_level_names_pt, payload.name_by_level_pt)

    await db.commit()
    await log_action(db, actor=staff, action="update", entity_type="jutsu", entity_id=jutsu_id,
                      diff={"before": {"name": before_name}, "after": {"name": jutsu.name}})
    await db.commit()
    await db.refresh(jutsu)
    return jutsu


@router.post("/jutsus/{jutsu_id}/retranslate", response_model=JutsuRead)
async def retranslate_jutsu(jutsu_id: str, staff: User = Depends(require_permission(Permission.LORE_EDIT, Permission.TRANSLATION_RETRANSLATE)), db: AsyncSession = Depends(get_db)):
    """Forca traducao nova nos campos de texto - mesma ideia de POST /content-items/{id}/retranslate."""
    jutsu = await _get_jutsu_or_404(jutsu_id, db)
    for field_en, field_pt in [("name", "name_pt"), ("description", "description_pt"), ("long_description", "long_description_pt")]:
        translated = await translate_field(getattr(jutsu, field_en))
        if translated:
            setattr(jutsu, field_pt, translated)
    translated_names = await _translate_level_names(jutsu.name_by_level, [], [], [], force=True)
    if translated_names:   # sem chave/falha da DeepL, a traducao que ja' existe e' preservada
        jutsu.name_by_level_pt = translated_names
    await db.commit()
    await db.refresh(jutsu)
    return jutsu


@router.delete("/jutsus/{jutsu_id}", status_code=204)
async def delete_jutsu(jutsu_id: str, staff: User = Depends(require_permission(Permission.LORE_DELETE)), db: AsyncSession = Depends(get_db)):
    """Apaga um jutsu (exige lore.delete) e registra no log."""
    jutsu = await _get_jutsu_or_404(jutsu_id, db)
    deleted_name = jutsu.name
    await db.delete(jutsu)
    await log_action(db, actor=staff, action="delete", entity_type="jutsu", entity_id=jutsu_id, diff={"name": deleted_name})
    await db.commit()


async def _get_jutsu_or_404(jutsu_id: str, db: AsyncSession) -> Jutsu:
    """Busca um jutsu pelo id ou responde 404."""
    jutsu = await db.get(Jutsu, jutsu_id)
    if jutsu is None:
        raise HTTPException(status_code=404, detail="Jutsu not found")
    return jutsu


async def _validate_mastery_and_path(payload: JutsuWrite, db: AsyncSession) -> None:
    """
    Confere que mastery_id existe de verdade (e, se path_id foi
    informado, que ele pertence A' MESMA mastery) antes de gravar -
    sem isso, um jutsu podia apontar pra' uma mastery/caminho inexistente
    e so' quebrar silenciosamente quando o front tentasse mostrar ele.
    """
    if payload.mastery_id is None:   # Utilidade: sem mastery, e' claro que tambem nao tem caminho
        if payload.path_id:
            raise HTTPException(status_code=400, detail="A Utility jutsu (no mastery) cannot have a path")
        return
    mastery = await db.get(Mastery, payload.mastery_id)
    if mastery is None:
        raise HTTPException(status_code=400, detail=f"Mastery '{payload.mastery_id}' does not exist")
    if payload.path_id:
        from app.models.masteries import MasteryPath
        path = await db.get(MasteryPath, payload.path_id)
        if path is None or path.mastery_id != payload.mastery_id:
            raise HTTPException(
                status_code=400,
                detail=f"Path '{payload.path_id}' does not exist or does not belong to the mastery '{payload.mastery_id}'",
            )
