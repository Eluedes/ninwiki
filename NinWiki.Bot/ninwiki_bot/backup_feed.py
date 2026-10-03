"""
Backup no Discord: nomes das partes, quantas partes, e quais mensagens antigas apagar (mantem so' os `keep` backups mais recentes).
Este arquivo NAO importa discord.py: so' decide nomes e quais apagar - o main.py faz o envio.

NOME: `ninwiki-AAAAMMDD-HHMM.nbk.NN-of-MM` (ex.: ninwiki-20261003-1200.nbk.01-of-03). Um backup = todas as partes com o mesmo AAAAMMDD-HHMM.
"""
import json
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

PART_RE = re.compile(r"^ninwiki-(\d{8}-\d{4})\.nbk\.(\d{2,})-of-(\d{2,})$")


def part_filename(stamp: str, part: int, total: int) -> str:
    """Nome do arquivo de uma parte do backup."""
    return f"ninwiki-{stamp}.nbk.{part:02d}-of-{total:02d}"


def parts_needed(size: int, part_bytes: int) -> int:
    """Quantas partes de `part_bytes` sao precisas para `size` bytes (no minimo 1)."""
    return max(1, math.ceil(size / part_bytes))


def stamp_of(filename: str) -> str | None:
    """O AAAAMMDD-HHMM de um nome de parte de backup, ou None se o arquivo nao for um backup."""
    m = PART_RE.match(filename)
    return m.group(1) if m else None


def messages_to_delete(found: list[tuple[str, int]], keep: int) -> list[int]:
    """`found` = [(stamp, id da mensagem)] de todas as partes no canal. Devolve os ids das mensagens dos backups MAIS ANTIGOS, alem dos `keep` mais novos."""
    stamps = sorted({s for s, _ in found}, reverse=True)   # AAAAMMDD-HHMM ordena como texto = ordem cronologica
    old = set(stamps[keep:])
    return [mid for s, mid in found if s in old]


def format_size(n: int) -> str:
    """Tamanho legivel (KB/MB)."""
    return f"{n / 1024 / 1024:.1f} MB" if n >= 1024 * 1024 else f"{max(1, n // 1024)} KB"


class BackupStore:
    """Guarda em arquivo a hora do ultimo backup bem-sucedido: reiniciar o bot (ex.: a cada deploy) NAO dispara outro backup antes da hora."""

    def __init__(self, path: Path):
        self.path = path

    def load(self) -> datetime | None:
        """Hora (UTC) do ultimo backup, ou None."""
        try:
            return datetime.fromisoformat(json.loads(self.path.read_text(encoding="utf-8"))["last"])
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def save(self, when: datetime) -> None:
        """Grava a hora do ultimo backup."""
        self.path.write_text(json.dumps({"last": when.isoformat()}), encoding="utf-8")


def is_due(last: datetime | None, now: datetime, interval_minutes: int) -> bool:
    """True se ja' passou o intervalo desde o ultimo backup (com 1 min de folga para a oscilacao do agendador)."""
    return last is None or now - last >= timedelta(minutes=interval_minutes) - timedelta(minutes=1)
