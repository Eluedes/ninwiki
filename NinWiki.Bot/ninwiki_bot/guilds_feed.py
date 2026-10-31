"""
Painel de SERVIDORES do bot (sem comando de barra): UMA mensagem fixa num canal privado do dono, que o bot cria na 1a vez e EDITA a cada mudanca
(total de servidores, total de membros e a lista por numero de membros), mais um LOG com uma mensagem NOVA a cada entrada/saida de servidor.
Mesmo padrao do "Latest updates": estado em guilds_state.json (id da mensagem + hash do ultimo conteudo + servidores conhecidos), escrita atomica.
Tambem compara os servidores conhecidos com os atuais ao ligar, para registrar quem entrou/saiu ENQUANTO o bot estava desligado.
Usa so' a intent `guilds` (padrao, nao privilegiada). Os textos deste canal (do dono) sao sempre em ingles, como os outros feeds de equipe.
"""
import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import discord

from ninwiki_bot._util import parse_time, read_json, write_json_atomic

log = logging.getLogger("ninwiki_bot")

NO_MENTIONS = discord.AllowedMentions.none()
PANEL_COLOR, JOIN_COLOR, LEAVE_COLOR = 0x3498DB, 0x2ECC71, 0xE74C3C
MAX_EMBEDS = 10        # limite do Discord por mensagem
DESC_LIMIT = 4000      # descricao de embed: 4096; folga para o titulo
TOTAL_LIMIT = 5800     # o Discord soma TODOS os embeds de uma mensagem: maximo 6000 caracteres
RESERVE = 200          # folga para titulo, rodape e a linha '+N servers'
DEBOUNCE_SECONDS = 5   # junta varias entradas/saidas seguidas numa unica edicao (protege o limite de taxa)


def snapshot(guilds, now: datetime | None = None) -> list[dict]:
    """Foto simples dos servidores atuais: [{id (texto), name, members, joined (ISO), owner_id, locale}], sem ordenar."""
    now = now or datetime.now(timezone.utc)
    out = []
    for g in guilds:
        me_joined = getattr(getattr(g, "me", None), "joined_at", None)
        out.append({"id": str(g.id), "name": str(g.name), "members": int(g.member_count or 0), "joined": (me_joined or now).isoformat(),
                    "owner_id": str(g.owner_id) if getattr(g, "owner_id", None) else "", "locale": str(getattr(g, "preferred_locale", "") or "")})
    return out


def diff_known(known: dict | None, snaps: list[dict]) -> tuple[list[dict], list[dict]]:
    """(entraram, sairam) comparando o que o bot sabia com o que ve' agora. `known` None = 1a vez (sem historico): nada entrou/saiu, so' vira a base."""
    if known is None:
        return [], []
    now_ids = {s["id"] for s in snaps}
    return [s for s in snaps if s["id"] not in known], [{"id": i, **v} for i, v in known.items() if i not in now_ids]


def _name(text: str, limit: int = 40) -> str:
    """Nome de servidor seguro para o Discord: sem markdown (* _ ` ~ | >), sem @everyone/@here e cortado."""
    clean = " ".join(str(text).split())[:limit]
    return discord.utils.escape_mentions(discord.utils.escape_markdown(clean)).replace("@", "@​")


def _stamp(iso: str) -> str:
    """Data do Discord (<t:...:d>) a partir de um ISO 8601."""
    return f"<t:{int(parse_time(iso).timestamp())}:d>"


def build_panel_embeds(snaps: list[dict]) -> list[dict]:
    """
    Embeds do painel (como dicts do Discord, comparaveis por hash). Ordem: mais membros primeiro. Respeita 4096 por descricao, 10 embeds e 6000
    caracteres no total; o que nao couber vira a ultima linha '+N servers'. O 1o embed leva o total de servidores e de membros.
    """
    ordered = sorted(snaps, key=lambda s: (-s["members"], s["name"].lower(), s["id"]))
    total = sum(s["members"] for s in ordered)
    lines = [f"**{i}.** {_name(s['name'])} · `{s['id']}` · **{s['members']:,}** members · joined {_stamp(s['joined'])}" for i, s in enumerate(ordered, 1)]
    chunks: list[list[str]] = [[]]
    used, size, shown = 0, 0, 0
    for line in lines:
        if used + len(line) + 1 > TOTAL_LIMIT - RESERVE or len(line) + 1 > DESC_LIMIT:
            break
        if size + len(line) + 1 > DESC_LIMIT:
            if len(chunks) == MAX_EMBEDS:
                break
            chunks.append([]); size = 0
        chunks[-1].append(line); used += len(line) + 1; size += len(line) + 1; shown += 1
    if shown < len(lines):
        chunks[-1].append(f"**+{len(lines) - shown} more servers** (not listed: Discord message size limit)")
    embeds = [{"description": "\n".join(c), "color": PANEL_COLOR} for c in chunks]
    embeds[0]["title"] = f"🌐 Servers: {len(ordered):,} · {total:,} members"
    embeds[-1]["footer"] = {"text": "Edited automatically when something changes"}
    return embeds


