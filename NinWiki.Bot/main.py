"""
NinWiki.Bot - ponto de entrada.

Como rodar (na pasta NinWiki.Bot, com o venv DO BOT ativado):
    python main.py

Pre-requisitos: ver README.md (criar o bot no Discord, .env, API rodando).
"""
import copy
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import discord
from discord import app_commands
from discord.ext import tasks
from pydantic import ValidationError

from ninwiki_bot.api_client import ApiError, NinWikiApi
from ninwiki_bot.config import BotSettings
from ninwiki_bot.error_feed import ErrorFeedStore, ServiceStatus, StatusMessageStore, decide, format_error, format_status_panel, query_since as errors_query_since, record_check, update_status
from ninwiki_bot.log_feed import LogFeedStore, format_entry, pick_new, query_since
from ninwiki_bot.language import LanguageStore
from ninwiki_bot.public_commands import register_public_commands
from ninwiki_bot.staff_commands import StaffGroup

log = logging.getLogger("ninwiki_bot")


class NinWikiBot(discord.Client):
    """O bot: comandos /equipe + (opcional) feed do log geral num canal do Discord."""

    def __init__(self, settings: BotSettings):
        # Intents PADRAO (sem nenhuma privilegiada): so' usamos comandos de barra,
        # nao precisamos ler mensagem nem lista de membros.
        super().__init__(intents=discord.Intents.default())
        self.settings = settings
        self.tree = app_commands.CommandTree(self)
        self.api = NinWikiApi(settings.ninwiki_api_url, settings.bot_api_token)
        # Feed do log: estado (onde parou) guardado em arquivo ao lado do bot, para sobreviver a reinicio.
        self.feed_store = LogFeedStore(Path(__file__).resolve().parent / "log_state.json")
        self.feed_state = self.feed_store.load()
        self._health_announced = False  # o aviso "monitor ligado" sai uma vez por inicializacao do bot
        self._feed_failing = False  # so' avisa no terminal na PRIMEIRA falha de uma sequencia (sem spam)
        self.log_loop = tasks.loop(seconds=settings.log_poll_seconds)(self._log_tick)
        self.log_loop.before_loop(self.wait_until_ready)
        # Feed de ERROS do wiki (+ vigia de API/banco/site): estado em arquivo, mesmo esquema do feed de log.
        self.error_store = ErrorFeedStore(Path(__file__).resolve().parent / "error_state.json")
        self.error_state = self.error_store.load()
        self._errors_failing = False
        self.error_loop = tasks.loop(seconds=settings.log_poll_seconds)(self._error_tick)
        self.error_loop.before_loop(self.wait_until_ready)
        self.statuses = {"API": ServiceStatus("API"), "Database": ServiceStatus("Database"), "Website": ServiceStatus("Website")}
        self.languages = LanguageStore(Path(__file__).resolve().parent / "language_state.json")
        self.status_store = StatusMessageStore(Path(__file__).resolve().parent / "status_state.json")
        self.health_loop = tasks.loop(seconds=settings.health_poll_seconds)(self._health_tick)
        self.health_loop.before_loop(self.wait_until_ready)

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
            if interaction.response.is_done():
                await interaction.followup.send(message, ephemeral=True)
            else:
                await interaction.response.send_message(message, ephemeral=True)

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

    async def _check_services(self) -> tuple[dict[str, bool | None], dict[str, int | None]]:
        """Pergunta agora se API, banco e site respondem (e em quantos ms). None = nao da' pra saber (banco com a API fora)."""
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
                messages.insert(0, {"title": "🤖 NinWiki monitor started", "description": "\n".join(lines),
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
        if self.settings.log_channel_id:
            self.log_loop.start()
            log.info("Feed de log ligado: canal %s, a cada %ss", self.settings.log_channel_id, self.settings.log_poll_seconds)
        register_public_commands(self.tree, self.api, self.settings.allowed_guilds, self.settings.site_url, self.check_now, bool(self.settings.site_url), self.languages)
        self.tree.add_command(StaffGroup(self.api, self.settings.allowed_guilds, self.settings.site_url, self._log_channel))
        if self.settings.dev_guild_id:
            # Sincroniza so' no servidor de testes: aparece na hora (o global demora ate 1h).
            guild = discord.Object(id=self.settings.dev_guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            log.info("Comandos sincronizados no servidor de testes %s", self.settings.dev_guild_id)
            log.warning("DEV_GUILD_ID esta' definido: os comandos existem SO' nesse servidor. Em producao (outros servidores) deixe DEV_GUILD_ID vazio e reinicie o bot.")
        else:
            await self.tree.sync()
            log.info("Comandos globais sincronizados (podem levar ate 1h pra aparecer)")

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
    NinWikiBot(settings).run(settings.discord_bot_token, log_handler=None)


if __name__ == "__main__":
    main()
