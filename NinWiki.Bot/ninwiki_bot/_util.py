"""
Funcoes pequenas compartilhadas pelos feeds (erros, log, backup, versao). NAO importa discord.py.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def clip(text: str, limit: int) -> str:
    """Corta texto longo (e tira quebras de linha) para caber no embed."""
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def parse_time(value: str) -> datetime:
    """Le o ISO 8601 da API (aceita 'Z') e garante fuso UTC."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def read_json(path: Path):
    """JSON do arquivo, ou None se faltar/estiver corrompido (o bot nunca cai por causa do arquivo de estado)."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_json_atomic(path: Path, data) -> None:
    """Grava JSON via arquivo temporario + os.replace: se o bot cair no meio, o arquivo antigo continua inteiro."""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    os.replace(tmp, path)
