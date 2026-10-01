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
        """Faz a chamada com o X-Bot-Token e traduz erros da API em ApiError com mensagem em portugues."""
        try:
            res = await self._client.request(method, path, json=json, params=params, headers=self._headers)
        except httpx.HTTPError as e:
            raise ApiError(503, "Não consegui falar com a API da NinWiki. Tente de novo em instantes.") from e

        if res.status_code >= 400:
            detail = None
            try:
                body = res.json()
                if isinstance(body, dict) and isinstance(body.get("detail"), str):
                    detail = body["detail"]
            except ValueError:
                pass
            if res.status_code == 401:
                detail = "O bot não está autorizado na API (BOT_API_TOKEN diferente nos dois .env)."
            elif res.status_code == 404 and detail in (None, "Not Found"):
                detail = "A API não respondeu como esperado (a rota do bot está desligada? BOT_API_TOKEN vazio na API?)."
            raise ApiError(res.status_code, detail or f"Erro inesperado da API ({res.status_code}).")
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
