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
        self.last_site_detail = ""  # por que a ultima checagem do site falhou (vazio = ok); so' para o log do bot

    async def aclose(self) -> None:
        """Fecha a conexao HTTP, se foi criada aqui."""
        if self._owns_client:
            await self._client.aclose()

    async def _request(self, method: str, path: str, *, json: dict | None = None, params: dict | None = None,
                       timeout: float | None = None, raw: bool = False) -> Any:
        """Faz a chamada com o X-Bot-Token e traduz erros da API em ApiError com a mensagem (em ingles) para mostrar a quem digitou."""
        try:
            res = await self._client.request(method, path, json=json, params=params, headers=self._headers,
                                             timeout=timeout if timeout is not None else httpx.USE_CLIENT_DEFAULT)
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
        if raw:
            return res.content
        return None if res.status_code == 204 else res.json()

    async def audit_log_since(self, since_iso: str, limit: int = 50, include_ip: bool = False) -> list[dict]:
        """Linhas do log geral criadas depois de `since_iso` (mais antigas primeiro) - alimenta o canal de log. IP so' com include_ip."""
        params: dict = {"since": since_iso, "limit": limit}
        if include_ip:
            params["includeIp"] = "true"
        return await self._request("GET", "/bot/audit-log", params=params)

    async def search(self, query: str, lang: str = "en") -> list[dict]:
        """Busca publica pelo nome (itens, mobs, armas, jutsus, masteries, posts) em `en` ou `pt`: ate' 10 resultados com resumo, imagem e dados."""
        return await self._request("GET", "/bot/search", params={"q": query, "lang": lang})

    async def errors_since(self, since_iso: str, limit: int = 50) -> list[dict]:
        """Problemas (erros do wiki) com ultima ocorrencia depois de `since_iso`, mais antigos primeiro. Sem traceback e sem IP."""
        return await self._request("GET", "/bot/errors", params={"since": since_iso, "limit": limit})

    async def reports_since(self, since_iso: str, limit: int = 20) -> list[dict]:
        """Reports de visitantes (conteudo desatualizado / erro de traducao) criados depois de `since_iso`, mais antigos primeiro. Sem IP."""
        return await self._request("GET", "/bot/reports", params={"since": since_iso, "limit": limit})

    async def api_status(self) -> tuple[bool, bool]:
        """(API respondeu?, banco respondeu?) via GET /health/ready. Nunca levanta excecao: falha de rede = (False, False)."""
        try:
            res = await self._client.get("/health/ready", timeout=8.0)
        except httpx.HTTPError:
            return False, False
        return True, res.status_code == 200

    async def site_ok(self, url: str, transport: httpx.AsyncBaseTransport | None = None) -> bool:
        """
        True se o SITE respondeu de verdade. Usa uma conexao propria, nao a da API.
        No ar: 2xx/3xx; 429; e 401/403 SO' quando ha o cabecalho cf-mitigated (desafio da Cloudflare barrando ESTE robo: o site existe).
        Um 403 comum da Cloudflare NAO conta (ex.: erro 1014 'CNAME Cross-User Banned', dominio apontando para um app que nao existe mais). Fora do ar: 404/410 e demais 4xx (ex.: app apagado, dominio sem app -
        a hospedagem responde 404), 5xx (inclui os 52x da Cloudflare), timeout, erro de conexao e redirecionamento em loop.
        O motivo fica em last_site_detail.
        """
        self.last_site_detail = ""
        try:
            async with httpx.AsyncClient(
                timeout=10.0, follow_redirects=True, max_redirects=5, transport=transport,
                headers={"User-Agent": "Mozilla/5.0 (compatible; NinWikiBot-HealthCheck/1.0)", "Accept": "text/html,*/*"},
            ) as client:
                res = await client.get(url)
        except httpx.HTTPError as e:
            self.last_site_detail = f"{type(e).__name__}: {e}"[:200]
            return False
        code = res.status_code
        if code >= 400:
            self.last_site_detail = f"HTTP {code}"
        if code < 400 or code == 429:
            return True
        if code in (401, 403):
            return "cf-mitigated" in res.headers
        return False

    # ---- versao publicada e backup (ver app/core/backup.py e app/core/build_info.py na API) ----

    async def build_info(self) -> dict:
        """A atualizacao publicada na API: {sha, message, date}."""
        return await self._request("GET", "/bot/version")

    async def web_build(self, site_url: str) -> dict | None:
        """A atualizacao publicada no SITE (rota publica /version): {sha, message, date}, ou None se o site nao respondeu."""
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 (compatible; NinWikiBot-Version/1.0)"}) as client:
                res = await client.get(site_url.rstrip("/") + "/version")
                data = res.json() if res.status_code == 200 else None
        except (httpx.HTTPError, ValueError):
            return None
        return data if isinstance(data, dict) and data.get("sha") else None

    async def start_backup(self) -> dict:
        """Pede a' API um backup cifrado AGORA (banco + imagens): {id, size, rows, files}. Pode levar alguns minutos."""
        return await self._request("POST", "/bot/backup", timeout=600.0)

    async def download_backup_part(self, backup_id: str, part: int, size: int) -> bytes:
        """Baixa a parte `part` (de `size` bytes) do backup."""
        return await self._request("GET", f"/bot/backup/{backup_id}", params={"part": part, "size": size}, timeout=300.0, raw=True)

    async def delete_backup(self, backup_id: str) -> None:
        """Manda a API apagar o arquivo temporario do backup."""
        await self._request("DELETE", f"/bot/backup/{backup_id}")
