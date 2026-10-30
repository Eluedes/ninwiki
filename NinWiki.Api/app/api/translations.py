"""
Importacao das traducoes OFICIAIS do jogo (arquivo "nin-online-translation" em Portugues) para os nossos registros.

  POST /translations/preview   mostra o que MUDARIA (nao grava nada): contagem por tipo + exemplos + nomes sem traducao oficial
  POST /translations/apply     grava (so' campos _pt) e registra no log de auditoria

Permissao translation.import (Adm e S.Adm por padrao). A logica esta em app/core/official_translations.py.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import official_translations as ot
from app.core.slug import slugify
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.content import ContentItem
from app.models.users import User
from app.schemas.translations import NewName, NewNamesRequest, NewNamesResult, TranslationBreakdown, TranslationImportRequest, TranslationImportResult, TranslationSample

router = APIRouter(prefix="/translations", tags=["translations"])
SAMPLES = 40
UNMATCHED_SHOWN = 25


def _index(body: TranslationImportRequest) -> dict[str, str]:
    """Valida o pedido (tamanho e idioma) e monta o dicionario normalizado."""
    if len(body.translations) > ot.MAX_ENTRIES:
        raise HTTPException(status_code=422, detail="Too many entries in the file")
    if body.language is not None and "portuguese" not in body.language.lower():
        raise HTTPException(status_code=422, detail=f"This is the '{body.language}' file. Send the Brazilian Portuguese file.")
    index = ot.build_index(body.translations)
    if not index:
        raise HTTPException(status_code=422, detail="The file has no usable translations")
    return index


def _result(plan: ot.Plan, entries: int, applied: bool) -> TranslationImportResult:
    """Resumo do plano para o painel."""
    per_entity: dict[str, int] = {}
    for ch in plan.changes:
        per_entity[ch.entity] = per_entity.get(ch.entity, 0) + 1
    breakdown = [TranslationBreakdown(entity=e, records=plan.records.get(e, 0), changes=per_entity.get(e, 0), unmatched=len(plan.unmatched.get(e, [])),
                                      unmatched_names=plan.unmatched.get(e, [])[:UNMATCHED_SHOWN]) for e, _, _ in ot.SPECS]
    clip = lambda v: None if v is None else (v if len(v) <= 300 else v[:299] + "…")   # noqa: E731
    samples = [TranslationSample(entity=c.entity, label=c.label, field=c.field, old=clip(c.old), new=clip(c.new)) for c in plan.changes[:SAMPLES]]
    return TranslationImportResult(dictionary_entries=entries, total_changes=len(plan.changes), applied=applied, breakdown=breakdown, samples=samples)


@router.post("/new-names", response_model=NewNamesResult)
async def new_names(
    body: NewNamesRequest, staff: User = Depends(require_permission(Permission.CONTENT_IMPORT)), db: AsyncSession = Depends(get_db),
):
    """
    Acha no arquivo em INGLES do jogo os textos que PARECEM nomes (ver looks_like_name) e que o wiki ainda nao tem - nem como
    rascunho criado pela importacao (compara o nome e tambem o slug), nem como conteudo, jutsu, mastery, vila, cla' ou organizacao.
    A pessoa escolhe quais viram rascunho (POST /content-items/bulk-import); se mandou o arquivo de Portugues, o nome oficial em PT vai junto.
    """
    if len(body.english) > ot.MAX_ENTRIES:
        raise HTTPException(status_code=422, detail="Too many entries in the file")
    pt_index = ot.build_index(body.portuguese or {})
    have = await ot.existing_names(db)
    slugs = set((await db.execute(select(ContentItem.slug))).scalars().all())
    found: dict[str, NewName] = {}
    name_like = 0
    for key in body.english:
        if not isinstance(key, str) or not ot.looks_like_name(key):
            continue
        name_like += 1
        n = ot.norm(key)
        if n in have or (slugify(key, fold_accents=False) or "item") in slugs or n in found:
            continue
        found[n] = NewName(name=key.strip(), name_pt=pt_index.get(n), hint=ot.name_hint(key))
    ordered = sorted(found.values(), key=lambda c: c.name.casefold())
    return NewNamesResult(total_strings=len(body.english), name_like=name_like, already_in_wiki=name_like - len(found), candidates=ordered[:5000], truncated=len(ordered) > 5000)


@router.post("/preview", response_model=TranslationImportResult)
async def preview_import(
    body: TranslationImportRequest, staff: User = Depends(require_permission(Permission.TRANSLATION_IMPORT)), db: AsyncSession = Depends(get_db),
):
    """Calcula o que mudaria (nada e' gravado)."""
    index = _index(body)
    plan = await ot.plan_import(db, index, body.overwrite)
    return _result(plan, len(index), applied=False)


@router.post("/apply", response_model=TranslationImportResult)
async def apply_import(
    body: TranslationImportRequest, staff: User = Depends(require_permission(Permission.TRANSLATION_IMPORT)), db: AsyncSession = Depends(get_db),
):
    """Grava as traducoes oficiais nos campos _pt e registra no log de auditoria."""
    index = _index(body)
    plan = await ot.plan_import(db, index, body.overwrite)
    result = _result(plan, len(index), applied=True)
    ot.apply_plan(plan)
    await log_action(db, action="import", entity_type="translation", entity_id="official",
                     diff={"changes": len(plan.changes), "overwrite": body.overwrite, "byType": {b.entity: b.changes for b in result.breakdown}}, actor=staff)
    await db.commit()
    return result
