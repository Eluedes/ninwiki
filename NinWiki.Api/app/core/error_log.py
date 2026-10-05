"""
Registro de erros e problemas do wiki - para a equipe ficar sabendo (painel + canal do Discord) e resolver.

O QUE E' REGISTRADO (cada um vira/atualiza UM ErrorEvent - ver app/models/errors.py):
  - api       excecoes nao tratadas e respostas 5xx da API (capturadas em app/core/hardening.py);
  - deepl     falhas da traducao automatica (chave recusada, cota estourada, DeepL fora do ar);
  - security  alguem estourou o limite de requisicoes (possivel flood/copia em massa);
  - web       erros que o visitante viu no site (reportados por POST /client-errors).

PRIVACIDADE/SEGURANCA - o que NUNCA entra: cookies, cabecalhos, corpo de requisicao, query string. Mensagens e
tracebacks passam por `mask()` (senhas de URL, tokens, JWT, chaves, valores dos segredos do .env e parametros de
SQL sao trocados por ***). O traceback so' aparece no painel, para o S.Adm; no Discord vai so' um resumo.

COMO NAO VIRAR SPAM: ocorrencias repetidas do mesmo problema (mesmo fingerprint) so' aumentam o contador; e ha' um
freio de escrita (uma gravacao a cada 20 s por problema e 60 por minuto no total) para um erro em loop nao
derrubar o banco - as ocorrencias que o freio segurou entram somadas na proxima gravacao. Registrar NUNCA pode quebrar a requisicao: qualquer falha aqui e' engolida.
"""
import hashlib
import re
import time
import traceback
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.errors import ErrorEvent

API_ROOT = Path(__file__).resolve().parent.parent.parent  # pasta NinWiki.Api
MAX_MESSAGE = 500
MAX_TRACE = 6000

# --- freio de escrita (em memoria, por processo) ---
_PER_FINGERPRINT_SECONDS = 20       # ocorrencias dentro desta janela so' somam no contador pendente
_GLOBAL_PER_MINUTE = 60
_last_write: dict[str, float] = {}
_pending: dict[str, int] = {}
_minute_start = 0.0
_minute_writes = 0

_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_NUMBER_SEGMENT = re.compile(r"/\d+(?=/|$)")

_MASKS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"(postgres(?:ql)?(?:\+\w+)?://)[^@\s/]+@"), r"\1***@"),                       # usuario:senha@ de URL de banco
    (re.compile(r"(?i)\b(bearer|token|authorization|api[_-]?key|secret|password|passwd|pwd)(\s*[=:]\s*|\s+)([^\s,;'\"]+)"), r"\1\2***"),
    (re.compile(r"DeepL-Auth-Key\s+\S+"), "DeepL-Auth-Key ***"),
    (re.compile(r"\b[0-9a-fA-F-]{36}:fx\b"), "***"),                                             # chave gratuita da DeepL
    (re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]*"), "***"),       # JWT
    (re.compile(r"[A-Za-z0-9_\-]{23,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{27,}"), "***"),       # token do Discord
    (re.compile(r"\b[0-9a-fA-F]{32,}\b"), "***"),                                                # hex longo (hashes, chaves)
    (re.compile(r"\[parameters: .*?\]", re.S), "[parameters: ***]"),                             # valores de SQL (podem ter dados de pessoas)
]


def sweep() -> int:
    """Limpeza periodica da memoria do freio de escrita: esquece fingerprints sem ocorrencia ha' mais de 1 hora. Devolve quantos esqueceu."""
    now = time.monotonic()
    old = [k for k, t in _last_write.items() if now - t > 3600]
    for k in old:
        _last_write.pop(k, None)
        _pending.pop(k, None)
    return len(old)


def mask(text: str | None, limit: int = MAX_MESSAGE) -> str:
    """Troca por *** tudo que parece segredo (e os valores reais dos segredos do .env) e corta no tamanho maximo."""
    value = text or ""
    for secret in (settings.jwt_secret_key, settings.bot_api_token, settings.discord_client_secret, settings.deepl_api_key):
        if secret and len(secret) >= 8:
            value = value.replace(secret, "***")
    for pattern, repl in _MASKS:
        value = pattern.sub(repl, value)
    return value if len(value) <= limit else value[: limit - 1] + "…"


def normalize_path(path: str | None) -> str | None:
    """Rota sem ids ("/posts/3f2a..." -> "/posts/:id"), para o mesmo problema em ids diferentes ser UM so'."""
    if not path:
        return None
    path = path.split("?")[0]
    return _NUMBER_SEGMENT.sub("/:id", _UUID.sub(":id", path))[:300]


