"""
Login e sessao (Fase 2) - Discord OAuth2 + cookie httpOnly.

FLUXO:
  1. Front manda a pessoa pra' GET /auth/discord/login
  2. A API gera um "state" aleatorio (guardado num cookie), manda pro Discord
  3. Discord autentica e volta em GET /auth/discord/callback?code=...&state=...
  4. A API confere o state (anti-CSRF), troca o code por dados da pessoa e
     ve se ela esta' NA EQUIPE (tabela users). Se sim: cria a sessao
     (cookie) e manda pra' /admin. Se nao: volta pro /login com o motivo.
     Ter uma conta do Discord NAO da' acesso nenhum - so' quem foi
     cadastrado (ou e' dono, via .env) entra.

O redirecionamento final vai SEMPRE pra' FRONTEND_ORIGIN fixo do .env
(nunca pra' um endereco vindo da URL) - evita "open redirect".
"""
import hmac
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import discord, staff_service
from app.core.audit import log_action
from app.core.auth import get_current_user, get_optional_user
from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import assignable_roles, user_role_label, visible_permissions_for
from app.core.rate_limit import AUTH, LOGIN_FAIL, client_key, limiter, retry_message
from app.core.reader_auth import get_optional_reader
from app.core.security import (
    RETURN_COOKIE, STATE_COOKIE, clear_reader_cookie, clear_return_cookie, clear_session_cookie, clear_state_cookie,
    create_reader_token, create_session_token, ensure_same_origin, safe_return_path, set_reader_cookie,
    set_return_cookie, set_session_cookie, set_state_cookie,
)
from app.models.readers import Reader
from app.models.users import User
from app.schemas.posts import ReaderMe
from app.schemas.staff import CustomRoleBrief, DevLogin, MeRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _dev_login_enabled() -> bool:
    """True so' se o login de desenvolvimento esta' ligado E o ambiente e' development."""
    return settings.dev_login_enabled and settings.is_development


def _me(user: User) -> MeRead:
    """Monta a resposta de /auth/me: quem esta' logado, cargo, permissoes visiveis e cargos que pode dar."""
    return MeRead(
        id=user.id, discord_id=str(user.discord_id), username=user.username, avatar_url=user.avatar_url,
        role=user.role, role_label=user_role_label(user),
        custom_role=CustomRoleBrief(id=user.custom_role.id, name=user.custom_role.name, color=user.custom_role.color) if user.custom_role else None,
        permissions=visible_permissions_for(user), assignable_roles=assignable_roles(user.role),
    )


def _login_redirect(reason: str, back: str | None = None) -> RedirectResponse:
    """Redireciona de volta com o motivo do erro: para o login da equipe, ou (leitor) para a pagina de onde ele veio."""
    if back is not None:
        sep = "&" if "?" in back else "?"
        resp = RedirectResponse(f"{settings.frontend_origin}{back}{sep}loginError={reason}", status_code=302)
    else:
        resp = RedirectResponse(f"{settings.frontend_origin}/login?error={reason}", status_code=302)
    clear_state_cookie(resp)
    clear_return_cookie(resp)
    return resp


def _reader_me(reader: Reader) -> ReaderMe:
    """Monta a resposta de /auth/reader/me."""
    return ReaderMe(id=reader.id, username=reader.username, avatar_url=reader.avatar_url)


async def _upsert_reader(db: AsyncSession, profile: dict) -> Reader:
    """Cria o leitor na primeira vez, ou atualiza nome/avatar/ultimo login."""
    from sqlalchemy import select
    reader = (await db.execute(select(Reader).where(Reader.discord_id == profile["id"]))).scalar_one_or_none()
    if reader is None:
        reader = Reader(discord_id=profile["id"], username=profile["username"], avatar_url=profile["avatar_url"])
        db.add(reader)
    reader.username, reader.avatar_url = profile["username"], profile["avatar_url"]
    reader.last_login_at = datetime.now(timezone.utc)
    await db.flush()
    return reader


def _too_many_requests() -> int | None:
    """Limite de chamadas de login por minuto (por IP). Devolve segundos de espera se estourou."""
    return limiter.hit(AUTH, client_key(), settings.login_requests_per_minute, 60)


