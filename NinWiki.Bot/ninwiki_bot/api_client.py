"""
Cliente da API do NinWiki para o bot (rotas /bot/*).

IMPORTANTE - Discord IDs sempre viajam como TEXTO (str) no JSON, nunca como
numero: o JavaScript (e qualquer JSON parser que use float) corrompe inteiros
acima de 2^53, e um ID do Discord passa disso.

Este arquivo NAO importa discord.py de proposito, pra poder ser testado sem o
Discord (ver NinWiki.Api/scripts/testar_bot_integracao.py).
"""
from typing import Any

import httpx


class ApiError(Exception):
    """Erro devolvido pela API (ou falha de rede). `detail` ja' vem em portugues e pode ser mostrado ao usuario."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class NinWikiApi:
    """Cliente HTTP da API do NinWiki para o bot (rotas /bot/*)."""
    def __init__(self, base_url: str, bot_token: str, client: httpx.AsyncClient | None = None):
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=10.0)
        # O token vai no header X-Bot-Token de TODA chamada - nunca na URL (URLs vao pra log).
        self._headers = {"X-Bot-Token": bot_token}

    async def aclose(self) -> None:
        """Fecha a conexao HTTP, se foi criada aqui."""
        if self._owns_client:
            await self._client.aclose()

    async def _request(self, method: str, path: str, *, json: dict | None = None, params: dict | None = None) -> Any:
        """Faz a chamada com o X-Bot-Token e traduz erros da API em ApiError com a mensagem (em ingles) para mostrar a quem digitou."""
        try:
            res = await self._client.request(method, path, json=json, params=params, headers=self._headers)
        except httpx.HTTPError as e:
            raise ApiError(503, "Could not reach the NinWiki API. Try again in a moment.") from e

        if res.status_code >= 400:
            detail = None
            try:
                body = res.json()
                if isinstance(body, dict) and isinstance(body.get("detail"), str):
                    detail = body["detail"]
            except ValueError:
                pass
            if res.status_code == 401:
                detail = "The bot is not authorized on the API (BOT_API_TOKEN differs between the two .env files)."
            elif res.status_code == 404 and detail in (None, "Not Found"):
                detail = "The API did not answer as expected (is the bot route turned off? empty BOT_API_TOKEN on the API?)."
            raise ApiError(res.status_code, detail or f"Unexpected API error ({res.status_code}).")
        return res.json()

    async def list_staff(self, invoker_id: int) -> list[dict]:
        """Lista a equipe em nome de quem digitou o comando."""
        return await self._request("GET", "/bot/staff", params={"invokerDiscordId": str(invoker_id)})

    async def add_staff(self, invoker_id: int, target_id: int, role: str, username: str | None = None) -> dict:
        """Cadastra alguem na equipe em nome de quem digitou o comando."""
        return await self._request("POST", "/bot/staff", json={
            "invokerDiscordId": str(invoker_id), "discordId": str(target_id), "role": role, "username": username,
        })

    async def change_role(self, invoker_id: int, target_id: int, role: str) -> dict:
        """Troca o cargo de alguem em nome de quem digitou o comando."""
        return await self._request("PATCH", f"/bot/staff/{target_id}/role", json={
            "invokerDiscordId": str(invoker_id), "role": role,
        })

    async def set_active(self, invoker_id: int, target_id: int, active: bool) -> dict:
        """Ativa ou desativa alguem em nome de quem digitou o comando."""
        action = "activate" if active else "deactivate"
        return await self._request("POST", f"/bot/staff/{target_id}/{action}", json={"invokerDiscordId": str(invoker_id)})

    async def audit_log_since(self, since_iso: str, limit: int = 50) -> list[dict]:
        """Linhas do log geral criadas depois de `since_iso` (mais antigas primeiro) - alimenta o canal de log. Sem IPs."""
        return await self._request("GET", "/bot/audit-log", params={"since": since_iso, "limit": limit})

    async def errors_since(self, since_iso: str, limit: int = 50) -> list[dict]:
        """Problemas (erros do wiki) com ultima ocorrencia depois de `since_iso`, mais antigos primeiro. Sem traceback e sem IP."""
        return await self._request("GET", "/bot/errors", params={"since": since_iso, "limit": limit})

    async def api_status(self) -> tuple[bool, bool]:
        """(API respondeu?, banco respondeu?) via GET /health/ready. Nunca levanta excecao: falha de rede = (False, False)."""
        try:
            res = await self._client.get("/health/ready", timeout=8.0)
        except httpx.HTTPError:
            return False, False
        return True, res.status_code == 200

    async def site_ok(self, url: str) -> bool:
        """True se o site publico responde 200 (usa uma conexao propria, nao a da API)."""
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers={"User-Agent": "NinWikiBot-HealthCheck/1.0"}) as client:
                return (await client.get(url)).status_code < 400
        except httpx.HTTPError:
            return False
