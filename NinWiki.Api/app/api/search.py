"""
Busca para as @mencoes do editor de posts.

  GET /search/mentions?q=texto   ate' 8 itens/masteries cujo nome comeca ou contem o texto   posts.create

So' equipe (quem escreve posts) usa; devolve apenas o necessario para montar o link: {id, label, href, kind}.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.content import ContentItem
from app.models.enums import ContentStatus
from app.models.masteries import Mastery
from app.models.users import User

router = APIRouter(prefix="/search", tags=["search"])


def _like(q: str) -> str:
    """Escapa % e _ para o texto digitado nao virar curinga do LIKE."""
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


@router.get("/mentions")
async def search_mentions(
    q: str = Query("", max_length=60),
    staff: User = Depends(require_permission(Permission.POST_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Procura itens/mobs/etc. publicados e masteries pelo nome (para o '@' do editor)."""
    q = q.strip()
    if not q:
        return []
    items = (await db.execute(
        select(ContentItem.slug, ContentItem.name, ContentItem.category)
        .where(ContentItem.status == ContentStatus.PUBLISHED, ContentItem.name.ilike(_like(q), escape="\\"))
        .order_by(ContentItem.name).limit(6))).all()
    masteries = (await db.execute(
        select(Mastery.id, Mastery.name).where(Mastery.name.ilike(_like(q), escape="\\")).order_by(Mastery.name).limit(3))).all()
    out = [{"id": f"item:{s}", "label": n, "href": f"/detail/{s}", "kind": c.value} for s, n, c in items]
    out += [{"id": f"mastery:{i}", "label": n, "href": f"/masteries/{i}", "kind": "mastery"} for i, n in masteries]
    return out[:8]
