"""
Tags/categorias dos posts do blog.

  GET    /tags              lista com a contagem de posts PUBLICADOS (publico - alimenta o filtro do blog)
  POST   /tags              cria uma tag nova a partir do nome em ingles      posts.create
  DELETE /tags/{id}         apaga a tag (desfaz a ligacao com os posts)       posts.delete

O `id` da tag e' o slug do nome em ingles; o nome em portugues vem da DeepL.
"""
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.translation import translate_field
from app.models.enums import ContentStatus
from app.models.posts import Post, Tag, post_tag_links
from app.models.users import User
from app.schemas.posts import TagRead, TagWithCount, TagWrite

router = APIRouter(prefix="/tags", tags=["tags"])


def slugify(name: str) -> str:
    """'Patch Notes!' -> 'patch-notes' (sem acentos, so' a-z 0-9 e hifen, ate' 50 chars)."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:50].strip("-")


@router.get("", response_model=list[TagWithCount])
async def list_tags(db: AsyncSession = Depends(get_db)):
    """Todas as tags, com quantos posts publicados e ja' no ar usam cada uma (so' posts do publico entram na conta)."""
    live = (select(Post.id).where(Post.status == ContentStatus.PUBLISHED,
                                  func.coalesce(Post.published_at, Post.created_at) <= func.now()))
    counts = dict((await db.execute(
        select(post_tag_links.c.tag_id, func.count()).where(post_tag_links.c.post_id.in_(live))
        .group_by(post_tag_links.c.tag_id))).all())
    tags = (await db.execute(select(Tag).order_by(Tag.name))).scalars().all()
    return [TagWithCount(id=t.id, name=t.name, name_pt=t.name_pt, post_count=counts.get(t.id, 0)) for t in tags]


@router.post("", response_model=TagRead, status_code=201)
async def create_tag(
    payload: TagWrite,
    staff: User = Depends(require_permission(Permission.POST_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Cria uma tag (o slug nasce do nome; o portugues e' traduzido pela DeepL)."""
    slug = slugify(payload.name)
    if len(slug) < 2:
        raise HTTPException(status_code=422, detail="Invalid tag name")
    if await db.get(Tag, slug):
        raise HTTPException(status_code=409, detail="This tag already exists")
    if (await db.execute(select(func.count()).select_from(Tag))).scalar_one() >= 100:
        raise HTTPException(status_code=400, detail="Tag limit reached (100)")
    tag = Tag(id=slug, name=payload.name, name_pt=(await translate_field(payload.name) or None))
    if tag.name_pt:
        tag.name_pt = tag.name_pt[:50]
    db.add(tag)
    await log_action(db, action="create", entity_type="tag", entity_id=slug, diff={"name": tag.name}, actor=staff)
    await db.commit()
    return tag


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: str,
    staff: User = Depends(require_permission(Permission.POST_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga a tag (os posts continuam, so' perdem a etiqueta)."""
    tag = await db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await log_action(db, action="delete", entity_type="tag", entity_id=tag_id, diff={"name": tag.name}, actor=staff)
    await db.commit()
