"""
Feed do log geral no Discord: o bot pergunta a' API "o que aconteceu desde X?" e posta cada acao
num canal de log (embeds). Este arquivo NAO importa discord.py - so' decide O QUE postar e guarda
ONDE parou - para poder ser testado sem o Discord.

Como nao perder nem repetir acao:
  - guardamos o instante da ultima acao vista (`since`) e os ids ja' postados (`seen`) num arquivo
    JSON (log_state.json). Reiniciar o bot continua de onde parou.
  - consultamos a API com uma SOBREPOSICAO de alguns minutos (OVERLAP) e descartamos o que ja'
    esta' em `seen`: assim uma acao gravada com atraso (transacao longa) nao e' perdida.
  - na PRIMEIRA execucao comecamos "de agora": o historico antigo nao e' despejado no canal.

Privacidade: o endpoint da API nao devolve IP, e aqui so' mostramos campos curtos e seguros do
`diff` (nome, titulo, cargo...). Conteudo de textos nunca vai pro Discord.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ninwiki_bot._util import clip, parse_time, read_json, write_json_atomic

OVERLAP = timedelta(minutes=3)       # quanto "voltamos no tempo" a cada consulta (e deduplicamos por id)
MAX_SEEN = 500                       # quantos ids recentes lembrar
MAX_TEXT = 300                       # tamanho maximo de cada texto mostrado no embed

ACTION_LABEL = {
    "create": "created", "update": "edited", "delete": "deleted", "upload": "uploaded a file to",
    "delete_file": "removed a file from", "reset": "restored the defaults of",
    "bulk-status": "changed the status of", "bulk-delete": "bulk-deleted", "bulk-import": "imported",
    "login": "signed in to the panel", "logout": "signed out of the panel", "login_denied": "had a login denied",
    "role_change": "changed the role of", "rename": "renamed", "clear_log": "cleared the log", "activate": "reactivated", "deactivate": "deactivated",
    "bootstrap": "was created as owner", "bootstrap_restore": "had the owner role restored",
    "permission_denied": "tried something without permission on", "resolve": "resolved", "reopen": "reopened",
}
ENTITY_LABEL = {
    "content_item": "an entry", "jutsu": "a jutsu", "mastery": "a mastery", "upload": "a file", "auth": "the session",
    "staff": "a staff member", "security": "a route", "village": "a village", "organization": "an organization",
    "post": "a post", "notice": "a notice", "roles": "a role's permissions", "error": "an error",
}
# Cores dos embeds (RGB em inteiro): verde = criou, azul = editou, vermelho = apagou/negado, laranja = equipe/seguranca.
COLORS = {"create": 0x2ECC71, "update": 0x3498DB, "delete": 0xE74C3C, "bulk-delete": 0xE74C3C,
          "login_denied": 0xE74C3C, "permission_denied": 0xE74C3C, "role_change": 0xE67E22, "rename": 0xE67E22,
          "deactivate": 0xE67E22, "activate": 0xE67E22, "reset": 0xE67E22, "login": 0x95A5A6, "logout": 0x95A5A6}
DEFAULT_COLOR = 0x7F8C8D
ROLE_LABEL = {"super_admin": "S.Adm", "admin": "Adm", "creator": "Creator"}


@dataclass
class FeedState:
    """Onde o feed parou: instante da ultima acao vista + ids recentes ja' postados."""
    since: datetime
    seen: list[str] = field(default_factory=list)


def _clip(text: str, limit: int = MAX_TEXT) -> str:
    """Corta texto longo para o embed (logica em _util)."""
    return clip(text, limit)


_parse_time = parse_time


