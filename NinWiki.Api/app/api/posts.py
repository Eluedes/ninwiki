"""
Blog (posts) - mesma logica de permissoes de Conteudo:

  Publico (o site): so' enxerga posts PUBLICADOS cuja data de publicacao ja' chegou; rascunho e agendado respondem 404.
  Creator: cria e edita RASCUNHOS. Nao publica, nao apaga, nao mexe em post ja' publicado.
  Adm/S.Adm: publicam (inclusive agendando para o futuro), tiram do ar, editam publicados e apagam.

Rotas:
  GET    /posts             lista (resumo; ?tag=slug filtra)  - publico so' ve publicados e ja' no ar
  GET    /posts/{id}        ficha completa
  GET    /posts/slug/{slug} ficha completa por slug (URL legivel do site publico)
  POST   /posts             cria                  (posts.create)
  PUT    /posts/{id}        edita                 (posts.edit)
  DELETE /posts/{id}        apaga                 (posts.delete)
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.auth import get_optional_user, require_permission
from app.core.database import get_db
from app.core.payloads import apply_scalar_fields
from app.core.permissions import Permission
from app.core.publishing import guard_edit, guard_publish
from app.core.media_refs import resolve_images
from app.models.enums import ContentStatus
from app.models.posts import Post, Tag
from app.models.readers import PostComment, PostLike
from app.core.translation import fill_missing_translations, retranslate_fields
from app.models.users import User
from app.schemas.posts import PostRead, PostSummary, PostWrite

router = APIRouter(prefix="/posts", tags=["posts"])

# Pares (campo EN, campo PT) que a DeepL traduz sozinha: o texto sem sufixo e' o INGLES.
POST_TRANSLATABLE = [("title", "title_pt"), ("excerpt", "excerpt_pt"), ("content", "content_pt")]


def _is_live(post: Post, now: datetime | None = None) -> bool:
    """True se o post esta' NO AR para o publico: publicado e com data de publicacao ja' alcancada."""
    now = now or datetime.now(timezone.utc)
    return post.status == ContentStatus.PUBLISHED and (post.published_at is None or post.published_at <= now)


async def _counts(db: AsyncSession, post_ids: list[UUID]) -> dict[UUID, tuple[int, int]]:
    """Curtidas e comentarios VISIVEIS de cada post, em 2 consultas (nao uma por post)."""
    if not post_ids:
        return {}
    likes = dict((await db.execute(
        select(PostLike.post_id, func.count()).where(PostLike.post_id.in_(post_ids)).group_by(PostLike.post_id))).all())
    comments = dict((await db.execute(
        select(PostComment.post_id, func.count()).where(PostComment.post_id.in_(post_ids), PostComment.hidden.is_(False))
        .group_by(PostComment.post_id))).all())
    return {pid: (likes.get(pid, 0), comments.get(pid, 0)) for pid in post_ids}


def _summary(post: Post, counts: tuple[int, int] = (0, 0)) -> dict:
    """Converte um Post no resumo da listagem (sem o conteudo)."""
    return {
        "id": post.id, "slug": post.slug, "title": post.title, "excerpt": post.excerpt,
        "title_pt": post.title_pt, "excerpt_pt": post.excerpt_pt,
        "cover_image": post.cover_image, "status": post.status,
        "author_name": post.author_label or (post.author.username if post.author else None),   # post importado da Steam mostra o nome da desenvolvedora
        "tags": list(post.tags), "published_at": post.published_at,
        "is_scheduled": post.status == ContentStatus.PUBLISHED and not _is_live(post),
        "is_steam": bool(post.source_id),   # importado da Steam (post oficial da desenvolvedora): o site mostra o selo da logo dela
        "like_count": counts[0], "comment_count": counts[1],
        "created_at": post.created_at, "updated_at": post.updated_at,
    }


def _read(post: Post, counts: tuple[int, int] = (0, 0)) -> PostRead:
    """Converte um Post na ficha completa."""
    return PostRead(**_summary(post, counts), content=post.content, content_pt=post.content_pt, banner_image=post.banner_image,
                    meta_title=post.meta_title, meta_description=post.meta_description)


async def _read_full(db: AsyncSession, post: Post) -> PostRead:
    """Ficha completa ja' com os contadores de curtidas/comentarios."""
    return _read(post, (await _counts(db, [post.id])).get(post.id, (0, 0)))


def _hide_draft_from_public(post: Post, user: User | None) -> None:
    """Rascunho e post agendado (data no futuro) respondem 404 para quem nao e' da equipe."""
    if user is None and not _is_live(post):
        raise HTTPException(status_code=404, detail="Post not found")


async def _resolve_tags(db: AsyncSession, slugs: list[str]) -> list[Tag]:
    """Transforma os slugs enviados em objetos Tag; slug que nao existe -> 422."""
    if not slugs:
        return []
    found = {t.id: t for t in (await db.execute(select(Tag).where(Tag.id.in_(slugs)))).scalars().all()}
    missing = [s for s in slugs if s not in found]
    if missing:
        raise HTTPException(status_code=422, detail=f"Unknown tag: {missing[0]}")
    return [found[s] for s in slugs]


def _stamp_publication(post: Post, payload_published_at: datetime | None) -> None:
    """Define a data de publicacao: a escolhida; senao a ja' existente; senao AGORA (ao publicar). Rascunho nao mexe."""
    if post.status != ContentStatus.PUBLISHED:
        post.published_at = payload_published_at
        return
    post.published_at = payload_published_at or post.published_at or datetime.now(timezone.utc)


def _guard_publish(staff: User, new_status: ContentStatus) -> None:
    """Quem nao tem posts.publish nao pode colocar um post como publicado (403)."""
    guard_publish(staff, Permission.POST_PUBLISH, new_status)


