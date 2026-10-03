"""
Mensagem "Latest updates": a versao mais recente da API e do site, numa unica mensagem de webhook que e' EDITADA a cada deploy (nao enche o chat).
Este arquivo NAO importa discord.py: decide SE precisa editar e monta o texto; o main.py fala com o Discord.
O estado (id da mensagem e ultima versao vista de cada um, com a hora em que o bot a viu) fica em version_state.json: reiniciar o bot nao cria mensagem nova.
"""
import json
from datetime import datetime, timezone
from pathlib import Path


class VersionStore:
    """Guarda em arquivo o id da mensagem do webhook e a ultima versao vista da API e do site."""

    def __init__(self, path: Path):
        """`path` = arquivo (version_state.json) onde o estado fica salvo."""
        self.path = path

    def load(self) -> dict:
        """Estado salvo ({"message_id": int|None, "api": {...}, "web": {...}}) ou um estado vazio."""
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return {"message_id": int(raw["message_id"]) if raw.get("message_id") else None, "api": raw.get("api") or {}, "web": raw.get("web") or {}}
        except (OSError, ValueError, TypeError):
            return {"message_id": None, "api": {}, "web": {}}

    def save(self, state: dict) -> None:
        """Grava o estado (escrita atomica; o id da mensagem vai como texto)."""
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({**state, "message_id": str(state["message_id"]) if state.get("message_id") else None}), encoding="utf-8")
        tmp.replace(self.path)


def merge(state: dict, api: dict | None, web: dict | None, now: datetime | None = None) -> tuple[dict, bool]:
    """
    Junta o que o bot viu agora com o estado salvo. Devolve (novo estado, mudou?). `mudou` = tem mensagem nova a editar: ainda nao existe mensagem,
    ou o hash (sha) da API ou do site mudou. Quem nao respondeu (None) mantem a ultima versao conhecida. Versao 'dev' (sem VERSION.json) nao conta.
    """
    now = now or datetime.now(timezone.utc)
    new = {"message_id": state.get("message_id"), "api": dict(state.get("api") or {}), "web": dict(state.get("web") or {})}
    changed = new["message_id"] is None and bool(api or web)
    for key, seen in (("api", api), ("web", web)):
        if seen and seen.get("sha") and seen["sha"] != "dev" and seen["sha"] != new[key].get("sha"):
            new[key] = {"sha": seen["sha"], "message": str(seen.get("message", ""))[:200], "date": str(seen.get("date", "")), "seen_at": now.isoformat()}
            changed = True
    return new, changed


def _line(info: dict) -> str:
    """Texto de um componente: hash, titulo da atualizacao e quando o bot viu essa versao no ar."""
    if not info.get("sha"):
        return "—"
    out = f"`{info['sha']}`" + (f" — {info['message']}" if info.get("message") else "")
    if info.get("seen_at"):
        out += f"\nLive since <t:{int(datetime.fromisoformat(info['seen_at']).timestamp())}:R>"
    return out


def build_embed(state: dict) -> dict:
    """{title, fields, footer, color} do embed "Latest updates" (API e Web)."""
    return {
        "title": "🚀 Latest updates",
        "fields": [("API", _line(state.get("api") or {})), ("Web", _line(state.get("web") or {}))],
        "footer": "Edited automatically on every deploy",
        "color": 0x3498DB,
    }
