"""
Feed de ERROS e PROBLEMAS do wiki no Discord: o bot pergunta a' API "que problemas aconteceram desde X?" e posta num
canal (embeds vermelhos/laranjas). Tambem vigia se a API, o banco e o site estao no ar e avisa quando caem/voltam.
Este arquivo NAO importa discord.py - so' decide O QUE postar e guarda ONDE parou - para poder ser testado sem o Discord.

COMO NAO FAZER SPAM (o ponto principal deste arquivo):
  - cada problema da API ja' vem agrupado (um por tipo de erro + local + rota) com um contador de ocorrencias;
  - o PRIMEIRO aviso sai na hora;
  - se o mesmo problema continua acontecendo, so' ha' um novo aviso a cada COOLDOWN (10 min), dizendo quantas vezes
    ocorreu desde o ultimo aviso - um erro em loop nao enche o canal;
  - problema marcado como resolvido no painel nao e' repostado (a menos que volte a acontecer: ai' ele reabre e conta como novo).
  - o estado (ids ja' avisados e contadores) fica em error_state.json: reiniciar o bot nao repete avisos.

Cada problema traz `hintPt`: explicacao em portugues (causa provavel e o que fazer) gerada pela API; vira um campo no aviso.

Privacidade: a API nao manda traceback nem IP para o bot; aqui so' mostramos titulo, mensagem curta (ja' mascarada pela
API), local no codigo, rota e contador.
"""
import json
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

COOLDOWN = timedelta(minutes=10)    # intervalo minimo entre dois avisos do MESMO problema
OVERLAP = timedelta(minutes=3)      # quanto "voltamos no tempo" a cada consulta (a deduplicacao e' pelo estado abaixo)
MAX_TRACKED = 500                   # quantos problemas lembrar
MAX_TEXT = 350
UPTIME_WINDOW = 1440                # checagens lembradas por servico para o % de disponibilidade (1 dia a cada 60s)
DOWN_AFTER = 3                      # falhas seguidas ate' considerar um servico fora do ar

SOURCE_LABEL = {"api": "API", "web": "Website", "deepl": "DeepL translation", "security": "Security"}
SOURCE_ICON = {"api": "🔴", "web": "🖥️", "deepl": "🌐", "security": "🛡️"}
COLORS = {"error": 0xE74C3C, "warning": 0xE67E22, "recovered": 0x2ECC71, "down": 0xC0392B}


@dataclass
class ErrorFeedState:
    """Onde o feed parou: instante da ultima consulta + para cada problema ja' avisado (contador e hora do aviso)."""
    since: datetime
    posted: dict[str, dict] = field(default_factory=dict)  # fingerprint -> {"count": int, "at": iso}


def _clip(text: str, limit: int = MAX_TEXT) -> str:
    """Corta texto longo (e tira quebras de linha) para caber no embed."""
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _parse_time(value: str) -> datetime:
    """Le o ISO 8601 da API (aceita 'Z') e garante fuso UTC."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def query_since(state: ErrorFeedState) -> datetime:
    """Instante a enviar para a API: o ultimo visto menos a sobreposicao."""
    return state.since - OVERLAP


def decide(state: ErrorFeedState, entries: list[dict], now: datetime) -> list[tuple[dict, int]]:
    """
    Escolhe quais problemas merecem uma mensagem AGORA e ATUALIZA o estado. Devolve [(problema, ocorrencias_desde_o_ultimo_aviso)].
    Regras: nunca avisado -> avisa; ja' avisado + resolvido -> nao; ja' avisado + contador subiu + passou o cooldown -> avisa de novo.
    """
    out: list[tuple[dict, int]] = []
    for e in entries:
        fp, count = e["fingerprint"], int(e["count"])
        last = _parse_time(e["lastSeen"])
        if last > state.since:
            state.since = last
        previous = state.posted.get(fp)
        if previous is None:
            if e.get("resolved"):
                continue
            state.posted[fp] = {"count": count, "at": now.isoformat()}
            out.append((e, count))
        elif e.get("resolved"):
            state.posted[fp]["count"] = count  # acompanha o contador sem avisar
        elif count > previous["count"] and now - _parse_time(previous["at"]) >= COOLDOWN:
            out.append((e, count - previous["count"]))
            state.posted[fp] = {"count": count, "at": now.isoformat()}
    # mantem o estado pequeno: esquece os avisos mais antigos
    if len(state.posted) > MAX_TRACKED:
        keep = sorted(state.posted.items(), key=lambda kv: kv[1]["at"])[-MAX_TRACKED:]
        state.posted = dict(keep)
    return out


def format_error(entry: dict, since_last: int) -> dict:
    """Transforma um problema em {title, description, color, fields, footer, timestamp} (o main.py monta o embed)."""
    source = entry.get("source", "api")
    first_time = since_last == int(entry["count"])
    title = f"{SOURCE_ICON.get(source, '⚠️')} {SOURCE_LABEL.get(source, source)}: {_clip(entry['title'], 200)}"
    fields: list[tuple[str, str]] = []
    if entry.get("location"):
        fields.append(("Where in the code", f"`{_clip(entry['location'], 200)}`"))
    if entry.get("path"):
        route = f"{entry['method'] + ' ' if entry.get('method') else ''}{entry['path']}"
        fields.append(("Route / page", f"`{_clip(route, 200)}`"))
    if entry.get("status"):
        fields.append(("HTTP status", str(entry["status"])))
    if entry.get("hintPt"):
        fields.append(("💡 O que pode estar acontecendo", _clip(entry["hintPt"], 900)))
    fields.append(("Occurrences", f"{entry['count']} total" + ("" if first_time else f" (+{since_last} since the last alert)")))
    return {
        "title": title,
        "description": _clip(entry.get("message", ""), MAX_TEXT) or None,
        "color": COLORS.get(entry.get("level", "error"), COLORS["error"]),
        "fields": fields,
        "footer": "New problem — details and traceback in the panel: /admin/errors" if first_time else "Still happening — /admin/errors",
        "timestamp": _parse_time(entry["lastSeen"]),
    }


@dataclass
class ServiceStatus:
    """Estado de um servico vigiado (API, banco, site): falhas seguidas e se ja' avisamos que caiu."""
    name: str
    failures: int = 0
    down: bool = False
    down_since: datetime | None = None
    last_ok: bool | None = None          # resultado da ultima checagem (None = ainda nao checou ou nao da' pra saber)
    last_ms: int | None = None           # tempo de resposta da ultima checagem, em milissegundos
    history: deque = field(default_factory=lambda: deque(maxlen=UPTIME_WINDOW))  # True/False de cada checagem (so' em memoria)