def _guard_edit(staff: User, post: Post, new_status: ContentStatus) -> None:
    """Quem nao tem posts.publish nao mexe em post ja' publicado nem o publica (403)."""
    guard_edit(staff, Permission.POST_PUBLISH, post.status, new_status,
               "This post is already published. Only an Adm can change it.")


async def _load(db: AsyncSession, post_id: UUID) -> Post:
    """Carrega um post (com o autor) ou responde 404."""
    stmt = select(Post).where(Post.id == post_id).options(selectinload(Post.author))  # tags vem do selectin do modelo
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _slug_taken(db: AsyncSession, slug: str, ignore_id: UUID | None = None) -> bool:
    """True se ja' existe OUTRO post com este slug."""
    stmt = select(Post.id).where(Post.slug == slug)
    found = (await db.execute(stmt)).scalar_one_or_none()
    return found is not None and found != ignore_id


@router.get("", response_model=list[PostSummary])
async def list_posts(
    status: ContentStatus | None = Query(None, description="Filtra por status (so' vale pra equipe logada)"),
    tag: str | None = Query(None, max_length=50, description="Filtra pelo slug de uma tag"),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista posts, mais recentes primeiro; o publico so' ve' os publicados que ja' estao no ar."""
    stmt = select(Post).options(selectinload(Post.author))
    if user is None:
        # rascunho e agendado NUNCA aparecem pro publico
        stmt = stmt.where(Post.status == ContentStatus.PUBLISHED, func.coalesce(Post.published_at, Post.created_at) <= func.now())
    elif status is not None:
        stmt = stmt.where(Post.status == status)
    if tag:
        stmt = stmt.where(Post.tags.any(Tag.id == tag))
    stmt = stmt.order_by(func.coalesce(Post.published_at, Post.created_at).desc())
    posts = (await db.execute(stmt)).scalars().all()
    counts = await _counts(db, [p.id for p in posts])
    return [_summary(p, counts.get(p.id, (0, 0))) for p in posts]


@router.get("/slug/{slug}", response_model=PostRead)
async def get_post_by_slug(slug: str, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    """Ficha de um post pelo slug (URL legivel do site publico)."""
    stmt = select(Post).where(Post.slug == slug).options(selectinload(Post.author))
    post = (await db.execute(stmt)).scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    _hide_draft_from_public(post, user)
    return await _read_full(db, post)


@router.get("/{post_id}", response_model=PostRead)
async def get_post(post_id: UUID, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    """Ficha de um post pelo id (usado pelo painel)."""
    post = await _load(db, post_id)
    _hide_draft_from_public(post, user)
    return await _read_full(db, post)


@router.post("", response_model=PostRead, status_code=201)
async def create_post(
    payload: PostWrite,
    staff: User = Depends(require_permission(Permission.POST_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    """Cria um post (exige posts.create); Creator so' cria rascunho."""
    await resolve_images(db, payload)  # campos de imagem aceitam o ID do banco de imagens (img:12)
    _guard_publish(staff, payload.status)
    if await _slug_taken(db, payload.slug):
        raise HTTPException(status_code=409, detail=f"A post with the slug '{payload.slug}' already exists")
    data = payload.model_dump(exclude={"tags", "published_at"})
    post = Post(author_id=staff.id, **data)
    post.tags = await _resolve_tags(db, payload.tags)
    _stamp_publication(post, payload.published_at)
    db.add(post)
    await fill_missing_translations(post, POST_TRANSLATABLE, required=("title",))  # DeepL EN -> PT (so' o que veio vazio)
    await db.flush()
    await log_action(db, action="create", entity_type="post", entity_id=str(post.id),
                     diff={"name": post.title, "status": post.status.value}, actor=staff)
    await db.commit()
    return await _read_full(db, await _load(db, post.id))


@router.put("/{post_id}", response_model=PostRead)
async def update_post(
    post_id: UUID,
    payload: PostWrite,
    staff: User = Depends(require_permission(Permission.POST_EDIT)),
    db: AsyncSession = Depends(get_db),
):
    """Edita um post respeitando as regras de publicar/editar publicado."""
    post = await _load(db, post_id)
    await resolve_images(db, payload)  # campos de imagem aceitam o ID do banco de imagens (img:12)
    _guard_edit(staff, post, payload.status)
    if await _slug_taken(db, payload.slug, ignore_id=post.id):
        raise HTTPException(status_code=409, detail=f"A post with the slug '{payload.slug}' already exists")
    before = {"name": post.title, "status": post.status.value}
    apply_scalar_fields(post, payload, exclude={"tags", "published_at"})
    post.tags = await _resolve_tags(db, payload.tags)
    _stamp_publication(post, payload.published_at)
    await fill_missing_translations(post, POST_TRANSLATABLE, required=("title",))  # DeepL EN -> PT (so' o que ficou vazio)
    await log_action(db, action="update", entity_type="post", entity_id=str(post.id),
                     diff={"before": before, "after": {"name": post.title, "status": post.status.value}}, actor=staff)
    await db.commit()
    db.expire_all()
    return await _read_full(db, await _load(db, post_id))


@router.post("/{post_id}/retranslate", response_model=PostRead)
async def retranslate_post(
    post_id: UUID,
    staff: User = Depends(require_permission(Permission.POST_EDIT, Permission.TRANSLATION_RETRANSLATE)),
    db: AsyncSession = Depends(get_db),
):
    """Forca a traducao nova (EN -> PT) de titulo, resumo e texto - para quando o ingles mudou e o portugues ficou velho."""
    post = await _load(db, post_id)
    _guard_edit(staff, post, post.status)
    await retranslate_fields(post, POST_TRANSLATABLE, required=("title",))
    await db.commit()
    db.expire_all()
    return await _read_full(db, await _load(db, post_id))


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
