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
from app.core.permissions import SUPER_ONLY_PERMISSIONS, Permission, has_permission
from app.core.security import SESSION_COOKIE, ensure_same_origin, read_session_token
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
    if user is None:
        raise HTTPException(status_code=401, detail="Não autenticado")
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


def require_permission(*permissions: Permission):
    """
    Exige TODAS as permissoes listadas. Sem permissao:
      - permissao comum        -> 403 "sem permissao" (e registra no log)
      - permissao SUPER_ONLY   -> 404, como se a rota nem existisse (o
                                  S.Adm e' o unico que sabe dessas rotas)
    """
    hidden = any(p in SUPER_ONLY_PERMISSIONS for p in permissions)

    async def dependency(request: Request, user: User = Depends(get_current_user)) -> User:
        missing = [p for p in permissions if not has_permission(user.role, p)]
        if missing:
            await _log_denied(user, request, missing, hidden)
            if hidden:
                raise HTTPException(status_code=404, detail="Not Found")
            raise HTTPException(status_code=403, detail="Você não tem permissão para fazer isso")
        return user

    return dependency
