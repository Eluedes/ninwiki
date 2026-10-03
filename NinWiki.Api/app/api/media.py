"""
Banco de imagens do painel: toda imagem enviada ganha um ID (#1, #2...) que a equipe digita nos campos de imagem (`img:12`, `#12` ou `12`).

  GET    /media?q=&limit=&offset=   lista/busca (por nome ou ID)                  uploads.create
  GET    /media/{id}                uma imagem (o painel usa para trocar o ID pelo endereco)   uploads.create
  POST   /media                     envia uma imagem (multipart: file, name)      uploads.create
  PATCH  /media/{id}                renomeia (so' o rotulo)                       media.manage
  GET    /media/{id}/usage          onde a imagem esta' sendo usada               media.manage
  DELETE /media/{id}                apaga (409 se estiver em uso, a menos que ?force=true)   media.manage
  POST   /media/sync                registra as imagens que ja' estavam em uploads/ e nao tem ID   media.manage

Os arquivos continuam em uploads/ com nome aleatorio (mesma validacao do POST /uploads/image: assinatura binaria, limite de pixels, redimensionar).
"""
import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from PIL import Image
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.uploads import UPLOAD_DIR, store_image
from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.database import get_db
from app.core.media_refs import media_url, parse_ref
from app.core.permissions import Permission
from app.models.content import ContentItem
from app.models.masteries import Jutsu, Mastery
from app.models.media import MediaImage
from app.models.posts import Post
from app.models.users import User
from app.models.villages import Clan, Village
from app.schemas.content import CamelModel

router = APIRouter(prefix="/media", tags=["media"])


class MediaRead(CamelModel):
    """Uma imagem do banco de imagens como o painel mostra."""
    id: int
    name: str
    url: str
    width: int
    height: int
    bytes: int
    uploaded_by: str | None = None
    created_at: str


class MediaPage(CamelModel):
    """Pagina de resultados da lista."""
    items: list[MediaRead]
    total: int


class MediaRename(CamelModel):
    """Corpo de renomear uma imagem."""
    name: str = Field(default="", max_length=80)


class MediaUse(CamelModel):
    """Um lugar onde a imagem esta' sendo usada."""
    kind: str
    label: str


def _read(m: MediaImage) -> MediaRead:
    """Converte a linha do banco no formato da API."""
    return MediaRead(id=m.id, name=m.name, url=media_url(m.filename), width=m.width, height=m.height, bytes=m.bytes,
                     uploaded_by=m.uploaded_by, created_at=m.created_at.isoformat() if m.created_at else "")


def _scan_folder(known: set[str]) -> list[tuple[str, int, int, int]]:
    """(Roda numa thread) Le o cabecalho de cada imagem nova de uploads/ - nome, largura, altura, bytes - da mais antiga para a mais nova."""
    files = sorted((p for p in UPLOAD_DIR.iterdir() if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".gif", ".webp"} and p.name not in known),
                   key=lambda p: p.stat().st_mtime)
    found: list[tuple[str, int, int, int]] = []
    for path in files:
        try:
            with Image.open(path) as img:
                width, height = img.size
        except Exception:
            continue  # arquivo estranho na pasta: ignora
        found.append((path.name, width, height, path.stat().st_size))
    return found


async def _sync_folder(db: AsyncSession, who: str | None) -> int:
    """Registra os arquivos de uploads/ que ainda nao estao no banco de imagens (a mais antiga primeiro). Devolve quantos entraram.
    A leitura de milhares de arquivos roda numa thread (nao trava o resto da API)."""
    known = set((await db.execute(select(MediaImage.filename))).scalars().all())
    found = await asyncio.to_thread(_scan_folder, known)
    for filename, width, height, size in found:
        db.add(MediaImage(filename=filename, name="", width=width, height=height, bytes=size, uploaded_by=who))
    if found:
        await db.flush()
    return len(found)


