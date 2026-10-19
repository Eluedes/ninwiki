"""
Endpoints de leitura dos "extras" de Guia: Profissoes, Ranks Ninja,
Story Arcs e Summons - cada um e' uma lista pequena e fixa, sem
detalhe/edicao por enquanto (so' leitura, ver aviso em
app/schemas/guide.py).

Rotas:
  GET /professions   lista as profissoes (coleta + criacao)
  GET /professions/{profession_id}   uma proficiencia com todos os detalhes (pagina /proficiencies/[id] do site)
  POST/PUT/DELETE /professions...   edicao no painel (exige lore.edit / lore.delete); as receitas e recursos vem do importador
  GET /guide-articles, GET /guide-articles/{id}   artigos do Guia (rascunho so' para a equipe)
  POST/PUT/DELETE /guide-articles...   edicao no painel (exige lore.edit / lore.delete)
  GET /ninja-ranks   lista os ranks, em ordem de hierarquia
  GET /story-arcs    lista os arcos de historia
  GET /summons       lista as invocacoes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import get_optional_user, require_permission
from app.core.database import get_db
from app.core.payloads import apply_scalar_fields
from app.core.permissions import Permission
from app.core.translation import fill_missing_translations
from app.models.enums import ContentStatus
from app.models.guide import GuideArticle, NinjaRank, Profession, StoryArc, Summon
from app.models.users import User
from app.schemas.guide import (
    GuideArticleRead, GuideArticleWrite, NinjaRankRead, ProfessionRead, ProfessionWrite, StoryArcRead, SummonRead,
)

router = APIRouter(tags=["guide"])


@router.get("/professions", response_model=list[ProfessionRead])
async def list_professions(db: AsyncSession = Depends(get_db)):
    """Lista as profissoes (aba do Guia)."""
    result = await db.execute(select(Profession).order_by(Profession.name))
    return result.scalars().all()


@router.get("/professions/{profession_id}", response_model=ProfessionRead)
async def get_profession(profession_id: str, db: AsyncSession = Depends(get_db)):
    """Uma profissao (com os detalhes: recursos, receitas e ferramentas) - 404 se nao existe."""
    profession = await db.get(Profession, profession_id)
    if profession is None:
        raise HTTPException(status_code=404, detail="Profession not found")
    return profession


@router.get("/ninja-ranks", response_model=list[NinjaRankRead])
async def list_ninja_ranks(db: AsyncSession = Depends(get_db)):
    """Lista os ranks ninja (aba do Guia)."""
    result = await db.execute(select(NinjaRank).order_by(NinjaRank.order))
    return result.scalars().all()


@router.get("/story-arcs", response_model=list[StoryArcRead])
async def list_story_arcs(db: AsyncSession = Depends(get_db)):
    """Lista os arcos de historia (aba do Guia)."""
    result = await db.execute(select(StoryArc).order_by(StoryArc.name))
    return result.scalars().all()


@router.get("/summons", response_model=list[SummonRead])
async def list_summons(db: AsyncSession = Depends(get_db)):
    """Lista as invocacoes/summons (aba do Guia)."""
    result = await db.execute(select(Summon).order_by(Summon.name))
    return result.scalars().all()


# ---------------- proficiencias: edicao no painel ----------------

PROFESSION_TRANSLATABLE = [("name", "name_pt"), ("description", "description_pt")]


@router.post("/professions", response_model=ProfessionRead, status_code=201)
async def create_profession(
    payload: ProfessionWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Cria uma proficiencia (exige lore.edit). Receitas, recursos e ferramentas entram pelo importador."""
    if await db.get(Profession, payload.id) is not None:
        raise HTTPException(status_code=409, detail=f"A profession with the id '{payload.id}' already exists")
    profession = Profession(**payload.model_dump())
    await fill_missing_translations(profession, PROFESSION_TRANSLATABLE)
    db.add(profession)
    await log_action(db, action="create", entity_type="profession", entity_id=profession.id, diff={"name": profession.name}, actor=staff)
    await db.commit()
    await db.refresh(profession)
    return profession


