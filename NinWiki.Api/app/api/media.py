"""
Banco de imagens do painel: toda imagem enviada ganha um ID (#1, #2...) que a equipe digita nos campos de imagem (`img:12`, `#12` ou `12`).

  GET    /media?q=&limit=&offset=   lista/busca (por nome ou ID)                  uploads.create
  GET    /media/{id}                uma imagem (o painel usa para trocar o ID pelo endereco)   uploads.create
  PATCH  /media/{id}                renomeia (media.manage) e/ou muda a categoria (media.manage OU media.categorize)
  POST   /media/renumber            renumera os IDs a partir de 1                  media.reset_ids (so' S.Adm)
  POST   /media/bulk-category       muda a categoria de varias imagens             media.manage OU media.categorize
  POST   /media                     envia uma imagem (multipart: file, name, category)   media.upload (padrao: so' S.Adm)
Categoria 'closed': PRIVADA - so' quem tem media.closed (S.Adm) ve; para os outros as imagens dela nao existem (somem da lista e da contagem, 404 no resto).
Limite: quem digita o ID de uma imagem 'closed' num campo de imagem (img:12) ainda a usa - o ID nao e' mostrado a ninguem que nao seja S.Adm.
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
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.uploads import UPLOAD_DIR, store_image
from app.core.audit import log_action
from app.core.auth import require_any_permission, require_permission
from app.core.database import get_db
from app.core.media_refs import CLOSED_MESSAGE, media_url, parse_ref
from app.core.permissions import Permission, is_category_locked, user_has_permission
from app.models.content import ContentItem
from app.models.masteries import Jutsu, Mastery
from app.models.media import MediaImage
from app.models.posts import Post
from app.models.users import User
from app.models.villages import Clan, Village
from app.schemas.content import CamelModel

router = APIRouter(prefix="/media", tags=["media"])


# Categorias do banco de imagens ('' = sem categoria). Fixas de proposito: o filtro do painel fica pequeno e o nome nao vira lixo digitado.
MEDIA_CATEGORIES: tuple[str, ...] = ("weapon", "gear", "consumable", "currency", "material", "ring", "scroll", "npc", "monster", "furniture", "hair_beard", "skin", "tools", "closed", "other")
CLOSED = "closed"   # categoria PRIVADA: so' S.Adm (media.closed). As demais podem ser TRANCADAS por cargo em /admin/permissions (media.cat.<categoria>)


def _locked_categories(staff: User) -> list[str]:
    """Categorias ('' = Sem categoria) que este usuario NAO pode ver: 'closed' (so' S.Adm) e as que o S.Adm trancou para o cargo dele."""
    return [c for c in ("", *MEDIA_CATEGORIES) if is_category_locked(staff, c)]


def _hide_locked(stmt, staff: User):
    """Tira da consulta as imagens de categorias trancadas para o usuario (somem da lista, da contagem e da busca)."""
    locked = _locked_categories(staff)
    return stmt.where(MediaImage.category.not_in(locked)) if locked else stmt


async def _get_visible(db: AsyncSession, media_id: int, staff: User) -> MediaImage | None:
    """A imagem pelo ID (None = nao existe). Se a categoria dela estiver trancada para o usuario: 403 com o aviso de acesso negado."""
    m = await db.get(MediaImage, media_id)
    if m is not None and is_category_locked(staff, m.category):
        raise HTTPException(status_code=403, detail=CLOSED_MESSAGE)
    return m


async def _deny_locked_ids(db: AsyncSession, ids: list[int], staff: User) -> None:
    """Operacao em varias imagens: se QUALQUER uma estiver numa categoria trancada para o usuario, recusa tudo (403 com o aviso)."""
    locked = _locked_categories(staff)
    if not locked:
        return
    n = (await db.execute(select(func.count()).select_from(MediaImage).where(MediaImage.id.in_(ids), MediaImage.category.in_(locked)))).scalar_one()
    if n:
        raise HTTPException(status_code=403, detail=CLOSED_MESSAGE)


def _valid_category(value: str | None, staff: User) -> str:
    """Categoria valida ('' = sem categoria) ou erro: 422 se nao existe; 403 (aviso de acesso negado) se esta' trancada para o usuario."""
    v = (value or "").strip().lower()
    if v and v not in MEDIA_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Unknown category. Use one of: {', '.join(MEDIA_CATEGORIES)}")
    if is_category_locked(staff, v):
        raise HTTPException(status_code=403, detail=CLOSED_MESSAGE)
    return v


class MediaRead(CamelModel):
    """Uma imagem do banco de imagens como o painel mostra."""
    id: int
    name: str
    category: str = ""
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
    restricted: bool = False   # True: a busca/ID bateu com imagem(ns) da categoria 'closed' que este usuario nao pode ver (o painel mostra o aviso)
    counts: dict[str, int] = Field(default_factory=dict)   # imagens por categoria ('' = sem categoria), da biblioteca toda


class MediaRename(CamelModel):
    """Corpo de editar uma imagem: nome e/ou categoria (o que nao vier fica como esta')."""
    name: str | None = Field(default=None, max_length=80)
    category: str | None = Field(default=None, max_length=20)


class MediaBulkCategory(CamelModel):
    """Corpo de mudar a categoria de varias imagens de uma vez ('' = tirar a categoria)."""
    ids: list[int] = Field(min_length=1, max_length=200)
    category: str = Field(default="", max_length=20)


class MediaUse(CamelModel):
    """Um lugar onde a imagem esta' sendo usada."""
    kind: str
    label: str


def _read(m: MediaImage) -> MediaRead:
    """Converte a linha do banco no formato da API."""
    return MediaRead(id=m.id, name=m.name, category=m.category, url=media_url(m.filename), width=m.width, height=m.height, bytes=m.bytes,
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
    q: str = Query("", max_length=80), category: str | None = Query(None, max_length=20), limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0),
    staff: User = Depends(require_permission(Permission.UPLOAD_CREATE)), db: AsyncSession = Depends(get_db),
) -> MediaPage:
    """Lista o banco de imagens (mais novas primeiro). `q` busca no nome ou pelo ID (12, #12, img:12). Banco vazio: registra as imagens que ja' estavam em uploads/."""
    if (await db.execute(select(func.count()).select_from(MediaImage))).scalar_one() == 0:
        if await _sync_folder(db, None):
            await db.commit()
    stmt = _hide_locked(select(MediaImage), staff)
    if category is not None:  # '' (ou "none") = so' as sem categoria; categoria trancada para o usuario = 403 com o aviso
        stmt = stmt.where(MediaImage.category == ("" if category == "none" else _valid_category(category, staff)))
        if category == "none" and is_category_locked(staff, ""):
            raise HTTPException(status_code=403, detail=CLOSED_MESSAGE)
    q = q.strip()
    if q:
        ref = parse_ref(q)
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        cond = MediaImage.name.ilike(like, escape="\\")
        stmt = stmt.where(or_(cond, MediaImage.id == ref) if ref is not None else cond)
    restricted = False
    locked = _locked_categories(staff)
    if q and locked:   # a busca (nome ou ID) bateria com imagem de categoria trancada? avisa, sem mostrar nada dela
        probe = select(func.count()).select_from(MediaImage).where(MediaImage.category.in_(locked), or_(cond, MediaImage.id == ref) if ref is not None else cond)
        restricted = (await db.execute(probe)).scalar_one() > 0
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(MediaImage.id.desc()).limit(limit).offset(offset))).scalars().all()
    counts = {c or "": n for c, n in (await db.execute(_hide_locked(select(MediaImage.category, func.count()), staff).group_by(MediaImage.category))).all()}
    return MediaPage(items=[_read(m) for m in rows], total=total, counts=counts, restricted=restricted)


