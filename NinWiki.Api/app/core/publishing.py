"""Travas de rascunho/publicacao compartilhadas por conteudo e posts (a permissao e as mensagens vem de quem chama)."""
from fastapi import HTTPException

from app.core.permissions import Permission, user_has_permission
from app.models.enums import ContentStatus
from app.models.users import User


def guard_publish(staff: User, permission: Permission, new_status: ContentStatus) -> None:
    """Quem nao tem a permissao de publicar nao coloca nada no ar (403)."""
    if new_status == ContentStatus.PUBLISHED and not user_has_permission(staff, permission):
        raise HTTPException(status_code=403, detail="Only an Adm can publish. Save as a draft.")


def guard_edit(staff: User, permission: Permission, current_status: ContentStatus,
               new_status: ContentStatus | None, published_message: str) -> None:
    """Quem nao tem a permissao nao mexe em algo ja' publicado (403) nem o publica; new_status None = so' checa a edicao."""
    if not user_has_permission(staff, permission) and current_status == ContentStatus.PUBLISHED:
        raise HTTPException(status_code=403, detail=published_message)
    if new_status is not None:
        guard_publish(staff, permission, new_status)
