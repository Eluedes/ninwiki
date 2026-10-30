"""
Curtidas e comentarios dos posts (feitos por LEITORES logados com o Discord) + a moderacao deles pela equipe.

Leitor (cookie proprio, ver app/core/reader_auth.py):
  GET    /posts/{slug}/engagement            curtidas, comentarios e se EU curti            (publico)
  PUT    /posts/{slug}/like                  curte (idempotente)                           (leitor)
  DELETE /posts/{slug}/like                  descurte                                      (leitor)
  GET    /posts/{slug}/comments              comentarios visiveis, mais antigos primeiro   (publico)
  POST   /posts/{slug}/comments              comenta (texto simples)                       (leitor)
  DELETE /posts/{slug}/comments/{id}         apaga o PROPRIO comentario                    (leitor)

Equipe (permissao comments.moderate):
  GET    /comments/moderation                lista (com filtro: escondidos / busca)
  PATCH  /comments/moderation/{id}           esconde ou mostra  {hidden: bool}
  DELETE /comments/moderation/{id}           apaga
  PATCH  /comments/moderation/readers/{id}   bane ou desbane o leitor {banned: bool}

Defesas: comentario e' TEXTO SIMPLES (o site o mostra escapado), limite de tamanho, limite de comentarios por minuto/hora
por leitor, so' em posts que ja' estao no ar, leitor banido perde a sessao na hora e some o poder de comentar/curtir.
"""
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.posts import _is_live
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.core.text import escape_like
from app.core.rate_limit import COMMENT, LIKE, limiter, retry_message
from app.core.reader_auth import get_current_reader, get_optional_reader
from app.models.posts import Post
from app.models.readers import PostComment, PostLike, Reader
from app.models.users import User
from app.schemas.posts import (
    MAX_COMMENT_CHARS, CommentRead, CommentWrite, Engagement, ModerationComment, ReaderPublic,
)

router = APIRouter(prefix="/posts", tags=["engagement"])
moderation_router = APIRouter(prefix="/comments/moderation", tags=["comments-moderation"])

MAX_URLS_PER_COMMENT = 2  # barra spam de links


def _throttle(bucket: str, reader: Reader, limit: int, window: float) -> None:
    """Estoura o limite por leitor -> 429 com 'tente de novo em N segundos'."""
    wait = limiter.hit(bucket, str(reader.id), limit, window)
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})


def clean_comment(raw: str) -> str:
    """Normaliza o comentario: tira caracteres de controle, comprime linhas em branco e confere tamanho e quantidade de links."""
    text = "".join(ch for ch in raw if ch in "\n\t" or ch.isprintable()).replace("\t", " ")
    text = re.sub(r"[ ]{2,}", " ", re.sub(r"\n{3,}", "\n\n", text.replace("\r", ""))).strip()
    if not text:
        raise HTTPException(status_code=422, detail="Write something first")
    if len(text) > MAX_COMMENT_CHARS:
        raise HTTPException(status_code=422, detail=f"Comment too long (max {MAX_COMMENT_CHARS} characters)")
    if len(re.findall(r"https?://|www\.", text, flags=re.I)) > MAX_URLS_PER_COMMENT:
        raise HTTPException(status_code=422, detail=f"Too many links (max {MAX_URLS_PER_COMMENT})")
    return text


async def _live_post(db: AsyncSession, slug: str) -> Post:
    """Post pelo slug, so' se estiver NO AR (publicado e com a data alcancada); senao 404."""
    post = (await db.execute(select(Post).where(Post.slug == slug))).scalar_one_or_none()
    if post is None or not _is_live(post):
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def _engagement(db: AsyncSession, post: Post, reader: Reader | None) -> Engagement:
    """Conta curtidas e comentarios visiveis e confere se o leitor logado ja' curtiu."""
    likes = (await db.execute(select(func.count()).select_from(PostLike).where(PostLike.post_id == post.id))).scalar_one()
    comments = (await db.execute(select(func.count()).select_from(PostComment)
                                 .where(PostComment.post_id == post.id, PostComment.hidden.is_(False)))).scalar_one()
    mine = reader is not None and (await db.get(PostLike, (post.id, reader.id))) is not None
    return Engagement(like_count=likes, comment_count=comments, liked_by_me=mine)


@router.get("/{slug}/engagement", response_model=Engagement)
async def get_engagement(slug: str, reader: Reader | None = Depends(get_optional_reader), db: AsyncSession = Depends(get_db)):
    """Curtidas, comentarios e se o leitor logado ja' curtiu."""
    return await _engagement(db, await _live_post(db, slug), reader)


