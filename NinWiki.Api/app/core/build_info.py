"""
Informacoes da versao publicada: o workflow de deploy grava VERSION.json na raiz do app ({sha, message, date}); local = 'dev'.
Usado por GET /bot/version (o bot mostra no Discord qual e' a atualizacao mais recente da API e do site).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent   # pasta NinWiki.Api (ou a raiz do app na SquareCloud)


def read_build() -> dict:
    """{"sha": 7 primeiros caracteres, "message": titulo da atualizacao, "date": ISO 8601 do commit}; sem arquivo = tudo 'dev'/vazio."""
    try:
        raw = json.loads((ROOT / "VERSION.json").read_text(encoding="utf-8"))
        return {"sha": str(raw.get("sha", ""))[:7] or "dev", "message": str(raw.get("message", ""))[:200], "date": str(raw.get("date", ""))[:40]}
    except (OSError, ValueError):
        return {"sha": "dev", "message": "", "date": ""}
