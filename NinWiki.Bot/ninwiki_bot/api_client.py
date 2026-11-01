"""
Cliente da API do NinWiki para o bot (rotas /bot/*).

IMPORTANTE - Discord IDs sempre viajam como TEXTO (str) no JSON, nunca como
numero: o JavaScript (e qualquer JSON parser que use float) corrompe inteiros
acima de 2^53, e um ID do Discord passa disso.

Este arquivo NAO importa discord.py de proposito, pra poder ser testado sem o
Discord (ver NinWiki.Api/scripts/testar_bot_integracao.py).
"""
import logging
import time
from typing import Any

import httpx

log = logging.getLogger("ninwiki_bot")


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
        self._cache: dict[tuple, tuple[float, Any]] = {}  # cache em memoria (chave -> (vence em, valor)) das buscas repetidas e do autocompletar

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
            raise ApiError(503, "Could not reach the Nin Codex API. Try again in a moment.") from e

        if res.status_code >= 400:
            detail = None
            try:
                body = res.json()
                if isinstance(body, dict) and isinstance(body.get("detail"), str):
                    detail = body["detail"]
            except ValueError:
                log.debug("Resposta de erro da API nao era JSON (HTTP %s)", res.status_code)
            if res.status_code == 401:
                detail = "The bot is not authorized on the API (BOT_API_TOKEN differs between the two .env files)."
            elif res.status_code == 404 and detail in (None, "Not Found"):
                detail = "The API did not answer as expected (is the bot route turned off? empty BOT_API_TOKEN on the API?)."
            raise ApiError(res.status_code, detail or f"Unexpected API error ({res.status_code}).")
        if raw:
            return res.content
        if res.status_code == 204:
            return None
        try:
            return res.json()
        except ValueError as e:   # 200 com corpo que nao e' JSON (proxy/pagina de erro): vira ApiError em vez de excecao solta
            raise ApiError(502, "The Nin Codex API sent an unreadable answer. Try again in a moment.") from e

    async def _cached(self, key: tuple, ttl: float, fetch) -> Any:
        """Resposta guardada por `ttl` segundos (so' acertos: erro nunca fica em cache). Limite de 500 entradas (limpa as vencidas, depois zera)."""
        now = time.monotonic()
        hit = self._cache.get(key)
        if hit and hit[0] > now:
            return hit[1]
        value = await fetch()
        if len(self._cache) >= 500:
            self._cache = {k: v for k, v in self._cache.items() if v[0] > now}
            if len(self._cache) >= 500:
                self._cache.clear()
        self._cache[key] = (now + ttl, value)
        return value

    async def audit_log_since(self, since_iso: str, limit: int = 50, include_ip: bool = False) -> list[dict]:
        """Linhas do log geral criadas depois de `since_iso` (mais antigas primeiro) - alimenta o canal de log. IP so' com include_ip."""
        params: dict = {"since": since_iso, "limit": limit}
        if include_ip:
            params["includeIp"] = "true"
        return await self._request("GET", "/bot/audit-log", params=params)

    async def search(self, query: str, lang: str = "en", kind: str | None = None) -> list[dict]:
        """Busca publica pelo nome (itens, mobs, armas, jutsus, masteries, posts) em `en` ou `pt`: ate' 10 resultados com resumo, imagem e dados. `kind` (item, mob, jutsu, mastery) busca so' esse tipo."""
        params = {"q": query, "lang": lang, **({"kind": kind} if kind else {})}
        return await self._request("GET", "/bot/search", params=params)

    async def suggest(self, query: str, lang: str = "en", kind: str | None = None) -> list[str]:
        """Nomes para o autocompletar do Discord (ate' 20) que combinam com `query`; `kind` (item, weapon, mob, jutsu, mastery, recipe) limita ao tipo, sem ele sugere de tudo.
        Cache de 2 min (o `kind` entra na chave) e prazo de 2,5 s (o Discord desiste do autocompletar em 3 s)."""
        params = {"q": query, "lang": lang, **({"kind": kind} if kind else {})}
        return await self._cached(("suggest", query.lower(), lang, kind), 120, lambda: self._request("GET", "/bot/suggest", params=params, timeout=2.5))

    async def drops(self, query: str, lang: str = "en") -> dict:
        """Quais mobs dropam o item `query` ({found, title, href, image, rarity, mobs:[{name, href, chance, chanceQualifier}]})."""
        return await self._request("GET", "/bot/drops", params={"q": query, "lang": lang})

    async def recipe(self, query: str, lang: str = "en") -> dict:
        """Como fazer o item `query` ({found, title, href, image, recipes:[{profession, professionHref, level, workbench, learnedFrom, needs:[{name, href, qty}]}]})."""
        return await self._request("GET", "/bot/recipe", params={"q": query, "lang": lang})

    async def latest_posts(self, limit: int = 3, lang: str = "en") -> list[dict]:
        """Os posts do blog mais recentes que ja' estao no ar (para o /patchnotes)."""
        return await self._request("GET", "/bot/latest-posts", params={"limit": limit, "lang": lang})

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

    async def reader_ids(self) -> list[str]:
        """Discord IDs (texto) de TODOS os leitores do site, paginando de 1000 em 1000 (so' esses interessam ao bot)."""
        out: list[str] = []
        after = "0"
        while True:
            page = await self._request("GET", "/bot/reader-ids", params={"after": after, "limit": 1000})
            out.extend(page["ids"])
            if not page.get("next"):
                return out
            after = page["next"]

    async def sync_guilds(self, guilds: list[dict]) -> dict:
        """Informa os servidores onde o bot esta' e os cargos de cada um (a API guarda; o painel usa para mapear vila/rank)."""
        return await self._request("POST", "/bot/guilds-sync", json={"guilds": guilds}, timeout=60.0)

    async def push_member_roles(self, guild_id: str, members: list[dict]) -> dict:
        """Informa os cargos de leitores num servidor (ate' 500 por chamada). A API decide vila/rank; o bot so' repassa fatos."""
        return await self._request("POST", "/bot/member-roles", json={"guildId": guild_id, "members": members}, timeout=60.0)

    async def push_guild_members(self, guild_id: str, members: list[dict], *, sync_token: str = "", final: bool = False, remove: list[str] | None = None) -> dict:
        """Informa a LISTA de membros de um servidor (ate' 500 por chamada). `final` fecha a sincronizacao completa (a API apaga quem saiu)."""
        return await self._request("POST", "/bot/guild-members", json={
            "guildId": guild_id, "syncToken": sync_token, "members": members, "remove": remove or [], "final": final}, timeout=60.0)