def _fail_window() -> float:
    """Janela (em segundos) em que as falhas de login sao contadas para o bloqueio."""
    return settings.login_fail_window_minutes * 60


def _too_many_failures() -> int | None:
    """Segundos de espera se este IP errou o login vezes demais, ou None se pode tentar."""
    return limiter.blocked(LOGIN_FAIL, client_key(), settings.login_fail_limit, _fail_window())


def _register_failure() -> None:
    """Registra uma falha de login (conta nao cadastrada, state invalido...) para este IP."""
    limiter.fail(LOGIN_FAIL, client_key(), _fail_window())


@router.get("/config")
async def auth_config():
    """O que a tela de login precisa saber pra' decidir quais botoes mostrar."""
    return {"discordEnabled": discord.is_configured(), "devLoginEnabled": _dev_login_enabled()}


@router.get("/discord/login")
async def discord_login(mode: str = "staff", returnTo: str | None = None):
    """
    Inicia o login: gera o state anti-CSRF e redireciona o navegador para o Discord.
    `mode=reader` = login de LEITOR do site (comentar/curtir): volta para `returnTo` (caminho interno) e nao da' acesso ao painel.
    """
    back = safe_return_path(returnTo) if mode == "reader" else None
    if _too_many_requests() is not None:
        return _login_redirect("rate_limited", back)
    if not discord.is_configured():
        return _login_redirect("discord_not_configured", back)
    state = secrets.token_urlsafe(32)
    resp = RedirectResponse(discord.build_authorize_url(state), status_code=302)
    set_state_cookie(resp, state)
    if back is not None:
        set_return_cookie(resp, f"reader|{back}")
    else:
        clear_return_cookie(resp)
    return resp


@router.get("/discord/callback")
async def discord_callback(
    request: Request, code: str | None = None, state: str | None = None,
    error: str | None = None, db: AsyncSession = Depends(get_db),
):
    """Volta do Discord: confere o state, troca o code pelo perfil, valida se e' staff ativa e cria a sessao."""
    # Login de leitor ou de equipe? O cookie de retorno foi gravado em /discord/login.
    ret = request.cookies.get(RETURN_COOKIE, "")
    back = safe_return_path(ret.split("|", 1)[1]) if ret.startswith("reader|") else None

    # Freio ANTES de qualquer trabalho (Discord, banco, log): quem ja' errou demais nem chega la'.
    if _too_many_requests() is not None or _too_many_failures() is not None:
        return _login_redirect("rate_limited", back)

    if error:
        return _login_redirect("discord_denied", back)

    cookie_state = request.cookies.get(STATE_COOKIE)
    if not code or not state or not cookie_state or not hmac.compare_digest(state.encode(), cookie_state.encode()):
        _register_failure()
        return _login_redirect("invalid_state", back)

    try:
        access_token = await discord.exchange_code(code)
        profile = await discord.fetch_profile(access_token)
    except discord.DiscordError:
        return _login_redirect("discord_failed", back)

    if back is not None:  # leitor: so' prova quem e' (nao consulta a equipe nem abre o painel)
        reader = await _upsert_reader(db, profile)
        if reader.banned:
            await db.commit()
            return _login_redirect("banned", back)
        await db.commit()
        resp = RedirectResponse(f"{settings.frontend_origin}{back}", status_code=302)
        set_reader_cookie(resp, create_reader_token(str(reader.id)))
        clear_state_cookie(resp)
        clear_return_cookie(resp)
        return resp

    user = await staff_service.ensure_owner_account(db, profile["id"], profile["username"], profile["avatar_url"])
    if user is None:
        user = await staff_service.get_by_discord_id(db, profile["id"])

    if user is None or not user.is_active:
        _register_failure()
        await log_action(
            db, action="login_denied", entity_type="auth", entity_id=str(profile["id"]),
            diff={"username": profile["username"], "reason": "inactive" if user else "not_staff"}, source="auth",
        )
        await db.commit()
        return _login_redirect("inactive" if user else "not_staff")

    # 2FA do Discord obrigatorio para entrar no painel (REQUIRE_DISCORD_2FA). So' recusa quando o Discord disse claramente que NAO tem 2FA.
    if settings.require_discord_2fa and profile.get("mfa_enabled") is False:
        await log_action(
            db, action="login_denied", entity_type="auth", entity_id=str(profile["id"]),
            diff={"username": profile["username"], "reason": "no_2fa"}, actor=user, source="auth",
        )
        await db.commit()
        return _login_redirect("mfa_required")

    if not user.username_locked:  # nome escolhido a mao no painel nao e' sobrescrito pelo do Discord
        user.username = profile["username"]
    user.avatar_url = profile["avatar_url"]
    user.last_login_at = datetime.now(timezone.utc)
    await log_action(db, action="login", entity_type="auth", entity_id=str(user.discord_id), actor=user, source="auth")
    await db.commit()

    resp = RedirectResponse(f"{settings.frontend_origin}/admin", status_code=302)
    set_session_cookie(resp, create_session_token(user))
    clear_state_cookie(resp)
    return resp