def describe_diff(entry: dict) -> str:
    """Resumo curto e SEGURO do que mudou (so' campos pequenos conhecidos; nunca o texto de conteudo)."""
    diff = entry.get("diff") or {}
    parts: list[str] = []
    for key, label in (("name", "Name"), ("title", "Title"), ("username", "User"), ("file", "File")):
        if isinstance(diff.get(key), str):
            parts.append(f"{label}: {_clip(diff[key], 100)}")
    if isinstance(diff.get("role"), str):
        parts.append(f"Role: {ROLE_LABEL.get(diff['role'], diff['role'])}")
    if isinstance(diff.get("before"), dict) and isinstance(diff.get("after"), dict):
        before, after = diff["before"], diff["after"]
        if isinstance(before.get("name"), str) and before.get("name") != after.get("name"):
            parts.append(f"Name: {_clip(before['name'], 60)} → {_clip(str(after.get('name')), 60)}")
    for key, label in (("added", "Granted"), ("removed", "Revoked")):
        if isinstance(diff.get(key), list) and diff[key]:
            parts.append(f"{label}: " + ", ".join(_clip(p, 40) for p in diff[key][:8]))
    if isinstance(diff.get("missing"), list) and diff["missing"]:
        parts.append("Missing: " + ", ".join(_clip(p, 40) for p in diff["missing"][:5]))
    return _clip("\n".join(parts), 600)


def _footer(entry: dict) -> str:
    """Rodape do embed: de onde veio a acao (Panel/Bot/Login) e, se a API mandou, o IP de quem agiu."""
    source = {"panel": "Panel", "bot": "Bot", "auth": "Login", "system": "System"}.get(entry.get("source", ""), entry.get("source", ""))
    ip = entry.get("ipAddress")
    return f"{source} · IP {ip}" if ip else source


def format_entry(entry: dict) -> dict:
    """Transforma uma linha do log em {title, description, color, footer, timestamp} (o main.py monta o embed)."""
    actor = entry.get("actorName") or "System"
    role = ROLE_LABEL.get(entry.get("actorRole") or "", entry.get("actorRole") or "")
    action = ACTION_LABEL.get(entry["action"], entry["action"])
    entity = ENTITY_LABEL.get(entry["entityType"], entry["entityType"])
    # "login"/"logout" ja' dizem tudo; as demais acoes citam o alvo ("criou uma entry").
    target = "" if entry["action"] in ("login", "logout", "bootstrap", "bootstrap_restore") else f" {entity}"
    title = _clip(f"{actor}{f' ({role})' if role else ''} {action}{target}", 250)
    return {
        "title": title,
        "description": describe_diff(entry),
        "color": COLORS.get(entry["action"], DEFAULT_COLOR),
        "footer": _footer(entry),
        "timestamp": _parse_time(entry["createdAt"]),
    }


class LogFeedStore:
    """Guarda/le o estado do feed num arquivo JSON (sobrevive a reinicio do bot)."""

    def __init__(self, path: Path):
        self.path = path

    def load(self) -> FeedState:
        """Estado salvo, ou 'a partir de agora' se nao existir/estiver corrompido (nunca despeja o historico antigo)."""
        raw = read_json(self.path)
        try:
            return FeedState(since=_parse_time(raw["since"]), seen=[str(x) for x in raw.get("seen", [])][-MAX_SEEN:])
        except (AttributeError, ValueError, KeyError, TypeError):  # AttributeError: arquivo valido mas nao e' um objeto (ou ausente -> None)
            return FeedState(since=datetime.now(timezone.utc))

    def save(self, state: FeedState) -> None:
        """Grava o estado (escrita atomica: arquivo temporario + rename, para nao corromper se o bot cair no meio)."""
        write_json_atomic(self.path, {"since": state.since.isoformat(), "seen": state.seen[-MAX_SEEN:]})


def query_since(state: FeedState) -> datetime:
    """Instante a enviar para a API: o ultimo visto menos a sobreposicao."""
    return state.since - OVERLAP


def pick_new(state: FeedState, entries: list[dict]) -> list[dict]:
    """Descarta o que ja' foi postado e AVANCA o estado (since = acao mais recente; seen += ids novos). Ordem preservada."""
    seen = set(state.seen)
    fresh = [e for e in entries if e["id"] not in seen]
    for e in fresh:
        state.seen.append(e["id"])
        created = _parse_time(e["createdAt"])
        if created > state.since:
            state.since = created
    state.seen = state.seen[-MAX_SEEN:]
    return fresh
