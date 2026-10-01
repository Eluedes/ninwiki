"""
Sessao do painel (Fase 2): JWT dentro de um cookie httpOnly, protecao
contra CSRF e captura do IP de quem chama (pro log).

POR QUE COOKIE httpOnly E NAO localStorage: um cookie httpOnly NAO pode
ser lido por JavaScript da pagina - se algum dia houver uma falha XSS no
site, o atacante nao consegue roubar a sessao (com localStorage, consegue).
O navegador anexa o cookie sozinho em toda chamada a' API.

O JWT carrega so' 3 coisas: quem e' (sub), qual "versao" da sessao (ver)
e quando expira (exp). NAO carrega o cargo: o cargo e' lido do BANCO a
cada requisicao (ver app/core/auth.py), entao uma promocao, rebaixamento
ou desativacao vale NA HORA - nao precisa esperar o token expirar.
"""
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request, Response

from app.core.config import settings
from app.models.users import User

SESSION_COOKIE = "ninwiki_session"
READER_COOKIE = "ninwiki_reader"      # sessao do LEITOR do site (comenta/curte) - separada da sessao da equipe
RETURN_COOKIE = "ninwiki_return"      # pagina para onde o leitor volta depois do login com o Discord
READER_SESSION_DAYS = 14
STATE_COOKIE = "ninwiki_oauth_state"  # guarda o "state" do OAuth2 (anti-CSRF do login)

# IP de quem esta' chamando, visivel pra' qualquer codigo dentro da mesma
# requisicao (o log_action le' daqui, sem precisar passar Request pra' todo lado).
client_ip_var: ContextVar[str | None] = ContextVar("client_ip", default=None)


def create_session_token(user: User) -> str:
    """Gera o JWT da sessao (quem, versao da sessao e validade)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "ver": user.token_version,
        "iat": now,
        "exp": now + timedelta(hours=settings.session_hours),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_reader_token(reader_id: str) -> str:
    """JWT da sessao de um LEITOR (typ="reader"): nao serve como sessao da equipe e vice-versa."""
    now = datetime.now(timezone.utc)
    payload = {"sub": reader_id, "typ": "reader", "ver": 0, "iat": now, "exp": now + timedelta(days=READER_SESSION_DAYS)}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def read_session_token(token: str, typ: str | None = None) -> dict | None:
    """
    Devolve os dados do token, ou None se for invalido/expirado/forjado (nunca lanca). `typ` e' o TIPO esperado:
    None = sessao da equipe (token de leitor e' recusado aqui) e "reader" = sessao de leitor (token da equipe e' recusado).
    """
    try:
        data = jwt.decode(
            token,
            settings.jwt_secret_key,
            # SEMPRE fixar a lista de algoritmos: aceitar o que o proprio
            # token disser abre a brecha classica do "alg: none".
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "ver"]},
        )
    except jwt.PyJWTError:
        return None
    return data if data.get("typ") == typ else None


def set_session_cookie(response: Response, token: str) -> None:
    """Grava o cookie de sessao: httpOnly, SameSite=Lax e Secure fora do local."""
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=settings.session_hours * 3600,
        httponly=True,                 # JavaScript nao le' esse cookie
        secure=settings.cookie_secure,  # so' HTTPS fora do ambiente local
        samesite="lax",                # nao vai em POST vindo de outro site (defesa CSRF)
        path="/",
    )


def set_reader_cookie(response: Response, token: str) -> None:
    """Grava o cookie de sessao do leitor (httpOnly, SameSite=Lax, Secure fora do local)."""
    response.set_cookie(
        READER_COOKIE, token, max_age=READER_SESSION_DAYS * 86400,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/",
    )


def clear_reader_cookie(response: Response) -> None:
    """Apaga o cookie de sessao do leitor (sair)."""
    response.delete_cookie(READER_COOKIE, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")


def set_return_cookie(response: Response, value: str) -> None:
    """Guarda por 10 min "reader|/pagina" (login de leitor e a pagina de volta) durante o vai-e-volta com o Discord."""
    response.set_cookie(RETURN_COOKIE, value, max_age=600, httponly=True, secure=settings.cookie_secure, samesite="lax", path="/")


def clear_return_cookie(response: Response) -> None:
    """Apaga o cookie de retorno do login."""
    response.delete_cookie(RETURN_COOKIE, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")


def safe_return_path(path: str | None) -> str:
    """So' aceita caminho interno do site ("/blog/x"); qualquer outra coisa (URL externa, "//", "\\") vira "/blog" - evita open redirect."""
    if not path or not path.startswith("/") or path.startswith("//") or "\\" in path or len(path) > 200 or any(ord(c) < 32 for c in path):
        return "/blog"
    return path


def clear_session_cookie(response: Response) -> None:
    """Apaga o cookie de sessao (logout)."""
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")


def set_state_cookie(response: Response, state: str) -> None:
    """Grava o cookie do 'state' do login (anti-CSRF do OAuth), valido por 10 minutos."""
    response.set_cookie(
        STATE_COOKIE, state, max_age=600, httponly=True,
        secure=settings.cookie_secure, samesite="lax", path="/",
    )


def clear_state_cookie(response: Response) -> None:
    """Apaga o cookie do 'state' do login."""
    response.delete_cookie(STATE_COOKIE, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")


def ensure_same_origin(request: Request) -> None:
    """
    Defesa CSRF extra pra' requisicoes que MUDAM dado: se o navegador
    mandou o header Origin, ele tem que ser exatamente o nosso front.
    (Uma pagina maliciosa mandando um POST em nome da pessoa logada
    sempre carrega o Origin dela - e e' barrada aqui. Cliente que nao e'
    navegador nao manda Origin e nao e' vetor de CSRF.)
    """
    origin = request.headers.get("origin")
    if origin is not None and origin != settings.frontend_origin:
        raise HTTPException(status_code=403, detail="Origin not allowed")


def _resolve_client_ip(scope: dict) -> str | None:
    """
    IP de quem fez a requisicao. Com TRUST_PROXY_HEADERS=true (API atras de Cloudflare/SquareCloud) usa
    CF-Connecting-IP e, se nao houver, o ULTIMO valor de X-Forwarded-For - esse e' o que o proxy mais
    proximo anexou (o que vem antes pode ter sido forjado pelo cliente). Sem a flag, usa so' o IP da conexao.
    """
    if settings.trust_proxy_headers:
        headers = dict(scope.get("headers", []))
        cf = headers.get(b"cf-connecting-ip")
        if cf:
            return cf.decode("latin-1").strip()[:45]
        forwarded = headers.get(b"x-forwarded-for")
        if forwarded:
            last = forwarded.decode("latin-1").split(",")[-1].strip()
            if last:
                return last[:45]
    client = scope.get("client")
    return client[0][:45] if client else None


class ClientIPMiddleware:
    """Middleware ASGI puro: grava o IP da requisicao em client_ip_var durante ela."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        token = client_ip_var.set(_resolve_client_ip(scope))
        try:
            await self.app(scope, receive, send)
        finally:
            client_ip_var.reset(token)
