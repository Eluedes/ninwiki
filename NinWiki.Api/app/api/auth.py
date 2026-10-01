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
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import discord, staff_service
from app.core.audit import log_action
from app.core.auth import get_current_user, get_optional_user
from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import ROLE_LABEL, assignable_roles, visible_permissions_of
from app.core.rate_limit import AUTH, LOGIN_FAIL, client_key, limiter, retry_message
from app.core.security import (
    STATE_COOKIE, clear_session_cookie, clear_state_cookie, create_session_token,
    ensure_same_origin, set_session_cookie, set_state_cookie,
)
from app.models.users import User
from app.schemas.staff import DevLogin, MeRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _dev_login_enabled() -> bool:
    return settings.dev_login_enabled and settings.is_development


def _me(user: User) -> MeRead:
    return MeRead(
        id=user.id, discord_id=str(user.discord_id), username=user.username, avatar_url=user.avatar_url,
        role=user.role, role_label=ROLE_LABEL[user.role],
        permissions=visible_permissions_of(user.role), assignable_roles=assignable_roles(user.role),
    )


def _login_redirect(reason: str) -> RedirectResponse:
    resp = RedirectResponse(f"{settings.frontend_origin}/login?error={reason}", status_code=302)
    clear_state_cookie(resp)
    return resp


def _too_many_requests() -> int | None:
    """Limite de chamadas de login por minuto (por IP). Devolve segundos de espera se estourou."""
    return limiter.hit(AUTH, client_key(), settings.login_requests_per_minute, 60)


def _fail_window() -> float:
    return settings.login_fail_window_minutes * 60


def _too_many_failures() -> int | None:
    return limiter.blocked(LOGIN_FAIL, client_key(), settings.login_fail_limit, _fail_window())


def _register_failure() -> None:
    limiter.fail(LOGIN_FAIL, client_key(), _fail_window())


@router.get("/config")
async def auth_config():
    """O que a tela de login precisa saber pra' decidir quais botoes mostrar."""
    return {"discordEnabled": discord.is_configured(), "devLoginEnabled": _dev_login_enabled()}


@router.get("/discord/login")
async def discord_login():
    if _too_many_requests() is not None:
        return _login_redirect("rate_limited")
    if not discord.is_configured():
        return _login_redirect("discord_not_configured")
    state = secrets.token_urlsafe(32)
    resp = RedirectResponse(discord.build_authorize_url(state), status_code=302)
    set_state_cookie(resp, state)
    return resp


@router.get("/discord/callback")
async def discord_callback(
    request: Request, code: str | None = None, state: str | None = None,
    error: str | None = None, db: AsyncSession = Depends(get_db),
):
    # Freio ANTES de qualquer trabalho (Discord, banco, log): quem ja' errou demais nem chega la'.
    if _too_many_requests() is not None or _too_many_failures() is not None:
        return _login_redirect("rate_limited")

    if error:
        return _login_redirect("discord_denied")

    cookie_state = request.cookies.get(STATE_COOKIE)
    if not code or not state or not cookie_state or not hmac.compare_digest(state, cookie_state):
        _register_failure()
        return _login_redirect("invalid_state")

    try:
        access_token = await discord.exchange_code(code)
        profile = await discord.fetch_profile(access_token)
    except discord.DiscordError:
        return _login_redirect("discord_failed")

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
        raise HTTPException(status_code=403, detail="Este Discord ID não está cadastrado na equipe (ou está desativado)")
    user.last_login_at = datetime.now(timezone.utc)
    await log_action(db, action="login", entity_type="auth", entity_id=str(user.discord_id),
                     diff={"dev_login": True}, actor=user, source="auth")
    await db.commit()
    set_session_cookie(response, create_session_token(user))
    return _me(user)


@router.post("/logout")
async def logout(response: Response, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    if user is not None:
        await log_action(db, action="logout", entity_type="auth", entity_id=str(user.discord_id), actor=user, source="auth")
        await db.commit()
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=MeRead)
async def me(user: User = Depends(get_current_user)):
    return _me(user)