def record_check(status: ServiceStatus, ok: bool | None, ms: int | None = None) -> None:
    """Anota o resultado da checagem para o painel ao vivo. ok=None = nao deu para saber (ex.: banco com a API fora do ar)."""
    status.last_ok, status.last_ms = ok, ms
    if ok is not None:
        status.history.append(ok)


def uptime_pct(status: ServiceStatus) -> float | None:
    """% de checagens OK desde que o bot ligou (ate' UPTIME_WINDOW delas); None se ainda nao ha' nenhuma."""
    if not status.history:
        return None
    return 100.0 * sum(status.history) / len(status.history)


def format_status_panel(statuses: list[ServiceStatus], checked_at: datetime, interval_seconds: int, site_monitored: bool) -> dict:
    """Texto do painel ao vivo (uma mensagem so', editada a cada checagem). O 'ha' X segundos' e' do Discord e atualiza sozinho na tela."""
    lines = []
    for st in statuses:
        if st.last_ok is None:
            lines.append(f"⚪ **{st.name}** — unknown (waiting for the API)")
            continue
        icon, word = ("🟢", "online") if st.last_ok else ("🔴", "OFFLINE")
        extra = []
        if st.last_ok and st.last_ms is not None:
            extra.append(f"{st.last_ms} ms")
        pct = uptime_pct(st)
        if pct is not None:
            extra.append(f"{pct:.1f}% uptime")
        lines.append(f"{icon} **{st.name}** — {word}" + (f" · {' · '.join(extra)}" if extra else ""))
    if not site_monitored:
        lines.append("⚪ **Website** — not monitored (set SITE_URL in the bot .env)")
    lines.append(f"\nLast check <t:{int(checked_at.timestamp())}:R> · every {interval_seconds}s · uptime counts since the bot started")
    known = [st.last_ok for st in statuses if st.last_ok is not None]
    return {"title": "📡 NinWiki status", "description": "\n".join(lines), "color": COLORS["recovered"] if known and all(known) else COLORS["down"]}


class StatusMessageStore:
    """Guarda qual mensagem do Discord e' o painel ao vivo (para editar a mesma depois de reiniciar o bot)."""

    def __init__(self, path: Path):
        self.path = path

    def load(self) -> tuple[int, int] | None:
        """(id do canal, id da mensagem) salvos, ou None."""
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return int(raw["channel_id"]), int(raw["message_id"])
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def save(self, channel_id: int, message_id: int) -> None:
        """Grava os ids (escrita atomica)."""
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"channel_id": str(channel_id), "message_id": str(message_id)}), encoding="utf-8")
        tmp.replace(self.path)


def update_status(status: ServiceStatus, ok: bool, now: datetime, down_after: int = DOWN_AFTER) -> dict | None:
    """
    Registra o resultado de UMA checagem. So' devolve mensagem nas MUDANCAS: caiu (DOWN_AFTER falhas seguidas) ou voltou.
    Uma falha isolada (rede oscilando) nao dispara nada.
    """
    if ok:
        status.failures = 0
        if status.down:
            minutes = max(1, int((now - (status.down_since or now)).total_seconds() // 60))
            status.down, status.down_since = False, None
            return {"title": f"🟢 {status.name} is back online", "description": f"It was unreachable for about {minutes} min.", "color": COLORS["recovered"]}
        return None
    status.failures += 1
    if status.failures >= down_after and not status.down:
        status.down, status.down_since = True, now
        return {"title": f"🔴 {status.name} is DOWN", "description": f"{down_after} checks in a row failed. Visitors and the panel may be affected.", "color": COLORS["down"]}
    return None


class ErrorFeedStore:
    """Guarda/le o estado do feed de erros num arquivo JSON (sobrevive a reinicio do bot)."""

    def __init__(self, path: Path):
        self.path = path

    def load(self) -> ErrorFeedState:
        """Estado salvo, ou 'a partir de agora' se nao existir/estiver corrompido (nunca despeja o historico antigo)."""
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            posted = {str(k): {"count": int(v["count"]), "at": str(v["at"])} for k, v in raw.get("posted", {}).items()}
            return ErrorFeedState(since=_parse_time(raw["since"]), posted=posted)
        except (OSError, ValueError, KeyError, TypeError):
            return ErrorFeedState(since=datetime.now(timezone.utc))

    def save(self, state: ErrorFeedState) -> None:
        """Grava o estado (escrita atomica: arquivo temporario + rename)."""
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"since": state.since.isoformat(), "posted": state.posted}), encoding="utf-8")
        tmp.replace(self.path)
