"""
NinWiki.Bot - ponto de entrada.

Como rodar (na pasta NinWiki.Bot, com o venv DO BOT ativado):
    python main.py

Pre-requisitos: ver README.md (criar o bot no Discord, .env, API rodando).
"""
import copy
import functools
import io
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
import os

import aiohttp
import discord
from discord import app_commands
from discord.ext import tasks
from pydantic import ValidationError

from ninwiki_bot.api_client import ApiError, NinWikiApi
from ninwiki_bot.backup_feed import BackupStore, format_size, is_due, messages_to_delete, part_filename, parts_needed, stamp_of
from ninwiki_bot.command_sync import sync_commands, target_guilds
from ninwiki_bot.config import BotSettings
from ninwiki_bot.error_feed import ErrorFeedStore, ServiceStatus, StatusMessageStore, decide, format_error, format_report, format_status_panel, query_since as errors_query_since, record_check, update_status
from ninwiki_bot.log_feed import LogFeedStore, format_entry, pick_new, query_since
from ninwiki_bot.guilds_feed import GuildsFeed
from ninwiki_bot.language import LanguageStore
from ninwiki_bot.member_sync import MemberSync, SYNC_MINUTES
from ninwiki_bot.public_commands import register_public_commands, set_logo_url
from ninwiki_bot.site_url import escolher_site_url
from ninwiki_bot.version_feed import VersionStore, build_embed as build_version_embed, merge as merge_versions

# Pasta dos arquivos *_state.json. Padrao: ao lado do main.py (SquareCloud/local). No Docker/Azure: BOT_STATE_DIR=/data (volume), para o container poder ser read_only.
STATE_DIR = Path(os.getenv("BOT_STATE_DIR") or Path(__file__).resolve().parent)

log = logging.getLogger("ninwiki_bot")


def _safe(tick):
    """Protege uma volta dos feeds: qualquer erro inesperado (nao so' ApiError/Discord) vai para o log e a proxima volta acontece.
    Sem isto o discord.ext.tasks PARA o loop de vez na primeira excecao e o feed morre calado ate' o bot reiniciar."""
    @functools.wraps(tick)
    async def wrapper() -> None:
        """Roda a volta; engole (e registra) o que escapar."""
        try:
            await tick()
        except Exception:   # noqa: BLE001 - o feed precisa continuar vivo
            log.exception("Volta do feed %s falhou (tento de novo no proximo ciclo)", getattr(tick, "__name__", "?"))
    return wrapper


async def _safe_call(fn, *args) -> None:
    """Roda um evento do Discord sem deixar excecao escapar (o painel de servidores nunca pode derrubar o bot)."""
    try:
        await fn(*args)
    except Exception:   # noqa: BLE001
        log.exception("Evento do painel de servidores falhou")