def fingerprint_of(source: str, title: str, location: str | None, path: str | None) -> str:
    """Identidade estavel de um problema: origem + tipo + local no codigo + rota normalizada."""
    raw = "|".join([source, title, location or "", normalize_path(path) or ""])
    return hashlib.sha1(raw.encode("utf-8"), usedforsecurity=False).hexdigest()   # so' identifica o problema (nao e' seguranca)


def location_of(exc: BaseException) -> str | None:
    """Onde o erro aconteceu no NOSSO codigo: ultimo trecho do traceback dentro de NinWiki.Api ("app/api/x.py:12 in func")."""
    frames = traceback.extract_tb(exc.__traceback__)
    ours = [f for f in frames if str(API_ROOT) in f.filename and "site-packages" not in f.filename]
    frame = (ours or frames or [None])[-1]
    if frame is None:
        return None
    try:
        rel = str(Path(frame.filename).resolve().relative_to(API_ROOT))
    except ValueError:
        rel = Path(frame.filename).name
    return f"{rel}:{frame.lineno} in {frame.name}"[:300]


def _allowed(fp: str, now: float) -> int | None:
    """Freio de escrita. Devolve QUANTAS ocorrencias gravar agora (1 + as acumuladas), ou None para so' acumular/descartar."""
    global _minute_start, _minute_writes
    if now - _minute_start >= 60:
        _minute_start, _minute_writes = now, 0
    if now - _last_write.get(fp, 0.0) < _PER_FINGERPRINT_SECONDS:
        _pending[fp] = _pending.get(fp, 0) + 1
        return None
    if _minute_writes >= _GLOBAL_PER_MINUTE:
        _pending[fp] = _pending.get(fp, 0) + 1
        return None
    _minute_writes += 1
    _last_write[fp] = now
    if len(_last_write) > 5000:  # nao deixa o dicionario crescer sem fim
        for key in [k for k, t in _last_write.items() if now - t > 3600]:
            _last_write.pop(key, None)
            _pending.pop(key, None)
    return 1 + _pending.pop(fp, 0)


def reset_throttle() -> None:
    """Zera o freio de escrita (usado nos testes)."""
    global _minute_start, _minute_writes
    _last_write.clear()
    _pending.clear()
    _minute_start, _minute_writes = 0.0, 0


async def record(
    *, source: str, level: str, title: str, message: str, location: str | None = None, path: str | None = None,
    method: str | None = None, status: int | None = None, trace: str | None = None, ip: str | None = None,
) -> None:
    """
    Registra (ou soma a) UM problema. Cria a linha na primeira vez; nas seguintes aumenta `count`, atualiza
    `last_seen`/mensagem/traceback e REABRE o problema se ele estava marcado como resolvido.
    Nunca levanta excecao: registrar erro jamais pode causar outro erro.
    """
    try:
        norm = normalize_path(path)
        fp = fingerprint_of(source, title, location, norm)
        times = _allowed(fp, time.monotonic())
        if times is None:
            return
        values = dict(
            fingerprint=fp, source=source, level=level, title=mask(title, 200), message=mask(message), location=location,
            path=norm, method=method, status=status, trace=mask(trace, MAX_TRACE) if trace else None, ip_address=ip, count=times,
        )
        stmt = insert(ErrorEvent).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[ErrorEvent.fingerprint],
            set_={
                "count": ErrorEvent.count + times, "last_seen": func.now(), "message": values["message"], "trace": values["trace"],
                "status": status, "ip_address": ip, "level": level,
                # voltou a acontecer: reabre
                "resolved": False, "resolved_at": None, "resolved_by": None,
            },
        )
        async with AsyncSessionLocal() as session:
            await session.execute(stmt)
            await session.commit()
    except Exception:  # noqa: BLE001 - registrar erro nunca pode quebrar quem chamou
        pass


async def record_exception(exc: BaseException, *, source: str = "api", path: str | None = None, method: str | None = None,
                           status: int | None = 500, ip: str | None = None, level: str = "error") -> None:
    """Atalho: registra uma excecao Python (tipo, mensagem mascarada, local no codigo e traceback mascarado)."""
    await record(
        source=source, level=level, title=type(exc).__name__, message=str(exc) or type(exc).__name__, location=location_of(exc),
        path=path, method=method, status=status, ip=ip,
        trace="".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
    )
