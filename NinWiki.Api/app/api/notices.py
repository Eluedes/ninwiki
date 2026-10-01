"""
Quadro de avisos da equipe (aparece na Visao Geral do painel).

  GET    /notices                       lista (fixados primeiro)         notices.view
  POST   /notices                       posta um aviso                    notices.manage
  PUT    /notices/{id}                  edita                              notices.manage
  DELETE /notices/{id}                  apaga (e apaga os arquivos)        notices.manage
  POST   /notices/{id}/files            anexa um arquivo (multipart)       notices.manage
  DELETE /notices/{id}/files/{file_id}  remove um anexo                    notices.manage
  GET    /notices/files/{file_id}       baixa o arquivo                    notices.view

Os arquivos NAO ficam na pasta publica uploads/: ficam em staff_files/ e so' saem por este
endpoint, que exige login. Sao sempre entregues como DOWNLOAD (nunca abertos no navegador),
com o nome gravado em disco aleatorio - o nome original so' aparece no download.
"""
import re
import secrets
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.notices import Notice, NoticeFile
from app.models.users import User
from app.schemas.roles import NoticeRead, NoticeWrite

router = APIRouter(prefix="/notices", tags=["notices"])

FILES_DIR = Path(__file__).resolve().parent.parent.parent / "staff_files"
FILES_DIR.mkdir(exist_ok=True)

MAX_FILES_PER_NOTICE = 10
# Compactados aceitos de proposito (a equipe troca pacotes de arquivos): .zip, .rar e .7z. Para esses, a ASSINATURA
# dos primeiros bytes tem que bater com a extensao - um .exe renomeado para .zip e' recusado. O download e' sempre
# como anexo (nunca abre/executa no navegador); o conteudo de dentro e' responsabilidade de quem baixa (antivirus!).
ARCHIVE_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".zip": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".rar": (b"Rar!\x1a\x07\x00", b"Rar!\x1a\x07\x01\x00"),
    ".7z": (b"7z\xbc\xaf\x27\x1c",),
}
# Tipos que executam codigo ou renderizam HTML/script - nunca aceitos como anexo.
BLOCKED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".com", ".scr", ".msi", ".dll", ".js", ".mjs", ".vbs", ".ps1", ".sh",
    ".jar", ".html", ".htm", ".svg", ".xhtml", ".php", ".py", ".apk", ".lnk", ".reg",
}


def _safe_filename(name: str | None) -> str:
    """So' o nome (sem pasta), sem caracteres de controle, com no maximo 150 chars."""
    base = (name or "arquivo").replace("\\", "/").split("/")[-1]
    base = re.sub(r"[\x00-\x1f\x7f\"<>|:*?]", "_", base).strip(" .") or "arquivo"
    stem, dot, ext = base.rpartition(".")
    if len(base) > 150:
        base = (stem[: 150 - len(ext) - 1] + "." + ext) if dot else base[:150]
    return base


async def _load(db: AsyncSession, notice_id: UUID) -> Notice:
    """Carrega um aviso com seus arquivos ou responde 404."""
    stmt = select(Notice).where(Notice.id == notice_id).options(selectinload(Notice.files))
    notice = (await db.execute(stmt)).scalar_one_or_none()
    if notice is None:
        raise HTTPException(status_code=404, detail="Notice not found")
    return notice


def _remove_from_disk(stored_names: list[str]) -> None:
    """Apaga do disco os arquivos (pelo nome interno) - usado ao apagar aviso/anexo."""
    for name in stored_names:
        (FILES_DIR / name).unlink(missing_ok=True)


@router.get("", response_model=list[NoticeRead])
async def list_notices(
    staff: User = Depends(require_permission(Permission.NOTICE_VIEW)), db: AsyncSession = Depends(get_db),
):
    """Lista os avisos (fixados primeiro) com os arquivos anexados."""
    stmt = select(Notice).options(selectinload(Notice.files)).order_by(Notice.pinned.desc(), Notice.created_at.desc())
    return (await db.execute(stmt)).scalars().all()