class NinWikiBot(discord.Client):
    """O bot: busca publica (/search, /status, /language) + (opcional) feed do log geral num canal do Discord."""

    def __init__(self, settings: BotSettings, members_intent: bool | None = None):
        # Intents PADRAO (sem nenhuma privilegiada) + (opcional) a "Server Members Intent", privilegiada: so' para LER os cargos dos leitores
        # do site e a API preencher vila/rank do perfil. Sem ela (members_intent=False) o resto do bot funciona igual.
        intents = discord.Intents.default()
        self.members_intent = settings.member_roles_sync if members_intent is None else members_intent
        intents.members = self.members_intent
        super().__init__(intents=intents)
        self.settings = settings
        self.tree = app_commands.CommandTree(self)
        self.api = NinWikiApi(settings.ninwiki_api_url, settings.bot_api_token)
        # Feed do log: estado (onde parou) guardado em arquivo ao lado do bot, para sobreviver a reinicio.
        self.feed_store = LogFeedStore(STATE_DIR / "log_state.json")
        self.feed_state = self.feed_store.load()
        self._health_announced = False  # o aviso "monitor ligado" sai uma vez por inicializacao do bot
        self._feed_failing = False  # so' avisa no terminal na PRIMEIRA falha de uma sequencia (sem spam)
        self.log_loop = tasks.loop(seconds=settings.log_poll_seconds)(_safe(self._log_tick))
        self.log_loop.before_loop(self.wait_until_ready)
        # Feed de ERROS do wiki (+ vigia de API/banco/site): estado em arquivo, mesmo esquema do feed de log.
        self.error_store = ErrorFeedStore(STATE_DIR / "error_state.json")
        self.error_state = self.error_store.load()
        self._errors_failing = False
        self.error_loop = tasks.loop(seconds=settings.log_poll_seconds)(_safe(self._error_tick))
        self.error_loop.before_loop(self.wait_until_ready)
        self.statuses = {"API": ServiceStatus("API"), "Database": ServiceStatus("Database"), "Website": ServiceStatus("Website")}
        self.languages = LanguageStore(STATE_DIR / "language_state.json")
        self.status_store = StatusMessageStore(STATE_DIR / "status_state.json")
        self.health_loop = tasks.loop(seconds=settings.health_poll_seconds)(_safe(self._health_tick))
        self.health_loop.before_loop(self.wait_until_ready)
        # Mensagem "Latest updates" (webhook, editada a cada deploy) e backup periodico (canal privado).
        self.version_store = VersionStore(STATE_DIR / "version_state.json")
        self.version_loop = tasks.loop(seconds=120)(_safe(self._version_tick))
        self.version_loop.before_loop(self.wait_until_ready)
        self.backup_store = BackupStore(STATE_DIR / "backup_state.json")
        self.backup_loop = tasks.loop(minutes=settings.backup_interval_minutes)(_safe(self._backup_tick))
        self.backup_loop.before_loop(self.wait_until_ready)
        # Painel de servidores (sem comando): mensagem editada + log de entrada/saida; a 1a volta do loop (apos o bot ficar pronto) faz a sincronizacao inicial.
        self.guilds_feed = GuildsFeed(self, settings.guilds_channel_id, settings.guilds_log_channel_id, STATE_DIR / "guilds_state.json") if settings.guilds_channel_id else None
        self.guilds_loop = tasks.loop(minutes=30)(_safe(self._guilds_tick))
        self.guilds_loop.before_loop(self.wait_until_ready)
        # Cargos dos leitores -> API (vila/rank do perfil): sincronizacao completa ao ligar e a cada 30 min; o resto vem pelos eventos de membro.
        self.member_sync = MemberSync(self, self.api, settings.member_list_sync) if self.members_intent else None
        self.members_loop = tasks.loop(minutes=SYNC_MINUTES)(_safe(self._members_tick))
        self.members_loop.before_loop(self.wait_until_ready)

        @self.tree.error
        async def on_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError) -> None:
            """Erro inesperado em um comando: registra no terminal e responde algo generico (sem vazar detalhe)."""
            # Erro inesperado: registra no terminal e responde algo generico -
            # nunca despeja detalhe interno (stack trace, URL, token) no Discord.
            if isinstance(error, app_commands.CommandOnCooldown):
                # Freio por pessoa nos comandos publicos (/status, /search): resposta simples, sem registrar como erro.
                return await interaction.response.send_message(f"⏳ Slow down / Calma - {error.retry_after:.0f}s.", ephemeral=True)
            log.exception("Erro num comando", exc_info=error)
            message = "❌ Something went wrong. Try again; if it keeps happening, tell whoever maintains the bot."
            try:
                if interaction.response.is_done():
                    await interaction.followup.send(message, ephemeral=True)
                else:
                    await interaction.response.send_message(message, ephemeral=True)
            except discord.HTTPException as exc:   # interacao ja' expirou (10062): nao ha' como responder, so' registra
                log.warning("Nao consegui avisar o erro ao usuario: %s", exc)

    async def _log_tick(self) -> None:
        """Uma volta do feed: busca acoes novas na API e posta no canal de log (embeds, ate' 10 por mensagem)."""
        try:
            channel = self.get_channel(self.settings.log_channel_id) or await self.fetch_channel(self.settings.log_channel_id)
            entries = await self.api.audit_log_since(query_since(self.feed_state).isoformat(), include_ip=self.settings.log_show_ip)
            # Trabalha numa COPIA do estado: so' "confirma" depois que o envio deu certo (senao tentaria de novo, sem perder nada).
            new_state = copy.deepcopy(self.feed_state)
            fresh = [e for e in pick_new(new_state, entries) if e["action"] not in self.settings.ignored_log_actions]
            for i in range(0, len(fresh), 10):
                embeds = []
                for e in fresh[i : i + 10]:
                    f = format_entry(e)
                    embed = discord.Embed(title=f["title"], description=f["description"] or None, color=f["color"], timestamp=f["timestamp"])
                    embed.set_footer(text=f["footer"])
                    embeds.append(embed)
                await channel.send(embeds=embeds, allowed_mentions=discord.AllowedMentions.none())
            self.feed_state = new_state
            self.feed_store.save(self.feed_state)
            self._feed_failing = False
        except (ApiError, discord.DiscordException) as e:
            if not self._feed_failing:
                log.warning("Feed de log falhou (tento de novo no proximo ciclo): %s", e)
            self._feed_failing = True

    async def _log_channel(self) -> discord.abc.Messageable | None:
        """O canal do feed de log (LOG_CHANNEL_ID) ou None se nao estiver configurado."""
        channel_id = self.settings.log_channel_id
        if not channel_id:
            return None
        return self.get_channel(channel_id) or await self.fetch_channel(channel_id)

    async def _errors_channel(self) -> discord.abc.Messageable:
        """O canal de erros (ERROR_CHANNEL_ID, ou o de log se aquele estiver vazio)."""
        channel_id = self.settings.errors_channel
        return self.get_channel(channel_id) or await self.fetch_channel(channel_id)

    async def _status_channel(self) -> discord.abc.Messageable:
        """O canal do monitor de saude (STATUS_CHANNEL_ID, ou o de erros/log se aquele estiver vazio)."""
        channel_id = self.settings.status_channel
        return self.get_channel(channel_id) or await self.fetch_channel(channel_id)

    async def _error_tick(self) -> None:
        """Uma volta do feed de erros: busca problemas novos na API e posta os que merecem aviso (ver error_feed.decide)."""
        try:
            channel = await self._errors_channel()
            entries = await self.api.errors_since(errors_query_since(self.error_state).isoformat())
            new_state = copy.deepcopy(self.error_state)
            to_post = decide(new_state, entries, datetime.now(timezone.utc))
            for i in range(0, len(to_post), 10):
                embeds = []
                for entry, since_last in to_post[i : i + 10]:
                    f = format_error(entry, since_last)
                    embed = discord.Embed(title=f["title"], description=f["description"], color=f["color"], timestamp=f["timestamp"])
                    for name, value in f["fields"]:
                        embed.add_field(name=name, value=value, inline=True)
                    embed.set_footer(text=f["footer"])
                    embeds.append(embed)
                await channel.send(embeds=embeds, allowed_mentions=discord.AllowedMentions.none())
            # Reports de visitantes novos (mesmo canal): na 1a vez comeca "a partir de agora" para nao despejar o historico.
            if new_state.reports_since is None:
                new_state.reports_since = datetime.now(timezone.utc)
            else:
                reports = await self.api.reports_since(new_state.reports_since.isoformat())
                for r in reports:
                    f = format_report(r, self.settings.site_url)
                    embed = discord.Embed(title=f["title"], description=f["description"], color=f["color"], timestamp=f["timestamp"])
                    for name, value in f["fields"]:
                        embed.add_field(name=name, value=value, inline=True)
                    embed.set_footer(text=f["footer"])
                    await channel.send(embed=embed, allowed_mentions=discord.AllowedMentions.none())
                    new_state.reports_since = max(new_state.reports_since, datetime.fromisoformat(r["createdAt"].replace("Z", "+00:00")))
            self.error_state = new_state
            self.error_store.save(self.error_state)
            self._errors_failing = False
        except (ApiError, discord.DiscordException) as e:
            if not self._errors_failing:
                log.warning("Feed de erros falhou (tento de novo no proximo ciclo): %s", e)
            self._errors_failing = True

    async def _update_status_panel(self, channel: discord.abc.Messageable, embed: discord.Embed) -> None:
        """Edita a mensagem do painel ao vivo; se ela foi apagada (ou ainda nao existe) cria outra e lembra o id."""
        saved = self.status_store.load()
        if saved and saved[0] == getattr(channel, "id", None):
            try:
                await channel.get_partial_message(saved[1]).edit(embed=embed)
                return
            except discord.NotFound:
                pass  # alguem apagou a mensagem: cria outra abaixo
        msg = await channel.send(embed=embed, allowed_mentions=discord.AllowedMentions.none())
        self.status_store.save(channel.id, msg.id)

    async def _refresh_site_url(self) -> None:
        """Atualiza o endereco do site com o que a API informa (FRONTEND_ORIGIN dela): numa troca de dominio o bot acompanha sozinho, sem mexer no SITE_URL do bot.
        Se a API nao responde ou devolve algo invalido, fica o que ja' havia (SITE_URL do .env ou o ultimo bom)."""
        try:
            cfg = await self.api.bot_config()
        except ApiError:
            return
        novo = escolher_site_url(self.settings.site_url, str(cfg.get("siteUrl") or ""))
        if novo != self.settings.site_url:
            log.warning("Endereco do site atualizado pela API: %s -> %s", self.settings.site_url or "(vazio)", novo)
            self.settings.site_url = novo

    async def _check_services(self) -> tuple[dict[str, bool | None], dict[str, int | None]]:
        """Pergunta agora se API, banco e site respondem (e em quantos ms). None = nao da' pra saber (banco com a API fora)."""
        await self._refresh_site_url()
        t0 = time.monotonic()
        api_up, db_up = await self.api.api_status()
        api_ms = int((time.monotonic() - t0) * 1000)
        # None = "nao da' pra saber": com a API fora do ar nao existe resposta do banco (antes aparecia como online por engano).
        results: dict[str, bool | None] = {"API": api_up, "Database": db_up if api_up else None}
        timings: dict[str, int | None] = {"API": api_ms, "Database": api_ms if api_up else None}
        if self.settings.site_url:
            t0 = time.monotonic()
            results["Website"] = await self.api.site_ok(self.settings.site_health_url or self.settings.site_url)
            if not results["Website"]:
                log.warning("Site fora do ar na checagem (%s): %s", self.settings.site_health_url or self.settings.site_url, self.api.last_site_detail or "sem detalhe")
            timings["Website"] = int((time.monotonic() - t0) * 1000)
        return results, timings

    async def check_now(self) -> list[ServiceStatus]:
        """Para o /status: confere agora e devolve o estado de cada servico (a historia de uptime continua a mesma)."""
        results, timings = await self._check_services()
        for name, ok in results.items():
            record_check(self.statuses[name], ok, timings[name])
        return [self.statuses[n] for n in results]

    async def _health_tick(self) -> None:
        """Confere se API, banco e site estao no ar; avisa quando algum cai ou volta e mantem o painel ao vivo atualizado."""
        now = datetime.now(timezone.utc)
        results, timings = await self._check_services()
        messages = []
        for name, ok in results.items():
            record_check(self.statuses[name], ok, timings[name])
            if ok is None:
                continue
            msg = update_status(self.statuses[name], ok, now, self.settings.status_down_after)
            # O painel ja' mostra o estado atual (editado a cada checagem): mensagens novas de "caiu/voltou" so' com STATUS_ALERTS=true.
            if msg and self.settings.status_alerts:
                messages.append(msg)
        panel = self.settings.status_panel
        if not self._health_announced:
            self._health_announced = True
            if not panel:
                # Sem painel ao vivo: diz como as coisas estao AGORA (para a equipe saber que o monitor esta' vivo).
                lines = [f"{'⚪' if ok is None else '🟢' if ok else '🔴'} **{name}** — {'unknown' if ok is None else 'online' if ok else 'OFFLINE'}" for name, ok in results.items()]
                if not self.settings.site_url:
                    lines.append("⚪ **Website** — not monitored (set SITE_URL in the bot .env)")
                messages.insert(0, {"title": "🤖 Nin Codex monitor started", "description": "\n".join(lines),
                                    "color": 0x2ECC71 if all(ok for ok in results.values() if ok is not None) else 0xE74C3C})
        if not messages and not panel:
            return
        try:
            channel = await self._status_channel()
            if messages:
                embeds = [discord.Embed(title=m["title"], description=m["description"], color=m["color"], timestamp=now) for m in messages]
                await channel.send(embeds=embeds, allowed_mentions=discord.AllowedMentions.none())
            if panel:
                f = format_status_panel([self.statuses[n] for n in results], now, self.settings.health_poll_seconds, bool(self.settings.site_url))
                await self._update_status_panel(channel, discord.Embed(title=f["title"], description=f["description"], color=f["color"], timestamp=now))
        except discord.DiscordException as e:
            log.warning("Nao consegui avisar no Discord sobre a mudanca de saude: %s", e)

    async def _version_tick(self) -> None:
        """A cada 2 min confere a versao publicada da API e do site; se mudou (deploy novo), EDITA a mesma mensagem do webhook (nunca cria outra, exceto se apagarem a antiga)."""
        try:
            api_build = await self.api.build_info()
        except ApiError:
            api_build = None
        web_build = await self.api.web_build(self.settings.site_health_url or self.settings.site_url) if self.settings.site_url else None
        state, changed = merge_versions(self.version_store.load(), api_build, web_build)
        if not changed:
            return
        e = build_version_embed(state)
        embed = discord.Embed(title=e["title"], color=e["color"], timestamp=datetime.now(timezone.utc))
        for name, value in e["fields"]:
            embed.add_field(name=name, value=value, inline=False)
        embed.set_footer(text=e["footer"])
        try:
            async with aiohttp.ClientSession() as session:
                webhook = discord.Webhook.from_url(self.settings.version_webhook_url, session=session)
                message_id = state.get("message_id")
                if message_id:
                    try:
                        await webhook.edit_message(message_id, embeds=[embed])
                    except discord.NotFound:
                        message_id = None   # apagaram a mensagem: cria outra abaixo
                if not message_id:
                    state["message_id"] = (await webhook.send(embeds=[embed], wait=True, username="Nin Codex deploys")).id
        except (discord.DiscordException, aiohttp.ClientError) as exc:
            log.warning("Nao consegui atualizar a mensagem de versao no webhook: %s", exc)
            return
        self.version_store.save(state)
        log.info("Mensagem de versao atualizada: API %s, Web %s", (state['api'] or {}).get('sha'), (state['web'] or {}).get('sha'))

    async def _guilds_tick(self) -> None:
        """A cada 30 min (e na 1a volta, ao ligar) confere os servidores; so' edita o painel se algo mudou."""
        await self.guilds_feed.tick()

    async def _members_tick(self) -> None:
        """A cada 30 min (e na 1a volta, ao ligar) manda a' API os servidores, os cargos e os cargos dos leitores."""
        await self.member_sync.full_sync()

    async def on_member_update(self, before: discord.Member, after: discord.Member) -> None:
        """Cargos de um membro mudaram: se for leitor do site, a API recebe o fato na hora."""
        if self.member_sync:
            await _safe_call(self.member_sync.on_member_update, before, after)

    async def on_member_join(self, member: discord.Member) -> None:
        """Alguem entrou num servidor: se for leitor do site, a API recebe os cargos dele."""
        if self.member_sync:
            await _safe_call(self.member_sync.push_member, member)

    async def on_member_remove(self, member: discord.Member) -> None:
        """Alguem saiu de um servidor: a API tira a ligacao (o perfil volta ao padrao ou ao proximo servidor)."""
        if self.member_sync:
            await _safe_call(self.member_sync.on_member_remove, member)

    async def on_guild_join(self, guild: discord.Guild) -> None:
        """O bot entrou num servidor: avisa no canal de log do painel (protegido: erro aqui nao derruba o bot)."""
        if self.member_sync:
            await _safe_call(self.member_sync.on_guild_change, guild)
        if self.guilds_feed:
            await _safe_call(self.guilds_feed.on_join, guild)

    async def on_guild_remove(self, guild: discord.Guild) -> None:
        """O bot saiu (ou foi expulso) de um servidor: avisa no canal de log do painel."""
        if self.guilds_feed:
            await _safe_call(self.guilds_feed.on_remove, guild)

    async def on_guild_update(self, before: discord.Guild, after: discord.Guild) -> None:
        """Um servidor mudou de nome: reagenda a edicao do painel."""
        if self.guilds_feed and self.guilds_feed.started and before.name != after.name:
            self.guilds_feed.schedule_refresh()

    async def _backup_tick(self) -> None:
        """Pede um backup cifrado (banco + imagens) a' API, manda para o canal privado em partes e apaga os mais antigos (mantem BACKUP_KEEP)."""
        now = datetime.now(timezone.utc)
        if not is_due(self.backup_store.load(), now, self.settings.backup_interval_minutes):
            return   # o bot reiniciou (deploy) antes da hora: nao faz backup extra (senao os antigos seriam apagados cedo demais)
        channel = self.get_channel(self.settings.backup_channel_id) or await self.fetch_channel(self.settings.backup_channel_id)
        stamp = now.strftime("%Y%m%d-%H%M")
        backup_id = None
        try:
            info = await self.api.start_backup()
            backup_id = info["id"]
            limit = getattr(getattr(channel, "guild", None), "filesize_limit", 10 * 1024 * 1024) - 64 * 1024   # tamanho maximo de arquivo deste servidor
            part_bytes = max(1024 * 1024, min(self.settings.backup_part_mb * 1024 * 1024, limit))
            total = parts_needed(info["size"], part_bytes)
            for n in range(1, total + 1):
                data = await self.api.download_backup_part(backup_id, n, part_bytes)
                text = (f"💾 **Backup {stamp} UTC** — {info['rows']} database rows, {info['files']} images, {format_size(info['size'])}, {total} part(s). "
                        "To restore you need ALL parts and the BACKUP_PASSPHRASE.") if n == 1 else None
                await channel.send(content=text, file=discord.File(io.BytesIO(data), filename=part_filename(stamp, n, total)), allowed_mentions=discord.AllowedMentions.none())
            self.backup_store.save(now)
            log.info("Backup %s enviado: %s partes, %s", stamp, total, format_size(info["size"]))
        except (ApiError, discord.DiscordException) as exc:
            detail = exc.detail if isinstance(exc, ApiError) else str(exc)
            log.warning("Backup falhou: %s", detail)
            try:
                await channel.send(f"⚠️ **Backup {stamp} UTC failed:** {detail[:300]}", allowed_mentions=discord.AllowedMentions.none())
            except discord.DiscordException as exc2:
                log.warning("Aviso de falha do backup tambem nao foi enviado: %s", exc2)
            return
        finally:
            if backup_id:
                try:
                    await self.api.delete_backup(backup_id)
                except ApiError as exc3:
                    log.warning("Nao consegui apagar o backup temporario %s: %s", backup_id, exc3.detail)
        # retencao: apaga as partes dos backups mais antigos (so' as mensagens DO BOT com arquivo de backup)
        found: list[tuple[str, discord.Message]] = []
        async for m in channel.history(limit=400):
            if m.author.id == self.user.id:
                for a in m.attachments:
                    s = stamp_of(a.filename)
                    if s:
                        found.append((s, m))
                        break
        doomed = set(messages_to_delete([(s, m.id) for s, m in found], self.settings.backup_keep))
        for _, m in found:
            if m.id in doomed:
                try:
                    await m.delete()
                except discord.DiscordException as exc:
                    log.warning("Nao consegui apagar um backup antigo: %s", exc)

    async def setup_hook(self) -> None:
        """Registra os comandos, sincroniza com o Discord e liga o feed de log (se configurado)."""
        if not self.settings.status_channel:
            log.warning("STATUS_CHANNEL_ID, ERROR_CHANNEL_ID e LOG_CHANNEL_ID vazios: o painel de status e os avisos de 'site/API/banco caiu' e 'voltou' estao DESLIGADOS")
        if self.settings.errors_channel:
            self.error_loop.start()
            log.info("Feed de erros ligado: canal %s", self.settings.errors_channel)
        if self.settings.status_channel:
            self.health_loop.start()
            log.info("Vigia de saude e painel de status ligados: canal %s", self.settings.status_channel)
        if self.settings.version_webhook_url:
            self.version_loop.start()
            log.info("Mensagem de versao (webhook) ligada: confere a cada 2 min")
        if self.settings.backup_channel_id:
            self.backup_loop.start()
            log.info("Backup ligado: a cada %s min no canal %s (mantem %s)", self.settings.backup_interval_minutes, self.settings.backup_channel_id, self.settings.backup_keep)
        if self.guilds_feed:
            self.guilds_loop.start()
            log.info("Painel de servidores ligado: canal %s (log em %s)", self.settings.guilds_channel_id, self.guilds_feed.log_channel_id)
        if self.member_sync:
            self.members_loop.start()
            log.info("Cargos dos leitores -> perfil (vila/rank): ligado, sincroniza a cada %s min e nos eventos de membro", SYNC_MINUTES)
        else:
            log.info("Cargos dos leitores -> perfil (vila/rank): DESLIGADO (MEMBER_ROLES_SYNC=false ou sem a Server Members Intent)")
        if self.settings.log_channel_id:
            self.log_loop.start()
            log.info("Feed de log ligado: canal %s, a cada %ss", self.settings.log_channel_id, self.settings.log_poll_seconds)
        # O logo das respostas vem da API (o Cloudflare do site barra o Discord e a imagem aparecia quebrada).
        set_logo_url(f"{self.settings.ninwiki_api_url.rstrip('/')}/brand/nin-codex-logo.png")
        # Servidores com permissao para usar os comandos: ALLOWED_GUILD_IDS + o de testes (DEV_GUILD_ID), os mesmos onde os comandos sao registrados. Lista vazia = sem restricao.
        allowed = set(target_guilds(self.settings.allowed_guilds, self.settings.dev_guild_id)) if self.settings.allowed_guilds else set()
        await self._refresh_site_url()   # antes de registrar: o endereco do site vem da API (o SITE_URL do .env e' so' reserva)
        # `lambda`: os comandos leem o endereco NA HORA de responder (acompanham uma troca de dominio sem reiniciar o bot).
        register_public_commands(self.tree, self.api, allowed, lambda: self.settings.site_url, self.check_now, bool(self.settings.site_url), self.languages)
        # Comandos so' nos servidores escolhidos (ALLOWED_GUILD_IDS + DEV_GUILD_ID), na hora, e sem sobra de comandos globais antigos (ver ninwiki_bot/command_sync.py).
        result = await sync_commands(self.tree, target_guilds(self.settings.allowed_guilds, self.settings.dev_guild_id), lambda gid: discord.Object(id=gid))
        self.command_sync_result = result

    async def on_ready(self) -> None:
        """Avisa no terminal que o bot esta' online."""
        log.info("Bot online como %s", self.user)

    async def close(self) -> None:
        """Fecha o cliente HTTP da API antes de desligar o bot."""
        await self.api.aclose()
        await super().close()


