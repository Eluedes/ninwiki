"""
Endpoints de leitura dos "extras" de Guia: Profissoes, Ranks Ninja,
Story Arcs e Summons - cada um e' uma lista pequena e fixa, sem
detalhe/edicao por enquanto (so' leitura, ver aviso em
app/schemas/guide.py).

Rotas:
  GET /professions   lista as profissoes (coleta + criacao)
  GET /professions/{profession_id}   uma profissao com todos os detalhes (pagina /profession/[id] do site)
  GET /ninja-ranks   lista os ranks, em ordem de hierarquia
  GET /story-arcs    lista os arcos de historia
  GET /summons       lista as invocacoes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.guide import NinjaRank, Profession, StoryArc, Summon
from app.schemas.guide import NinjaRankRead, ProfessionRead, StoryArcRead, SummonRead

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