def _can_categorize(staff: User) -> bool:
    """Pode escolher/mudar a categoria das imagens? (media.manage OU media.categorize)"""
    return user_has_permission(staff, Permission.MEDIA_MANAGE) or user_has_permission(staff, Permission.MEDIA_CATEGORIZE)


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


@router.post("/renumber")
async def renumber_media(
    staff: User = Depends(require_permission(Permission.MEDIA_RESET_IDS)), db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Renumera os IDs do banco de imagens a partir de 1 (so' S.Adm). As imagens ficam na mesma ordem (a mais antiga vira #1); banco VAZIO
    reinicia a contagem em 1. Os arquivos e o conteudo que ja' usa as imagens nao mudam (o conteudo guarda o ENDERECO da imagem, nao o ID).
    So' quem digitou um ID (img:12) e ainda nao salvou perde a referencia: avise a equipe.
    """
    total = (await db.execute(select(func.count()).select_from(MediaImage))).scalar_one()
    if total:
        # 1) joga todos para uma faixa livre (evita colisao de chave), 2) numera 1..N pela ordem antiga, 3) ajusta a sequencia.
        await db.execute(text("UPDATE media_images SET id = id + (SELECT MAX(id) FROM media_images)"))
        await db.execute(text("WITH r AS (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM media_images) "
                              "UPDATE media_images m SET id = r.rn FROM r WHERE m.id = r.id"))
        await db.execute(text("SELECT setval(pg_get_serial_sequence('media_images', 'id'), (SELECT MAX(id) FROM media_images), true)"))
    else:
        await db.execute(text("SELECT setval(pg_get_serial_sequence('media_images', 'id'), 1, false)"))
    await log_action(db, action="renumber", entity_type="media", entity_id="all", diff={"count": total}, actor=staff)
    await db.commit()
    return {"renumbered": total}


@router.get("/{media_id}", response_model=MediaRead)
async def get_media(
    media_id: int, staff: User = Depends(require_permission(Permission.UPLOAD_CREATE)), db: AsyncSession = Depends(get_db),
) -> MediaRead:
    """Uma imagem pelo ID (404 se nao existir)."""
    m = await _get_visible(db, media_id, staff)
    if m is None:
        raise HTTPException(status_code=404, detail=f"Image #{media_id} was not found")
    return _read(m)


@router.post("", response_model=MediaRead, status_code=201)
async def upload_media(
    file: UploadFile = File(...), name: str = Form(default="", max_length=80), category: str = Form(default="", max_length=20),
    staff: User = Depends(require_permission(Permission.MEDIA_UPLOAD)), db: AsyncSession = Depends(get_db),
) -> MediaRead:
    """Envia uma imagem para o banco de imagens (com categoria opcional) e devolve o ID dela. So' quem tem media.upload (padrao: S.Adm)."""
    # Escolher categoria e' de quem tem media.manage ou media.categorize (padrao S.Adm): para os outros a categoria enviada e' ignorada (a imagem entra sem categoria).
    cat = _valid_category(category, staff) if _can_categorize(staff) else ""
    return _read(await store_image(file, staff, db, name, cat))


@router.patch("/{media_id}", response_model=MediaRead)
async def rename_media(
    media_id: int, payload: MediaRename,
    staff: User = Depends(require_any_permission(Permission.MEDIA_MANAGE, Permission.MEDIA_CATEGORIZE)), db: AsyncSession = Depends(get_db),
) -> MediaRead:
    """Muda o nome (exige media.manage) e/ou a categoria (media.manage OU media.categorize) da imagem; o ID e o arquivo nao mudam."""
    if payload.name is not None and not user_has_permission(staff, Permission.MEDIA_MANAGE):
        raise HTTPException(status_code=403, detail="You do not have permission to rename images (only to change their category)")
    m = await _get_visible(db, media_id, staff)
    if m is None:
        raise HTTPException(status_code=404, detail=f"Image #{media_id} was not found")
    diff: dict = {}
    if payload.name is not None:
        new = " ".join("".join(ch if ch.isprintable() else " " for ch in payload.name).split())[:80]
        diff["name"] = {"before": m.name, "after": new}
        m.name = new
    if payload.category is not None:
        cat = _valid_category(payload.category, staff)
        diff["category"] = {"before": m.category, "after": cat}
        m.category = cat
    await log_action(db, action="rename", entity_type="media", entity_id=str(m.id), diff=diff, actor=staff)
    await db.commit()
    await db.refresh(m)
    return _read(m)


@router.post("/bulk-category")
async def bulk_category(
    payload: MediaBulkCategory,
    staff: User = Depends(require_any_permission(Permission.MEDIA_MANAGE, Permission.MEDIA_CATEGORIZE)), db: AsyncSession = Depends(get_db),
) -> dict:
    """Muda a categoria de varias imagens de uma vez ('' tira a categoria). Devolve quantas mudaram."""
    cat = _valid_category(payload.category, staff)
    ids = list(dict.fromkeys(payload.ids))
    await _deny_locked_ids(db, ids, staff)
    rows = (await db.execute(select(MediaImage).where(MediaImage.id.in_(ids)))).scalars().all()
    for m in rows:
        m.category = cat
    if rows:
        await log_action(db, action="bulk-category", entity_type="media", entity_id=",".join(map(str, ids))[:200],
                         diff={"count": len(rows), "category": cat}, actor=staff)
    await db.commit()
    return {"updated": len(rows)}


async def _usage(db: AsyncSession, filename: str) -> list[MediaUse]:
    """Onde o arquivo aparece: campos de imagem e textos ricos (conteudo, blog) - busca pelo nome do arquivo."""
    like = f"%/uploads/{filename}%"
    places = [
        (ContentItem, [ContentItem.image, ContentItem.description, ContentItem.lore, ContentItem.synergy, ContentItem.description_pt, ContentItem.lore_pt, ContentItem.synergy_pt], ContentItem.name, "content"),
        (Post, [Post.cover_image, Post.banner_image, Post.content, Post.content_pt], Post.title, "blog post"),
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
    m = await _get_visible(db, media_id, staff)
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
        m = await _get_visible(db, media_id, staff)
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
    m = await _get_visible(db, media_id, staff)
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
