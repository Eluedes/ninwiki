"""
NinWiki.Bot - ponto de entrada.

Como rodar (na pasta NinWiki.Bot, com o venv DO BOT ativado):
    python main.py

Pre-requisitos: ver README.md (criar o bot no Discord, .env, API rodando).
"""
import logging
import sys

import discord
from discord import app_commands
from pydantic import ValidationError

from ninwiki_bot.api_client import NinWikiApi
from ninwiki_bot.config import BotSettings
from ninwiki_bot.staff_commands import StaffGroup

log = logging.getLogger("ninwiki_bot")


class NinWikiBot(discord.Client):
    def __init__(self, settings: BotSettings):
        # Intents PADRAO (sem nenhuma privilegiada): so' usamos comandos de barra,
        # nao precisamos ler mensagem nem lista de membros.
        super().__init__(intents=discord.Intents.default())
        self.settings = settings
        self.tree = app_commands.CommandTree(self)
        self.api = NinWikiApi(settings.ninwiki_api_url, settings.bot_api_token)

        @self.tree.error
        async def on_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError) -> None:
            # Erro inesperado: registra no terminal e responde algo generico -
            # nunca despeja detalhe interno (stack trace, URL, token) no Discord.
            log.exception("Erro num comando", exc_info=error)
            message = "❌ Algo deu errado. Tente de novo; se repetir, avise quem cuida do bot."
            if interaction.response.is_done():
                await interaction.followup.send(message, ephemeral=True)
            else:
                await interaction.response.send_message(message, ephemeral=True)

    async def setup_hook(self) -> None:
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
        log.info("Bot online como %s", self.user)

    async def close(self) -> None:
        await self.api.aclose()
        await super().close()


def main() -> None:
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