@router.put("/professions/{profession_id}", response_model=ProfessionRead)
async def update_profession(
    profession_id: str,
    payload: ProfessionWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Edita uma proficiencia (os `details` ficam como estao)."""
    profession = await db.get(Profession, profession_id)
    if profession is None:
        raise HTTPException(status_code=404, detail="Profession not found")
    if payload.id != profession_id:
        raise HTTPException(status_code=400, detail="The profession id cannot be changed")
    before = {"name": profession.name}
    apply_scalar_fields(profession, payload, exclude={"id"})
    await fill_missing_translations(profession, PROFESSION_TRANSLATABLE)
    await log_action(db, action="update", entity_type="profession", entity_id=profession_id,
                     diff={"before": before, "after": {"name": profession.name}}, actor=staff)
    await db.commit()
    await db.refresh(profession)
    return profession


@router.delete("/professions/{profession_id}", status_code=204)
async def delete_profession(
    profession_id: str,
    staff: User = Depends(require_permission(Permission.LORE_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga uma proficiencia (exige lore.delete)."""
    profession = await db.get(Profession, profession_id)
    if profession is None:
        raise HTTPException(status_code=404, detail="Profession not found")
    name = profession.name
    await db.delete(profession)
    await log_action(db, action="delete", entity_type="profession", entity_id=profession_id, diff={"name": name}, actor=staff)
    await db.commit()


# ---------------- artigos do Guia ----------------

ARTICLE_TRANSLATABLE = [("title", "title_pt"), ("summary", "summary_pt"), ("body", "body_pt")]


@router.get("/guide-articles", response_model=list[GuideArticleRead])
async def list_guide_articles(
    section: str | None = Query(None, description="So' os artigos de uma secao"),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista os artigos do Guia em ordem (publico; rascunho so' aparece para a equipe)."""
    stmt = select(GuideArticle).order_by(GuideArticle.section, GuideArticle.position, GuideArticle.title)
    if section:
        stmt = stmt.where(GuideArticle.section == section)
    if user is None:
        stmt = stmt.where(GuideArticle.status == ContentStatus.PUBLISHED)
    return (await db.execute(stmt)).scalars().all()


@router.get("/guide-articles/{article_id}", response_model=GuideArticleRead)
async def get_guide_article(article_id: str, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    """Um artigo do Guia (publico; rascunho responde 404 para o visitante)."""
    article = await db.get(GuideArticle, article_id)
    if article is None or (user is None and article.status != ContentStatus.PUBLISHED):
        raise HTTPException(status_code=404, detail="Guide article not found")
    return article


@router.post("/guide-articles", response_model=GuideArticleRead, status_code=201)
async def create_guide_article(
    payload: GuideArticleWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Cria um artigo do Guia (exige lore.edit)."""
    if await db.get(GuideArticle, payload.id) is not None:
        raise HTTPException(status_code=409, detail=f"A guide article with the id '{payload.id}' already exists")
    article = GuideArticle(**payload.model_dump())
    await fill_missing_translations(article, ARTICLE_TRANSLATABLE)
    db.add(article)
    await log_action(db, action="create", entity_type="guide_article", entity_id=article.id,
                     diff={"title": article.title, "section": article.section}, actor=staff)
    await db.commit()
    await db.refresh(article)
    return article


@router.put("/guide-articles/{article_id}", response_model=GuideArticleRead)
async def update_guide_article(
    article_id: str,
    payload: GuideArticleWrite,
    staff: User = Depends(require_permission(Permission.LORE_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Edita um artigo do Guia."""
    article = await db.get(GuideArticle, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Guide article not found")
    if payload.id != article_id:
        raise HTTPException(status_code=400, detail="The article id cannot be changed")
    before = {"title": article.title, "status": article.status.value}
    apply_scalar_fields(article, payload, exclude={"id"})
    await fill_missing_translations(article, ARTICLE_TRANSLATABLE)
    await log_action(db, action="update", entity_type="guide_article", entity_id=article_id,
                     diff={"before": before, "after": {"title": article.title, "status": article.status.value}}, actor=staff)
    await db.commit()
    await db.refresh(article)
    return article


@router.delete("/guide-articles/{article_id}", status_code=204)
async def delete_guide_article(
    article_id: str,
    staff: User = Depends(require_permission(Permission.LORE_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga um artigo do Guia (exige lore.delete)."""
    article = await db.get(GuideArticle, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Guide article not found")
    title = article.title
    await db.delete(article)
    await log_action(db, action="delete", entity_type="guide_article", entity_id=article_id, diff={"title": title}, actor=staff)
    await db.commit()