@router.post("", response_model=NoticeRead, status_code=201)
async def create_notice(
    payload: NoticeWrite,
    staff: User = Depends(require_permission(Permission.NOTICE_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Posta um aviso novo (exige notices.manage)."""
    notice = Notice(title=payload.title.strip(), body=payload.body, pinned=payload.pinned,
                    author_id=staff.id, author_name=staff.username)
    db.add(notice)
    await db.flush()
    await log_action(db, action="create", entity_type="notice", entity_id=str(notice.id),
                     diff={"title": notice.title}, actor=staff)
    await db.commit()
    return await _load(db, notice.id)


@router.put("/{notice_id}", response_model=NoticeRead)
async def update_notice(
    notice_id: UUID, payload: NoticeWrite,
    staff: User = Depends(require_permission(Permission.NOTICE_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Edita titulo, mensagem e 'fixado' de um aviso."""
    notice = await _load(db, notice_id)
    notice.title, notice.body, notice.pinned = payload.title.strip(), payload.body, payload.pinned
    await log_action(db, action="update", entity_type="notice", entity_id=str(notice.id),
                     diff={"title": notice.title}, actor=staff)
    await db.commit()
    db.expire_all()
    return await _load(db, notice_id)


@router.delete("/{notice_id}", status_code=204)
async def delete_notice(
    notice_id: UUID,
    staff: User = Depends(require_permission(Permission.NOTICE_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Apaga o aviso e todos os arquivos dele (do banco e do disco)."""
    notice = await _load(db, notice_id)
    stored = [f.stored_name for f in notice.files]
    title = notice.title
    await db.delete(notice)  # anexos saem junto (cascade)
    await log_action(db, action="delete", entity_type="notice", entity_id=str(notice_id),
                     diff={"title": title, "files": len(stored)}, actor=staff)
    await db.commit()
    _remove_from_disk(stored)


@router.post("/{notice_id}/files", response_model=NoticeRead, status_code=201)
async def add_file(
    notice_id: UUID, file: UploadFile,
    staff: User = Depends(require_permission(Permission.NOTICE_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Anexa um arquivo ao aviso: valida tipo, tamanho e quantidade e grava com nome aleatorio."""
    notice = await _load(db, notice_id)
    if len(notice.files) >= MAX_FILES_PER_NOTICE:
        raise HTTPException(status_code=400, detail=f"Maximum of {MAX_FILES_PER_NOTICE} files per notice")
    filename = _safe_filename(file.filename)
    if Path(filename).suffix.lower() in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="This file type is not allowed as an attachment")
    max_bytes = settings.max_notice_file_mb * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File larger than {settings.max_notice_file_mb}MB")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    signatures = ARCHIVE_SIGNATURES.get(Path(filename).suffix.lower())
    if signatures and not content.startswith(signatures):
        raise HTTPException(status_code=415, detail="This file is not a valid archive (the content does not match its extension)")

    stored = secrets.token_hex(16)
    (FILES_DIR / stored).write_bytes(content)
    notice.files.append(NoticeFile(filename=filename, stored_name=stored, size=len(content)))
    await log_action(db, action="upload", entity_type="notice", entity_id=str(notice.id),
                     diff={"file": filename, "bytes": len(content)}, actor=staff)
    try:
        await db.commit()
    except Exception:
        (FILES_DIR / stored).unlink(missing_ok=True)
        raise
    db.expire_all()
    return await _load(db, notice_id)


@router.delete("/{notice_id}/files/{file_id}", response_model=NoticeRead)
async def remove_file(
    notice_id: UUID, file_id: UUID,
    staff: User = Depends(require_permission(Permission.NOTICE_MANAGE)), db: AsyncSession = Depends(get_db),
):
    """Remove um anexo do aviso (banco e disco)."""
    notice = await _load(db, notice_id)
    target = next((f for f in notice.files if f.id == file_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="File not found")
    stored, name = target.stored_name, target.filename
    notice.files.remove(target)
    await log_action(db, action="delete_file", entity_type="notice", entity_id=str(notice.id),
                     diff={"file": name}, actor=staff)
    await db.commit()
    _remove_from_disk([stored])
    db.expire_all()
    return await _load(db, notice_id)


@router.get("/files/{file_id}")
async def download_file(
    file_id: UUID,
    staff: User = Depends(require_permission(Permission.NOTICE_VIEW)), db: AsyncSession = Depends(get_db),
):
    """Baixa um anexo (exige login): sempre como download, nunca abre no navegador."""
    nf = await db.get(NoticeFile, file_id)
    path = FILES_DIR / nf.stored_name if nf else None
    if nf is None or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path, filename=nf.filename, media_type="application/octet-stream",
        content_disposition_type="attachment", headers={"X-Content-Type-Options": "nosniff"},
    )