@router.put("/{slug}/like", response_model=Engagement)
async def like_post(slug: str, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Curte o post (curtir de novo nao faz nada)."""
    _throttle(LIKE, reader, 60, 60)
    post = await _live_post(db, slug)
    if await db.get(PostLike, (post.id, reader.id)) is None:
        db.add(PostLike(post_id=post.id, reader_id=reader.id))
        await db.commit()
    return await _engagement(db, post, reader)


@router.delete("/{slug}/like", response_model=Engagement)
async def unlike_post(slug: str, reader: Reader = Depends(get_current_reader), db: AsyncSession = Depends(get_db)):
    """Tira a curtida."""
    _throttle(LIKE, reader, 60, 60)
    post = await _live_post(db, slug)
    like = await db.get(PostLike, (post.id, reader.id))
    if like is not None:
        await db.delete(like)
        await db.commit()
    return await _engagement(db, post, reader)


@router.get("/{slug}/comments", response_model=list[CommentRead])
async def list_comments(slug: str, reader: Reader | None = Depends(get_optional_reader), db: AsyncSession = Depends(get_db)):
    """Comentarios visiveis (os escondidos pela moderacao nao aparecem), do mais antigo ao mais novo."""
    post = await _live_post(db, slug)
    rows = (await db.execute(
        select(PostComment).where(PostComment.post_id == post.id, PostComment.hidden.is_(False))
        .order_by(PostComment.created_at).limit(500))).scalars().all()
    return [CommentRead(id=c.id, body=c.body, created_at=c.created_at,
                        author=ReaderPublic(username=c.reader.username, avatar_url=c.reader.avatar_url),
                        mine=reader is not None and c.reader_id == reader.id) for c in rows]


@router.post("/{slug}/comments", response_model=CommentRead, status_code=201)
async def add_comment(slug: str, payload: CommentWrite, reader: Reader = Depends(get_current_reader),
                      db: AsyncSession = Depends(get_db)):
    """Comenta (texto simples). Limites: 5 por minuto e 30 por hora por leitor."""
    _throttle(COMMENT, reader, 5, 60)
    _throttle(COMMENT + "_hour", reader, 30, 3600)
    post = await _live_post(db, slug)
    comment = PostComment(post_id=post.id, reader_id=reader.id, body=clean_comment(payload.body))
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentRead(id=comment.id, body=comment.body, created_at=comment.created_at,
                       author=ReaderPublic(username=reader.username, avatar_url=reader.avatar_url), mine=True)


@router.delete("/{slug}/comments/{comment_id}", status_code=204)
async def delete_own_comment(slug: str, comment_id: UUID, reader: Reader = Depends(get_current_reader),
                             db: AsyncSession = Depends(get_db)):
    """O leitor apaga o PROPRIO comentario (o de outra pessoa responde 404, nao revela que existe)."""
    comment = await db.get(PostComment, comment_id)
    if comment is None or comment.reader_id != reader.id:
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.delete(comment)
    await db.commit()


# ---------------- moderacao (equipe) ----------------

class HideBody(BaseModel):
    """Corpo de esconder/mostrar um comentario."""
    hidden: bool


class BanBody(BaseModel):
    """Corpo de banir/desbanir um leitor."""
    banned: bool


@moderation_router.get("", response_model=list[ModerationComment])
async def list_for_moderation(
    only_hidden: bool = False, q: str | None = None,
    staff: User = Depends(require_permission(Permission.COMMENTS_MODERATE)), db: AsyncSession = Depends(get_db),
):
    """Comentarios mais recentes primeiro (ate' 200), com post e autor; `q` busca no texto ou no nome do leitor."""
    stmt = select(PostComment, Post.slug, Post.title).join(Post, Post.id == PostComment.post_id)
    if only_hidden:
        stmt = stmt.where(PostComment.hidden.is_(True))
    if q and q.strip():
        like = "%" + escape_like(q.strip()[:60]) + "%"
        stmt = stmt.join(Reader, Reader.id == PostComment.reader_id).where(
            or_(PostComment.body.ilike(like, escape="\\"), Reader.username.ilike(like, escape="\\")))
    rows = (await db.execute(stmt.order_by(PostComment.created_at.desc()).limit(200))).all()
    return [ModerationComment(
        id=c.id, body=c.body, created_at=c.created_at, hidden=c.hidden, hidden_by=c.hidden_by,
        post_slug=slug, post_title=title, reader_id=c.reader_id, reader_name=c.reader.username,
        reader_discord_id=str(c.reader.discord_id), reader_banned=c.reader.banned) for c, slug, title in rows]


async def _comment_or_404(db: AsyncSession, comment_id: UUID) -> PostComment:
    """Carrega o comentario ou responde 404."""
    comment = await db.get(PostComment, comment_id)
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


@moderation_router.patch("/{comment_id}")
async def hide_comment(comment_id: UUID, payload: HideBody,
                       staff: User = Depends(require_permission(Permission.COMMENTS_MODERATE)),
                       db: AsyncSession = Depends(get_db)):
    """Esconde (some do site) ou mostra de volta um comentario."""
    comment = await _comment_or_404(db, comment_id)
    comment.hidden, comment.hidden_by = payload.hidden, (staff.username if payload.hidden else None)
    await log_action(db, action="hide" if payload.hidden else "unhide", entity_type="comment", entity_id=str(comment.id),
                     diff={"reader": comment.reader.username}, actor=staff)
    await db.commit()
    return {"ok": True}


@moderation_router.delete("/{comment_id}", status_code=204)
async def delete_comment(comment_id: UUID, staff: User = Depends(require_permission(Permission.COMMENTS_MODERATE)),
                         db: AsyncSession = Depends(get_db)):
    """Apaga o comentario de vez (fica registrado no log de auditoria)."""
    comment = await _comment_or_404(db, comment_id)
    await log_action(db, action="delete", entity_type="comment", entity_id=str(comment.id),
                     diff={"reader": comment.reader.username, "body": comment.body[:200]}, actor=staff)
    await db.delete(comment)
    await db.commit()


@moderation_router.patch("/readers/{reader_id}")
async def ban_reader(reader_id: UUID, payload: BanBody,
                     staff: User = Depends(require_permission(Permission.COMMENTS_MODERATE)),
                     db: AsyncSession = Depends(get_db)):
    """Bane (ou desbane) um leitor: banido nao entra, nao comenta e nao curte; a sessao atual cai na hora."""
    reader = await db.get(Reader, reader_id)
    if reader is None:
        raise HTTPException(status_code=404, detail="Reader not found")
    reader.banned = payload.banned
    await log_action(db, action="ban" if payload.banned else "unban", entity_type="reader", entity_id=str(reader.id),
                     diff={"reader": reader.username}, actor=staff)
    await db.commit()
    return {"ok": True}
