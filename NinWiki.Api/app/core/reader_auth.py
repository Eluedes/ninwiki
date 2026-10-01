"""
Dependencias de autenticacao do LEITOR do site (quem comenta e curte posts).

Separado de app/core/auth.py (equipe) de proposito: cookie proprio, JWT com typ="reader" e tabela propria. Um leitor
NUNCA ganha acesso ao painel, e um membro da equipe que quiser comentar entra tambem como leitor (sao duas sessoes).
A cada requisicao confere no banco se o leitor ainda existe e NAO esta' banido - banir derruba a sessao na hora.
"""
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import READER_COOKIE, ensure_same_origin, read_session_token
from app.models.readers import Reader

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def get_optional_reader(request: Request, db: AsyncSession = Depends(get_db)) -> Reader | None:
    """O leitor logado (nao banido) ou None. Nunca lanca erro; em metodos que gravam, confere a origem (CSRF)."""
    token = request.cookies.get(READER_COOKIE)
    data = read_session_token(token, typ="reader") if token else None
    if data is None:
        return None
    try:
        reader = await db.get(Reader, UUID(str(data["sub"])))
    except ValueError:
        return None
    if reader is None or reader.banned:
        return None
    if request.method in _UNSAFE_METHODS:
        ensure_same_origin(request)
    return reader


async def get_current_reader(reader: Reader | None = Depends(get_optional_reader)) -> Reader:
    """Exige leitor logado: devolve-o ou responde 401."""
    if reader is None:
        raise HTTPException(status_code=401, detail="Sign in with Discord to do this")
    return reader