@router.get("", response_model=MediaPage)
async def list_media(
    q: str = Query("", max_length=80), limit: int = Query(60, ge=1, le=200), offset: int = Query(0, ge=0),
    staff: User = Depends(require_permission(Permission.UPLOAD_CREATE)), db: AsyncSession = Depends(get_db),
) -> MediaPage:
    """Lista o banco de imagens (mais novas primeiro). `q` busca no nome ou pelo ID (12, #12, img:12). Banco vazio: registra as imagens que ja' estavam em uploads/."""
    if (await db.execute(select(func.count()).select_from(MediaImage))).scalar_one() == 0:
        if await _sync_folder(db, None):
            await db.commit()
    stmt = select(MediaImage)
    q = q.strip()
    if q:
        ref = parse_ref(q)
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        cond = MediaImage.name.ilike(like, escape="\\")
        stmt = stmt.where(or_(cond, MediaImage.id == ref) if ref is not None else cond)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(MediaImage.id.desc()).limit(limit).offset(offset))).scalars().all()
    return MediaPage(items=[_read(m) for m in rows], total=total)


@router.post("/sync")
async def sync_media(
    staff: User = Depends(require_permission(Permission.MEDIA_MANAGE)), db: AsyncSession = Depends(get_db),
) -> dict:
    """Registra no banco de imagens as imagens que ja' estavam em uploads/ sem ID."""
    added = await _sync_folder(db, staff.username)
    if added:
        await log_action(db, action="sync", entity_type="media", entity_id="uploads", diff={"added": added}, actor=staff)
    await db.commit()
    return {"added": added}


@router.get("/{media_id}", response_model=MediaRead)
async def get_media(
    media_id: int, staff: User = Depends(require_permission(Permission.UPLOAD_CREATE)), db: AsyncSession = Depends(get_db),
) -> MediaRead:
    """Uma imagem pelo ID (404 se nao existir)."""
    m = await db.get(MediaImage, media_id)
    if m is None:
        raise HTTPException(status_code=404, detail=f"Image #{media_id} was not found")
    return _read(m)


@router.post("", response_model=MediaRead, status_code=201)
async def upload_media(
    file: UploadFile = File(...), name: str = Form(default="", max_length=80),
    staff: User = Depends(require_permission(Permission.UPLOAD_CREATE)), db: AsyncSession = Depends(get_db),
) -> MediaRead:
    """Envia uma imagem para o banco de imagens e devolve o ID dela."""
    return _read(await store_image(file, staff, db, name))


@router.patch("/{media_id}", response_model=MediaRead)
async def rename_media(
    media_id: int, payload: MediaRename,
    staff: User = Depends(require_permission(Permission.MEDIA_MANAGE)), db: AsyncSession = Depends(get_db),
) -> MediaRead:
    """Muda o rotulo da imagem (o ID e o arquivo nao mudam)."""
    m = await db.get(MediaImage, media_id)
    if m is None:
        raise HTTPException(status_code=404, detail=f"Image #{media_id} was not found")
    new = " ".join("".join(ch if ch.isprintable() else " " for ch in payload.name).split())[:80]
    before, m.name = m.name, new
    await log_action(db, action="rename", entity_type="media", entity_id=str(m.id), diff={"before": before, "after": new}, actor=staff)
    await db.commit()
    await db.refresh(m)
    return _read(m)


async def _usage(db: AsyncSession, filename: str) -> list[MediaUse]:
    """Onde o arquivo aparece: campos de imagem e textos ricos (conteudo, blog) - busca pelo nome do arquivo."""
    like = f"%/uploads/{filename}%"
    places = [
        (ContentItem, [ContentItem.image, ContentItem.description, ContentItem.lore, ContentItem.synergy, ContentItem.description_pt, ContentItem.lore_pt, ContentItem.synergy_pt], ContentItem.name, "content"),
        (Post, [Post.cover_image, Post.content, Post.content_pt], Post.title, "blog post"),
        (Mastery, [Mastery.image, Mastery.gif], Mastery.name, "mastery"),
        (Jutsu, [Jutsu.gif], Jutsu.name, "jutsu"),
        (Village, [Village.image], Village.name, "village"),
        (Clan, [Clan.image], Clan.name, "clan"),
    ]
    out: list[MediaUse] = []
    for _model, cols, label_col, kind in places:
        rows = (await db.execute(select(label_col).where(or_(*[c.like(like) for c in cols])).limit(20))).scalars().all()
        out += [MediaUse(kind=kind, label=str(r)) for r in rows]
    return out


