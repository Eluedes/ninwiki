"""
Conversa com a API do Discord (OAuth2). Isolado num arquivo so' pra
ficar facil de trocar/mockar em teste - o resto do sistema nunca chama
o Discord diretamente.

Escopo pedido: SO' "identify" (id, nome e avatar). Nao pedimos e-mail,
lista de servidores nem nada alem do necessario pra' saber QUEM e'.
"""
import httpx

from app.core.config import settings

_DISCORD_API = "https://discord.com/api/v10"
AUTHORIZE_URL = "https://discord.com/oauth2/authorize"


class DiscordError(Exception):
    """Falha ao falar com o Discord (rede, codigo invalido, resposta estranha)."""


def is_configured() -> bool:
    """True se CLIENT_ID e CLIENT_SECRET do Discord estao preenchidos."""
    return bool(settings.discord_client_id and settings.discord_client_secret)


def build_authorize_url(state: str) -> str:
    """Monta o link para o qual mandamos a pessoa autorizar o login no Discord."""
    from urllib.parse import urlencode
    return AUTHORIZE_URL + "?" + urlencode({
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.effective_discord_redirect_uri,
        "response_type": "code",
        "scope": "identify",
        "state": state,
        "prompt": "none",
    })


async def exchange_code(code: str) -> str:
    """Troca o `code` (que o Discord devolveu no callback) por um access_token."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                f"{_DISCORD_API}/oauth2/token",
                data={
                    "client_id": settings.discord_client_id,
                    "client_secret": settings.discord_client_secret,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.effective_discord_redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        res.raise_for_status()
        return res.json()["access_token"]
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise DiscordError(f"troca de code falhou: {type(e).__name__}") from e


async def fetch_profile(access_token: str) -> dict:
    """Devolve {"id": int, "username": str, "avatar_url": str | None}."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{_DISCORD_API}/users/@me", headers={"Authorization": f"Bearer {access_token}"})
        res.raise_for_status()
        data = res.json()
        discord_id = int(data["id"])
    except (httpx.HTTPError, KeyError, ValueError) as e:
        raise DiscordError(f"leitura do perfil falhou: {type(e).__name__}") from e
    avatar = data.get("avatar")
    return {
        "id": discord_id,
        "username": (data.get("global_name") or data.get("username") or f"Discord {discord_id}")[:100],
        "avatar_url": f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar}.png" if avatar else None,
    }