def build_event_embed(joined: bool, snap: dict, stayed_seconds: float | None = None, offline: bool = False) -> dict:
    """Embed do LOG de entrada (verde) / saida (vermelho) como dict: nome, id, membros, dono (so' o id, sem mencionar), idioma e, ao sair, quanto tempo ficou."""
    fields = [("Name", _name(snap["name"], 100)), ("ID", f"`{snap['id']}`"), ("Members", f"{snap.get('members', 0):,}")]
    if snap.get("owner_id"):
        fields.append(("Owner ID", f"`{snap['owner_id']}`"))
    if snap.get("locale"):
        fields.append(("Locale", snap["locale"]))
    if not joined and stayed_seconds is not None:
        days, rest = divmod(int(max(stayed_seconds, 0)), 86400)
        fields.append(("Stayed", f"{days}d {rest // 3600}h {rest % 3600 // 60}m"))
    return {"title": "✅ Joined server" if joined else "❌ Left server", "color": JOIN_COLOR if joined else LEAVE_COLOR,
            "fields": [{"name": n, "value": v, "inline": True} for n, v in fields],
            **({"footer": {"text": "Detected on restart (it happened while the bot was offline)"}} if offline else {})}


def content_hash(embeds: list[dict]) -> str:
    """Hash do conteudo do painel: so' edita a mensagem se mudou."""
    return hashlib.sha256(json.dumps(embeds, sort_keys=True).encode()).hexdigest()