@router.get("/{media_id}/usage", response_model=list[MediaUse])
async def media_usage(
    media_id: int, staff: User = Depends(require_permission(Permission.MEDIA_MANAGE)), db: AsyncSession = Depends(get_db),
) -> list[MediaUse]:
    """Lista onde a imagem esta' sendo usada (ate' 20 por tipo)."""
    m = await db.get(MediaImage, media_id)
    if m is None:
        raise HTTPException(status_code=404, detail=f"Image #{media_id} was not found")
    return await _usage(db, m.filename)


class MediaBulkDelete(CamelModel):
    """Corpo de apagar varias imagens de uma vez."""
    ids: list[int] = Field(min_length=1, max_length=200)
    force: bool = False


class MediaBulkResult(CamelModel):
    """Resultado do apagar em massa: o que foi apagado e o que ficou por estar em uso."""
    deleted: list[int]
    in_use: list[dict]       # [{id, uses: [{kind, label}]}] - nao apagadas (sem force)
    not_found: list[int]


@router.post("/bulk-delete", response_model=MediaBulkResult)
async def bulk_delete_media(
    payload: MediaBulkDelete,
    staff: User = Depends(require_permission(Permission.MEDIA_MANAGE)), db: AsyncSession = Depends(get_db),
) -> MediaBulkResult:
    """Apaga varias imagens. As que estao em uso ficam de fora (e voltam em `inUse`), a menos que `force=true`."""
    deleted: list[int] = []
    in_use: list[dict] = []
    not_found: list[int] = []
    files: list[str] = []
    for media_id in dict.fromkeys(payload.ids):
        m = await db.get(MediaImage, media_id)
        if m is None:
            not_found.append(media_id)
            continue
        uses = await _usage(db, m.filename)
        if uses and not payload.force:
            in_use.append({"id": media_id, "uses": [u.model_dump() for u in uses[:5]]})
            continue
        files.append(m.filename)
        deleted.append(media_id)
        await db.delete(m)
    if deleted:
        await log_action(db, action="bulk-delete", entity_type="media", entity_id=",".join(map(str, deleted))[:200],
                         diff={"count": len(deleted), "force": payload.force}, actor=staff)
    await db.commit()
    for filename in files:
        (UPLOAD_DIR / Path(filename).name).unlink(missing_ok=True)
    return MediaBulkResult(deleted=deleted, in_use=in_use, not_found=not_found)


@router.delete("/{media_id}", status_code=204)
async def delete_media(
    media_id: int, force: bool = Query(False),
    staff: User = Depends(require_permission(Permission.MEDIA_MANAGE)), db: AsyncSession = Depends(get_db),
) -> None:
    """Apaga a imagem (banco e arquivo). Se estiver em uso responde 409, a menos que `force=true`."""
    m = await db.get(MediaImage, media_id)
    if m is None:
        raise HTTPException(status_code=404, detail=f"Image #{media_id} was not found")
    uses = await _usage(db, m.filename)
    if uses and not force:
        raise HTTPException(status_code=409, detail=f"This image is used in {len(uses)} place(s) (e.g. {uses[0].kind}: {uses[0].label}). Remove it from there first, or delete anyway")
    filename = m.filename
    await db.delete(m)
    await log_action(db, action="delete", entity_type="media", entity_id=str(media_id), diff={"file": filename, "usedIn": len(uses)}, actor=staff)
    await db.commit()
    (UPLOAD_DIR / Path(filename).name).unlink(missing_ok=True)
