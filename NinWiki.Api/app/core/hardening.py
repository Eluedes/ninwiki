"""
Endurecimento da API contra abuso e ataques comuns - tres middlewares ASGI puros:

  0. ErrorCaptureMiddleware     qualquer excecao nao tratada (ou resposta 5xx) vira um registro em /admin/errors e no canal
                                de erros do bot; o visitante recebe um 500 generico, sem detalhe interno.
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
import logging
import time
import traceback

from app.core import error_log
from app.core.config import settings
from app.core.rate_limit import client_key, limiter, retry_message

log = logging.getLogger("ninwiki.errors")

# Rotas cujas respostas nunca devem ficar em cache (sessao, equipe, permissoes, avisos, log, bot).
_NO_STORE_PREFIXES = ("/auth", "/staff", "/roles", "/notices", "/audit-log", "/bot")
_READ_METHODS = {"GET", "HEAD", "OPTIONS"}


def _path_of(scope: dict) -> str:
    """Caminho da requisicao ASGI (sem query string)."""
    return scope.get("path", "")


def _route_of(scope: dict) -> str:
    """Rota "com buracos" (/posts/{post_id}) quando o roteador ja' a identificou; senao o caminho normalizado."""
    route = scope.get("route")
    return getattr(route, "path", None) or error_log.normalize_path(_path_of(scope)) or ""


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


class ErrorCaptureMiddleware:
    """
    Rede de seguranca da API: se uma rota quebrar (excecao nao tratada) registra o problema (com traceback mascarado),
    escreve no log do app e responde 500 generico. Respostas 5xx "normais" (ex: HTTPException 503) tambem sao registradas.
    Fica DENTRO do CORS e dos cabecalhos de seguranca, entao o 500 leva os mesmos cabecalhos das demais respostas.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False
        status = 0

        async def tracking_send(message):
            """Lembra se a resposta ja' comecou e com qual status (para saber se ainda da' pra responder 500 e se foi um 5xx)."""
            nonlocal started, status
            if message["type"] == "http.response.start":
                started, status = True, message["status"]
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception as exc:  # noqa: BLE001 - e' justamente a rede de seguranca
            log.error("Erro nao tratado em %s %s: %s", scope.get("method"), _route_of(scope),
                      error_log.mask("".join(traceback.format_exception(type(exc), exc, exc.__traceback__)), 4000))
            await error_log.record_exception(exc, path=_route_of(scope), method=scope.get("method"), status=500, ip=client_key())
            if not started:
                await _send_json(send, 500, "Internal server error")
            return
        if status >= 500:
            await error_log.record(
                source="api", level="error", title=f"HTTP {status}", message=f"The API answered {status} on {scope.get('method')} {_route_of(scope)}",
                location=None, path=_route_of(scope), method=scope.get("method"), status=status, ip=client_key(),
            )


_flood_seen: dict[tuple[str, str], float] = {}
_FLOOD_REPORT_SECONDS = 600


def sweep_flood() -> int:
    """Limpeza periodica: esquece IPs que ja' passaram da janela de 10 min do aviso de flood. Devolve quantos esqueceu."""
    now = time.monotonic()
    old = [k for k, t in _flood_seen.items() if now - t > _FLOOD_REPORT_SECONDS]
    for k in old:
        _flood_seen.pop(k, None)
    return len(old)


async def _report_flood(bucket: str, limit: int) -> None:
    """Registra (no maximo 1 vez por IP e balde a cada 10 min) que alguem estourou o limite - sinal de flood/copia em massa."""
    key, now = (bucket, client_key()), time.monotonic()
    if now - _flood_seen.get(key, -_FLOOD_REPORT_SECONDS) < _FLOOD_REPORT_SECONDS:
        return
    _flood_seen[key] = now
    if len(_flood_seen) > 5000:
        for k in [k for k, t in _flood_seen.items() if now - t > _FLOOD_REPORT_SECONDS]:
            _flood_seen.pop(k, None)
    await error_log.record(
        source="security", level="warning", title=f"Rate limit exceeded ({bucket})",
        message=f"A client exceeded {limit} requests/minute on bucket '{bucket}' and is being throttled (429). Possible flood or mass copying.",
        path=None, status=429, ip=client_key(),
    )


class RateLimitMiddleware:
    """Limite de requisicoes por IP/minuto. Estourou: 429 com Retry-After (e o resto da API nem e' executado)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path, method = _path_of(scope), scope.get("method", "GET")
        if path.startswith("/health") or method == "OPTIONS":  # health-check de monitoramento e preflight de CORS nao contam
            await self.app(scope, receive, send)
            return
        if path.startswith("/uploads"):
            bucket, limit = "rl-uploads", settings.upload_requests_per_minute
        elif method == "POST" and path in ("/media", "/uploads/image"):  # envio de imagens (inclusive em lote): limite proprio, maior
            bucket, limit = "rl-media", settings.media_upload_requests_per_minute
        elif method in _READ_METHODS:
            bucket, limit = "rl-read", settings.public_requests_per_minute
        else:
            bucket, limit = "rl-write", settings.write_requests_per_minute
        wait = limiter.hit(bucket, client_key(), limit, 60)
        if wait is not None:
            await _report_flood(bucket, limit)
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