class GuildsFeed:
    """Mantem o painel de servidores e o log de entrada/saida. `client` = o bot (so' usa .guilds, .get_channel e .fetch_channel)."""

    def __init__(self, client, channel_id: int, log_channel_id: int | None, state_path: Path):
        self.client, self.channel_id, self.log_channel_id, self.path = client, channel_id, log_channel_id or channel_id, state_path
        raw = read_json(state_path)
        known = raw.get("known") if isinstance(raw, dict) else None
        self.known: dict | None = known if isinstance(known, dict) else None   # None = nunca rodou (1a vez: so' vira a base, sem log falso)
        self.message_id: int | None = int(raw["message_id"]) if isinstance(raw, dict) and str(raw.get("message_id") or "").isdigit() else None
        self.hash: str = raw.get("hash", "") if isinstance(raw, dict) else ""
        self.started = False
        self._lock = asyncio.Lock()
        self._pending: asyncio.Task | None = None
        self._warned: set[int] = set()   # canais ja' avisados no log (nao repete o aviso de falta de permissao)

    def _save(self) -> None:
        """Grava o estado (escrita atomica; ids como texto)."""
        write_json_atomic(self.path, {"message_id": str(self.message_id) if self.message_id else None, "hash": self.hash, "known": self.known or {}})

    async def _channel(self, channel_id: int):
        """O canal (cache ou busca) ou None se nao existe / o bot nao enxerga (avisa 1 vez no log do terminal)."""
        try:
            return self.client.get_channel(channel_id) or await self.client.fetch_channel(channel_id)
        except discord.DiscordException as e:   # NotFound / Forbidden / HTTPException
            if channel_id not in self._warned:
                self._warned.add(channel_id)
                log.warning("Painel de servidores: canal %s indisponivel (nao existe ou o bot nao tem 'Ver canal'): %s", channel_id, e)
            return None

    async def _log_event(self, embed: dict) -> None:
        """Manda uma mensagem NOVA com o embed no canal de log (sem mencoes); falha de permissao so' vai para o terminal."""
        channel = await self._channel(self.log_channel_id)
        if channel is None:
            return
        try:
            await channel.send(embed=discord.Embed.from_dict(embed), allowed_mentions=NO_MENTIONS)
        except discord.DiscordException as e:
            log.warning("Painel de servidores: nao consegui postar no log (precisa de Ver canal + Enviar mensagens + Inserir links): %s", e)

    async def refresh(self, snaps: list[dict] | None = None) -> None:
        """Cria/edita a mensagem do painel SE o conteudo mudou (hash); se a mensagem foi apagada, cria outra."""
        async with self._lock:
            snaps = snaps if snaps is not None else snapshot(self.client.guilds)
            embeds = build_panel_embeds(snaps)
            digest = content_hash(embeds)
            if digest == self.hash and self.message_id:
                return
            channel = await self._channel(self.channel_id)
            if channel is None:
                return
            objs = [discord.Embed.from_dict(e) for e in embeds]
            try:
                if self.message_id:
                    try:
                        await channel.get_partial_message(self.message_id).edit(embeds=objs, allowed_mentions=NO_MENTIONS)
                    except discord.NotFound:
                        self.message_id = None   # apagaram: cria outra abaixo
                if not self.message_id:
                    self.message_id = (await channel.send(embeds=objs, allowed_mentions=NO_MENTIONS)).id
            except discord.DiscordException as e:
                log.warning("Painel de servidores: nao consegui criar/editar a mensagem (precisa de Ver canal + Enviar mensagens + Inserir links): %s", e)
                return
            self.hash = digest
            self._save()

    async def startup(self) -> None:
        """Ao ligar: registra no log quem entrou/saiu com o bot desligado, atualiza a base de servidores conhecidos e o painel."""
        snaps = snapshot(self.client.guilds)
        joined, left = diff_known(self.known, snaps)
        now = datetime.now(timezone.utc)
        for s in joined:
            await self._log_event(build_event_embed(True, s, offline=True))
        for k in left:
            await self._log_event(build_event_embed(False, k, (now - parse_time(k["first_seen"])).total_seconds() if k.get("first_seen") else None, offline=True))
        old = self.known or {}
        self.known = {s["id"]: {"name": s["name"], "members": s["members"], "owner_id": s["owner_id"], "locale": s["locale"],
                                "first_seen": (old.get(s["id"]) or {}).get("first_seen") or s["joined"]} for s in snaps}
        self._save()
        self.started = True
        await self.refresh(self._current())

    def _joined_of(self, snap: dict) -> dict:
        """Snapshot com a data de entrada ja' conhecida (a guardada), para o painel nao 'mudar' sozinho."""
        return {**snap, "joined": (self.known or {}).get(snap["id"], {}).get("first_seen") or snap["joined"]}

    async def on_join(self, guild) -> None:
        """Bot entrou num servidor: guarda a data, posta no log e agenda a edicao do painel."""
        if not self.started:
            return   # o startup() ainda vai ver este servidor (e registrar como 'detectado ao reiniciar')
        snap = snapshot([guild])[0]
        self.known = {**(self.known or {}), snap["id"]: {"name": snap["name"], "members": snap["members"], "owner_id": snap["owner_id"], "locale": snap["locale"], "first_seen": snap["joined"]}}
        self._save()
        await self._log_event(build_event_embed(True, snap))
        self.schedule_refresh()

    async def on_remove(self, guild) -> None:
        """Bot saiu/foi removido de um servidor: posta no log (com quanto tempo ficou), esquece o servidor e agenda a edicao do painel."""
        if not self.started:
            return
        sid = str(guild.id)
        prev = (self.known or {}).get(sid) or {}
        snap = {**prev, **snapshot([guild])[0]}
        stayed = (datetime.now(timezone.utc) - parse_time(prev["first_seen"])).total_seconds() if prev.get("first_seen") else None
        self.known = {k: v for k, v in (self.known or {}).items() if k != sid}
        self._save()
        await self._log_event(build_event_embed(False, snap, stayed))
        self.schedule_refresh()

    def schedule_refresh(self) -> None:
        """Agenda UMA edicao do painel daqui a poucos segundos (varias mudancas seguidas viram uma so': protege o limite de taxa do Discord)."""
        if self._pending and not self._pending.done():
            return
        self._pending = asyncio.ensure_future(self._debounced())

    async def _debounced(self) -> None:
        """Espera um pouco e atualiza; erro inesperado vai para o log (o periodico tenta de novo)."""
        try:
            await asyncio.sleep(DEBOUNCE_SECONDS)
            await self.refresh(self._current())
        except Exception:   # noqa: BLE001 - o bot nao pode cair por causa do painel
            log.exception("Painel de servidores: atualizacao falhou")

    def _current(self) -> list[dict]:
        """Servidores atuais com a data de entrada guardada."""
        return [self._joined_of(s) for s in snapshot(self.client.guilds)]

    async def tick(self) -> None:
        """Volta periodica (a cada ~30 min): na 1a vez faz o startup(); depois so' confere (o hash evita editar sem mudanca; pega mudanca de membros/nome)."""
        if not self.started:
            await self.startup()
        else:
            await self.refresh(self._current())
