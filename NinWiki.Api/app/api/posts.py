"""
Blog (posts) - mesma logica de permissoes de Conteudo:

  Publico (o site): so' enxerga posts PUBLICADOS; rascunho responde 404.
  Creator: cria e edita RASCUNHOS. Nao publica, nao apaga, nao mexe em post ja' publicado.
  Adm/S.Adm: publicam, tiram do ar, editam publicados e apagam.

Rotas:
  GET    /posts             lista (resumo)        - publico so' ve publicados
  GET    /posts/{id}        ficha completa
  GET    /posts/slug/{slug} ficha completa por slug (URL legivel, pro futuro site publico)
  POST   /posts             cria                  (posts.create)
  PUT    /posts/{id}        edita                 (posts.edit)
  DELETE /posts/{id}        apaga                 (posts.delete)
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.auth import get_optional_user, require_permission
from app.core.database import get_db
from app.core.payloads import apply_scalar_fields
from app.core.permissions import Permission, has_permission
from app.models.enums import ContentStatus
from app.models.posts import Post
from app.models.users import User
from app.schemas.posts import PostRead, PostSummary, PostWrite

router = APIRouter(prefix="/posts", tags=["posts"])


def _summary(post: Post) -> dict:
    """Converte um Post no resumo da listagem (sem o conteudo)."""
    return {
        "id": post.id, "slug": post.slug, "title": post.title, "excerpt": post.excerpt,
        "cover_image": post.cover_image, "status": post.status,
        "author_name": post.author.username if post.author else None,
        "created_at": post.created_at, "updated_at": post.updated_at,
    }


def _read(post: Post) -> PostRead:
    """Converte um Post na ficha completa."""
    return PostRead(**_summary(post), content=post.content)


def _hide_draft_from_public(post: Post, user: User | None) -> None:
    """Rascunho responde 404 para quem nao e' da equipe."""
    if user is None and post.status != ContentStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Post não encontrado")


def _guard_publish(staff: User, new_status: ContentStatus) -> None:
    """Quem nao tem posts.publish nao pode colocar um post como publicado (403)."""
    if new_status == ContentStatus.PUBLISHED and not has_permission(staff.role, Permission.POST_PUBLISH):
        raise HTTPException(status_code=403, detail="Só um Adm pode publicar. Salve como rascunho.")


def _guard_edit(staff: User, post: Post, new_status: ContentStatus) -> None:
    """Quem nao tem posts.publish nao mexe em post ja' publicado nem o publica (403)."""
    if not has_permission(staff.role, Permission.POST_PUBLISH) and post.status == ContentStatus.PUBLISHED:
        raise HTTPException(status_code=403, detail="Este post já está publicado. Só um Adm pode alterá-lo.")
    _guard_publish(staff, new_status)


async def _load(db: AsyncSession, post_id: UUID) -> Post:
    """Carrega um post (com o autor) ou responde 404."""
    stmt = select(Post).where(Post.id == post_id).options(selectinload(Post.author))
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return post


async def _slug_taken(db: AsyncSession, slug: str, ignore_id: UUID | None = None) -> bool:
    """True se ja' existe OUTRO post com este slug."""
    stmt = select(Post.id).where(Post.slug == slug)
    found = (await db.execute(stmt)).scalar_one_or_none()
    return found is not None and found != ignore_id


@router.get("", response_model=list[PostSummary])
async def list_posts(
    status: ContentStatus | None = Query(None, description="Filtra por status (so' vale pra equipe logada)"),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista posts, mais recentes primeiro; o publico so' ve' os publicados."""
    stmt = select(Post).options(selectinload(Post.author)).order_by(Post.created_at.desc())
    if user is None:
        stmt = stmt.where(Post.status == ContentStatus.PUBLISHED)  # rascunho NUNCA aparece pro publico
    elif status is not None:
        stmt = stmt.where(Post.status == status)
    return [_summary(p) for p in (await db.execute(stmt)).scalars().all()]


@router.get("/slug/{slug}", response_model=PostRead)
async def get_post_by_slug(slug: str, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    """Ficha de um post pelo slug (URL legivel do site publico)."""
    stmt = select(Post).where(Post.slug == slug).options(selectinload(Post.author))
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    _hide_draft_from_public(post, user)
    return _read(post)


@router.get("/{post_id}", response_model=PostRead)
async def get_post(post_id: UUID, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    """Ficha de um post pelo id (usado pelo painel)."""
    post = await _load(db, post_id)
    _hide_draft_from_public(post, user)
    return _read(post)


@router.post("", response_model=PostRead, status_code=201)
async def create_post(
    payload: PostWrite,
    staff: User = Depends(require_permission(Permission.POST_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Cria um post (exige posts.create); Creator so' cria rascunho."""
    _guard_publish(staff, payload.status)
    if await _slug_taken(db, payload.slug):
        raise HTTPException(status_code=409, detail=f"Já existe um post com o slug '{payload.slug}'")
    post = Post(author_id=staff.id, **payload.model_dump())
    db.add(post)
    await db.flush()
    await log_action(db, action="create", entity_type="post", entity_id=str(post.id),
                     diff={"name": post.title, "status": post.status.value}, actor=staff)
    await db.commit()
    return _read(await _load(db, post.id))


@router.put("/{post_id}", response_model=PostRead)
async def update_post(
    post_id: UUID,
    payload: PostWrite,
    staff: User = Depends(require_permission(Permission.POST_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Edita um post respeitando as regras de publicar/editar publicado."""
    post = await _load(db, post_id)
    _guard_edit(staff, post, payload.status)
    if await _slug_taken(db, payload.slug, ignore_id=post.id):
        raise HTTPException(status_code=409, detail=f"Já existe um post com o slug '{payload.slug}'")
    before = {"name": post.title, "status": post.status.value}
    apply_scalar_fields(post, payload)
    await log_action(db, action="update", entity_type="post", entity_id=str(post.id),
                     diff={"before": before, "after": {"name": post.title, "status": post.status.value}}, actor=staff)
    await db.commit()
    db.expire_all()
    return _read(await _load(db, post_id))


@router.delete("/{post_id}", status_code=204)
async def delete_post(
    post_id: UUID,
    staff: User = Depends(require_permission(Permission.POST_DELETE)),
    db: AsyncSession = Depends(get_db),
):
    """Apaga um post (exige posts.delete)."""
    post = await _load(db, post_id)
    title = post.title
    await db.delete(post)
    await log_action(db, action="delete", entity_type="post", entity_id=str(post_id), diff={"name": title}, actor=staff)
    await db.commit()