@router.post("/dev-login", response_model=MeRead)
async def dev_login(payload: DevLogin, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Entra so' com o Discord ID, SEM Discord - so' pra' testar localmente
    (ver dev_login_enabled em app/core/config.py). Continua exigindo que a
    pessoa esteja cadastrada na equipe (ou seja dona via .env).
    """
    if not _dev_login_enabled():
        raise HTTPException(status_code=404, detail="Not Found")
    ensure_same_origin(request)
    wait = _too_many_requests() or _too_many_failures()
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    discord_id = int(payload.discord_id)
    user = await staff_service.ensure_owner_account(db, discord_id, f"Dev {discord_id}", None)
    if user is None:
        user = await staff_service.get_by_discord_id(db, discord_id)
    if user is None or not user.is_active:
        _register_failure()
        raise HTTPException(status_code=403, detail="This Discord ID is not registered on the team (or is deactivated)")
    user.last_login_at = datetime.now(timezone.utc)
    await log_action(db, action="login", entity_type="auth", entity_id=str(user.discord_id),
                     diff={"dev_login": True}, actor=user, source="auth")
    await db.commit()
    set_session_cookie(response, create_session_token(user))
    return _me(user)


@router.get("/reader/me", response_model=ReaderMe | None)
async def reader_me(reader: Reader | None = Depends(get_optional_reader)):
    """O leitor logado agora (ou null) - o site usa para mostrar 'Entrar com Discord' ou o avatar."""
    return _reader_me(reader) if reader else None


@router.post("/reader/logout")
async def reader_logout(response: Response):
    """Sai da conta de leitor (apaga so' o cookie dele; a sessao da equipe, se houver, continua)."""
    clear_reader_cookie(response)
    return {"ok": True}


@router.post("/reader/dev-login", response_model=ReaderMe)
async def reader_dev_login(payload: DevLogin, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Entra como leitor so' com um Discord ID, SEM Discord - so' para testar localmente (ver dev_login_enabled)."""
    if not _dev_login_enabled():
        raise HTTPException(status_code=404, detail="Not Found")
    ensure_same_origin(request)
    wait = _too_many_requests()
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    discord_id = int(payload.discord_id)
    reader = await _upsert_reader(db, {"id": discord_id, "username": f"Reader {discord_id}", "avatar_url": None})
    if reader.banned:
        await db.commit()
        raise HTTPException(status_code=403, detail="This account is banned")
    await db.commit()
    set_reader_cookie(response, create_reader_token(str(reader.id)))
    return _reader_me(reader)


@router.post("/logout")
async def logout(request: Request, response: Response, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    """Encerra a sessao: apaga o cookie, invalida o token (token_version; um cookie copiado deixa de valer, e o passe de manutencao tambem) e registra a saida."""
    ensure_same_origin(request)   # sem isso, com COOKIE_SAMESITE=none um site qualquer poderia deslogar a equipe
    if user is not None:
        # efeito colateral: derruba tambem as sessoes dessa pessoa em outros aparelhos; soma feita no banco (atomica)
        await db.execute(sa_update(User).where(User.id == user.id).values(token_version=User.token_version + 1))
        await log_action(db, action="logout", entity_type="auth", entity_id=str(user.discord_id), actor=user, source="auth")
        await db.commit()
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=MeRead)
async def me(user: User = Depends(get_current_user)):
    """Quem esta' logado agora (usado pelo painel para montar menu e telas)."""
    return _me(user)
