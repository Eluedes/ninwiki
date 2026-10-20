"""
Dependencias de autenticacao e permissao - o que todo endpoint protegido usa.

Exemplos:
    # so' quem tem a permissao entra; devolve o usuario logado
    staff: User = Depends(require_permission(Permission.CONTENT_DELETE))

    # rota publica que se comporta diferente pra' quem e' staff
    user: User | None = Depends(get_optional_user)
"""
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.database import AsyncSessionLocal, get_db
from app.core import role_config
from app.core.permissions import SUPER_ONLY_PERMISSIONS, Permission, user_has_permission
from app.core.security import SESSION_COOKIE, current_user_var, ensure_same_origin, read_session_token
from app.models.users import User

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    """
    Quem esta' logado (staff ativa), ou None. Nunca lanca erro - usado em
    rotas publicas (ex: o site so' mostra rascunho pra' quem e' staff).

    A cada requisicao confere NO BANCO: a pessoa ainda existe, ainda esta'
    ativa e a "versao" da sessao bate - assim desativar alguem ou trocar
    o cargo dela derruba o acesso imediatamente.
    """
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    data = read_session_token(token)
    if data is None:
        return None
    try:
        user_id = UUID(str(data["sub"]))
    except ValueError:
        return None
    user = await db.get(User, user_id)
    if user is None or not user.is_active or user.token_version != data.get("ver"):
        return None
    # Ajustes de permissao por cargo feitos no painel (relê o banco a cada ~15s no maximo).
    await role_config.refresh_if_stale(db)
    if request.method in _UNSAFE_METHODS:
        ensure_same_origin(request)
    return user


async def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    """Exige login: devolve o usuario logado ou responde 401."""
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    current_user_var.set(user)   # disponivel para checagens fora do handler (ver core/media_refs.py)
    return user


async def _log_denied(user: User, request: Request, missing: list[Permission], hidden: bool) -> None:
    """
    Registra uma tentativa negada. Usa uma sessao PROPRIA (com commit
    proprio): a requisicao vai terminar em erro, e o rollback dela nao
    pode levar o registro da tentativa junto. Falhar aqui nunca pode
    esconder o 403 de verdade.
    """
    try:
        async with AsyncSessionLocal() as session:
            await log_action(
                session, action="permission_denied", entity_type="security",
                entity_id=request.url.path,
                diff={"method": request.method, "missing": [p.value for p in missing], "hidden": hidden},
                actor=user, source="panel",
            )
            await session.commit()
    except Exception:  # noqa: BLE001 - log de seguranca nunca pode derrubar a resposta
        pass


def require_any_permission(*permissions: Permission):
    """Exige PELO MENOS UMA das permissoes (ex.: mudar categoria de imagem: media.manage OU media.categorize). Sem nenhuma: 403 e registra no log."""

    async def dependency(request: Request, user: User = Depends(get_current_user)) -> User:
        """A checagem em si."""
        if not any(user_has_permission(user, p) for p in permissions):
            await _log_denied(user, request, list(permissions), False)
            raise HTTPException(status_code=403, detail="You do not have permission to do this")
        return user

    return dependency


def require_permission(*permissions: Permission):
    """
    Exige TODAS as permissoes listadas. Sem permissao:
      - permissao comum        -> 403 "sem permissao" (e registra no log)
      - permissao SUPER_ONLY   -> 404, como se a rota nem existisse (o
                                  S.Adm e' o unico que sabe dessas rotas)
    """
    hidden = any(p in SUPER_ONLY_PERMISSIONS for p in permissions)

    async def dependency(request: Request, user: User = Depends(get_current_user)) -> User:
        """A checagem em si: sem a permissao exigida, 403 (ou 404 se for exclusiva do S.Adm) e registra a tentativa."""
        missing = [p for p in permissions if not user_has_permission(user, p)]
        if missing:
            await _log_denied(user, request, missing, hidden)
            if hidden:
                raise HTTPException(status_code=404, detail="Not Found")
            raise HTTPException(status_code=403, detail="You do not have permission to do this")
        return user

    return dependency
