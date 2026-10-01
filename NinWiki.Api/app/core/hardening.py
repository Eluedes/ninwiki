"""
Endurecimento da API contra abuso e ataques comuns - tres middlewares ASGI puros:

  1. SecurityHeadersMiddleware  cabecalhos de seguranca em TODA resposta (nosniff, anti-iframe,
                                HSTS fora do local, sem cache em rotas sensiveis...).
  2. RateLimitMiddleware        limite de requisicoes por IP e por minuto (leitura, escrita e
                                imagens separados). Freia scrapers que tentam copiar o conteudo em
                                massa e floods que tentam derrubar a API.
  3. BodyLimitMiddleware        recusa corpos de requisicao gigantes (413) antes de leitos na memoria.

Todos usam so' a biblioteca padrao + o `limiter` de app/core/rate_limit.py (janela deslizante em
memoria, por processo). Limites configuraveis no .env (ver app/core/config.py).

IMPORTANTE sobre o IP: o limite e' por IP. Atras de proxy (Cloudflare/SquareCloud), ligue
TRUST_PROXY_HEADERS=true senao todo mundo parece ter o IP do proxy e um unico abusador bloquearia todos.
O site (Next.js) busca dados no servidor, entao as visitas chegam com o IP do servidor do site -
por isso o limite de leitura padrao e' alto.
"""
import json

from app.core.config import settings
from app.core.rate_limit import client_key, limiter, retry_message

# Rotas cujas respostas nunca devem ficar em cache (sessao, equipe, permissoes, avisos, log, bot).
_NO_STORE_PREFIXES = ("/auth", "/staff", "/roles", "/notices", "/audit-log", "/bot")
_READ_METHODS = {"GET", "HEAD", "OPTIONS"}


def _path_of(scope: dict) -> str:
    """Caminho da requisicao ASGI (sem query string)."""
    return scope.get("path", "")


async def _send_json(send, status: int, detail: str, extra_headers: list[tuple[bytes, bytes]] | None = None) -> None:
    """Responde um erro JSON simples ({"detail": ...}) sem passar pelo resto da aplicacao."""
    body = json.dumps({"detail": detail}).encode()
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
    await send({"type": "http.response.start", "status": status, "headers": headers + (extra_headers or [])})
    await send({"type": "http.response.body", "body": body})


class SecurityHeadersMiddleware:
    """Acrescenta cabecalhos de seguranca a toda resposta HTTP."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = _path_of(scope)

        async def send_with_headers(message):
            """Intercepta o inicio da resposta para acrescentar os cabecalhos de seguranca."""
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {k.lower() for k, _ in headers}

                def add(name: bytes, value: bytes) -> None:
                    """Acrescenta um cabecalho so' se a resposta ainda nao tem um com esse nome."""
                    if name not in present:
                        headers.append((name, value))

                add(b"x-content-type-options", b"nosniff")            # navegador nao "adivinha" o tipo do arquivo
                add(b"x-frame-options", b"DENY")                       # ninguem embute a API num iframe
                add(b"referrer-policy", b"no-referrer")
                add(b"permissions-policy", b"camera=(), microphone=(), geolocation=()")
                add(b"cross-origin-opener-policy", b"same-origin")
                if not settings.is_development:
                    add(b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                    # A API so' devolve JSON/arquivos: nenhum script/estilo precisa rodar a partir dela.
                    add(b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'")
                if path.startswith(_NO_STORE_PREFIXES):
                    add(b"cache-control", b"no-store")
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


class RateLimitMiddleware:
    """Limite de requisicoes por IP/minuto. Estourou: 429 com Retry-After (e o resto da API nem e' executado)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path, method = _path_of(scope), scope.get("method", "GET")
        if path == "/health" or method == "OPTIONS":  # health-check de monitoramento e preflight de CORS nao contam
            await self.app(scope, receive, send)
            return
        if path.startswith("/uploads"):
            bucket, limit = "rl-uploads", settings.upload_requests_per_minute
        elif method in _READ_METHODS:
            bucket, limit = "rl-read", settings.public_requests_per_minute
        else:
            bucket, limit = "rl-write", settings.write_requests_per_minute
        wait = limiter.hit(bucket, client_key(), limit, 60)
        if wait is not None:
            await _send_json(send, 429, retry_message(wait), [(b"retry-after", str(wait).encode())])
            return
        await self.app(scope, receive, send)


class _BodyTooLarge(Exception):
    """Sinaliza que o corpo da requisicao passou do limite enquanto era lido."""


class BodyLimitMiddleware:
    """Recusa (413) requisicoes com corpo maior que o permitido para a rota - confere o Content-Length E conta os bytes recebidos."""

    def __init__(self, app):
        self.app = app

    @staticmethod
    def _limit_for(path: str) -> int:
        """Limite em bytes: uploads de imagem/arquivo tem o proprio tamanho (+1 MB de folga do multipart); o resto e' JSON pequeno."""
        if path == "/uploads/image":
            return (settings.max_upload_size_mb + 1) * 1024 * 1024
        if path == "/content-items/bulk-import":  # lista grande de nomes vindos do jogo (milhares de itens)
            return 8 * 1024 * 1024
        if path.startswith("/notices/") and path.endswith("/files"):
            return (settings.max_notice_file_mb + 1) * 1024 * 1024
        return settings.max_json_body_kb * 1024

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") in _READ_METHODS:
            await self.app(scope, receive, send)
            return
        limit = self._limit_for(_path_of(scope))
        declared = next((v for k, v in scope.get("headers", []) if k == b"content-length"), None)
        if declared is not None and declared.isdigit() and int(declared) > limit:
            await _send_json(send, 413, "Corpo da requisição grande demais")
            return

        received = 0
        started = False

        async def counting_receive():
            """Conta os bytes do corpo recebido e aborta se passar do limite."""
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            """Lembra se a resposta ja' comecou (para saber se ainda da' pra responder 413)."""
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except _BodyTooLarge:
            if not started:
                await _send_json(send, 413, "Corpo da requisição grande demais")
