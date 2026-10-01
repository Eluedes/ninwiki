"""
NinWiki.Bot - ponto de entrada.

Como rodar (na pasta NinWiki.Bot, com o venv DO BOT ativado):
    python main.py

Pre-requisitos: ver README.md (criar o bot no Discord, .env, API rodando).
"""
import copy
import logging
import sys
from pathlib import Path

import discord
from discord import app_commands
from discord.ext import tasks
from pydantic import ValidationError

from ninwiki_bot.api_client import ApiError, NinWikiApi
from ninwiki_bot.config import BotSettings
from ninwiki_bot.log_feed import LogFeedStore, format_entry, pick_new, query_since
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
        self._feed_failing = False  # so' avisa no terminal na PRIMEIRA falha de uma sequencia (sem spam)
        self.log_loop = tasks.loop(seconds=settings.log_poll_seconds)(self._log_tick)
        self.log_loop.before_loop(self.wait_until_ready)

        @self.tree.error
        async def on_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError) -> None:
            """Erro inesperado em um comando: registra no terminal e responde algo generico (sem vazar detalhe)."""
            # Erro inesperado: registra no terminal e responde algo generico -
            # nunca despeja detalhe interno (stack trace, URL, token) no Discord.
            log.exception("Erro num comando", exc_info=error)
            message = "❌ Algo deu errado. Tente de novo; se repetir, avise quem cuida do bot."
            if interaction.response.is_done():
                await interaction.followup.send(message, ephemeral=True)
            else:
                await interaction.response.send_message(message, ephemeral=True)

    async def _log_tick(self) -> None:
        """Uma volta do feed: busca acoes novas na API e posta no canal de log (embeds, ate' 10 por mensagem)."""
        try:
            channel = self.get_channel(self.settings.log_channel_id) or await self.fetch_channel(self.settings.log_channel_id)
            entries = await self.api.audit_log_since(query_since(self.feed_state).isoformat())
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

    async def setup_hook(self) -> None:
        """Registra os comandos, sincroniza com o Discord e liga o feed de log (se configurado)."""
        if self.settings.log_channel_id:
            self.log_loop.start()
            log.info("Feed de log ligado: canal %s, a cada %ss", self.settings.log_channel_id, self.settings.log_poll_seconds)
        self.tree.add_command(StaffGroup(self.api, self.settings.allowed_guilds))
        if self.settings.dev_guild_id:
            # Sincroniza so' no servidor de testes: aparece na hora (o global demora ate 1h).
            guild = discord.Object(id=self.settings.dev_guild_id)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            log.info("Comandos sincronizados no servidor de testes %s", self.settings.dev_guild_id)
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