def main() -> None:
    """Le e valida o .env, depois liga o bot."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        settings = BotSettings()
        settings.allowed_guilds  # valida o formato ja' na inicializacao
    except ValidationError as e:
        # ValidationError vem antes de ValueError (e' uma subclasse dele).
        print("Configuração inválida no .env do bot (NinWiki.Bot/.env):", file=sys.stderr)
        for err in e.errors():
            campo = str(err["loc"][0]).upper() if err["loc"] else "?"
            motivo = "não preenchido" if err["type"] == "missing" else err["msg"].removeprefix("Value error, ")
            print(f"  - {campo}: {motivo}", file=sys.stderr)
        print("Veja o .env.example e o README.md desta pasta.", file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f"Configuração inválida no .env do bot: {e}", file=sys.stderr)
        sys.exit(1)
    # log_handler=None: ja configuramos o logging acima.
    try:
        NinWikiBot(settings).run(settings.discord_bot_token, log_handler=None)
    except discord.PrivilegedIntentsRequired:
        # A "Server Members Intent" nao esta' ligada no portal: religa o bot SEM ela (so' perde vila/rank automaticos do perfil; /search etc. seguem).
        log.warning("A 'Server Members Intent' NAO esta' ligada no Discord Developer Portal (Bot > Privileged Gateway Intents > SERVER MEMBERS INTENT). "
                    "Ligando o bot SEM ela: vila e rank do perfil dos leitores NAO serao preenchidos pelo Discord. Ligue a intent no portal e reinicie o bot para ativar.")
        NinWikiBot(settings, members_intent=False).run(settings.discord_bot_token, log_handler=None)


if __name__ == "__main__":
    main()
