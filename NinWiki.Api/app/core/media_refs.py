"""
Referencia de imagem por ID: nos campos de imagem (conteudo, jutsu, mastery, vila, cla', capa do blog...) a equipe pode digitar o ID da imagem
no banco de imagens em vez do endereco - `img:12`, `#12` ou so' `12`. A API troca pelo endereco do arquivo AO SALVAR (se o ID nao existir, 422).
"""
import re

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import is_category_locked
from app.core.security import current_user_var
from app.models.media import MediaImage

# Aviso mostrado a quem tenta ver/usar uma imagem de categoria TRANCADA para ele ("closed" so' S.Adm, ou trancada por cargo): ID chutado, busca por nome, campos de imagem.
CLOSED_MESSAGE = "Access denied: this image is in a closed (restricted) category and you are not allowed to view it."

REF_RE = re.compile(r"^\s*(?:img\s*[:\-_ ]\s*|id\s*:\s*|#\s*)?(\d{1,9})\s*$", re.IGNORECASE)
IMAGE_FIELDS = frozenset({"image", "gif", "cover_image"})


def parse_ref(value: str | None) -> int | None:
    """O ID de imagem escrito em `value` (`img:12`, `#12`, `12`...), ou None se for outra coisa (um endereco, por exemplo)."""
    if not value:
        return None
    m = REF_RE.match(value)
    return int(m.group(1)) if m else None


def media_url(filename: str) -> str:
    """Endereco publico de um arquivo do banco de imagens."""
    return f"{settings.api_base_url.rstrip('/')}/uploads/{filename}"


async def resolve_value(db: AsyncSession, value: str | None) -> str | None:
    """Troca `img:12` pelo endereco da imagem #12; qualquer outro valor passa igual. ID inexistente = 422."""
    ref = parse_ref(value)
    if ref is None:
        return value
    media = await db.get(MediaImage, ref)
    if media is None:
        raise HTTPException(status_code=422, detail=f"Image #{ref} was not found in the image library")
    user = current_user_var.get()
    if user is None or is_category_locked(user, media.category):
        raise HTTPException(status_code=403, detail=CLOSED_MESSAGE)   # categoria trancada: nem usando o ID em um campo de imagem
    return media_url(media.filename)


async def resolve_images(db: AsyncSession, payload: object) -> None:
    """Percorre um corpo (Pydantic) e troca, nos campos de imagem (image, gif, cover_image), os IDs de imagem pelos enderecos - inclusive dentro de listas (cla's)."""
    if isinstance(payload, BaseModel):
        for name in type(payload).model_fields:
            value = getattr(payload, name)
            if name in IMAGE_FIELDS and isinstance(value, str):
                setattr(payload, name, await resolve_value(db, value))
            elif isinstance(value, (BaseModel, list)):
                await resolve_images(db, value)
    elif isinstance(payload, list):
        for item in payload:
            await resolve_images(db, item)
