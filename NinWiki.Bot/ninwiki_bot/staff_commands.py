"""
Comandos de barra /equipe ... para gerenciar a equipe do painel pelo Discord.

O bot NAO decide nada sozinho: em cada comando ele so' repassa pra' API QUEM
digitou (o Discord garante esse ID) e o que a pessoa pediu. A API aplica as
MESMAS regras do painel (precisa ser staff ativa, ter a permissao, respeitar a
hierarquia: Adm so' mexe em Creator etc.) e responde com uma mensagem em
portugues, que o bot mostra como veio. Nao ha regra de cargo duplicada aqui -
se as regras mudarem na API, o bot acompanha sozinho.

Todas as respostas sao EFEMERAS (so' quem digitou enxerga) - a lista da equipe
nao deve aparecer pro canal inteiro.
"""
from collections.abc import Awaitable, Callable

import discord
from discord import app_commands

from ninwiki_bot.api_client import ApiError, NinWikiApi

ROLE_LABEL = {"super_admin": "S.Adm", "admin": "Adm", "creator": "Creator"}
ROLE_RANK = {"super_admin": 3, "admin": 2, "creator": 1}

ROLE_CHOICES = [
    app_commands.Choice(name="S.Adm", value="super_admin"),
    app_commands.Choice(name="Adm", value="admin"),
    app_commands.Choice(name="Creator", value="creator"),
]

# Nunca deixa uma mencao no texto da resposta notificar ninguem.
NO_MENTIONS = discord.AllowedMentions.none()


def _name_of(user: discord.abc.User) -> str:
    """Nome para mostrar de um usuario do Discord."""
    return getattr(user, "global_name", None) or user.name


class StaffGroup(app_commands.Group):
    """Grupo de comandos /equipe (listar, adicionar, cargo, desativar, reativar)."""
    def __init__(self, api: NinWikiApi, allowed_guilds: set[int] | None = None):
        super().__init__(
            name="equipe",
            description="Gerencia a equipe do painel da NinWiki",
            guild_only=True,  # nao funciona em mensagem direta
        )
        self.api = api
        self.allowed_guilds = allowed_guilds or set()

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        """Antes de cada comando: so' roda em servidor permitido (ALLOWED_GUILD_IDS)."""
        # Defesa extra (a API ja' barra quem nao e' staff): so' nos servidores permitidos.
        if self.allowed_guilds and interaction.guild_id not in self.allowed_guilds:
            await interaction.response.send_message(
                "Este comando não está disponível neste servidor.", ephemeral=True
            )
            return False
        return True

    async def _run(
        self,
        interaction: discord.Interaction,
        action: Callable[[], Awaitable[object]],
        on_success: Callable[[object], str],
    ) -> None:
        """Executa a acao na API e responde so' para quem digitou (sucesso ou erro em portugues)."""
        # defer primeiro: a API pode demorar mais que os 3s que o Discord da' pra responder.
        await interaction.response.defer(ephemeral=True)
        try:
            result = await action()
        except ApiError as e:
            await interaction.followup.send(f"❌ {e.detail}", ephemeral=True, allowed_mentions=NO_MENTIONS)
            return
        await interaction.followup.send(on_success(result), ephemeral=True, allowed_mentions=NO_MENTIONS)

    @app_commands.command(name="listar", description="Mostra quem está na equipe e o cargo de cada um")
    async def listar(self, interaction: discord.Interaction) -> None:
        """Mostra quem esta' na equipe e o cargo de cada um."""
        await interaction.response.defer(ephemeral=True)
        try:
            staff = await self.api.list_staff(interaction.user.id)
        except ApiError as e:
            await interaction.followup.send(f"❌ {e.detail}", ephemeral=True, allowed_mentions=NO_MENTIONS)
            return

        staff.sort(key=lambda m: (-ROLE_RANK.get(m["role"], 0), m["username"].lower()))
        lines = []
        for m in staff:
            status = "" if m["isActive"] else " · *desativado*"
            owner = " · dono" if m.get("isOwner") else ""
            lines.append(f"**{m['username']}** — {ROLE_LABEL.get(m['role'], m['role'])}{owner}{status} · <@{m['discordId']}>")
        text = "\n".join(lines) or "Ninguém cadastrado."
        if len(text) > 4000:  # limite de descricao de um embed
            text = text[:3990].rsplit("\n", 1)[0] + "\n…"
        embed = discord.Embed(title=f"Equipe da NinWiki ({len(staff)})", description=text)
        await interaction.followup.send(embed=embed, ephemeral=True, allowed_mentions=NO_MENTIONS)

    @app_commands.command(name="adicionar", description="Cadastra alguém na equipe")
    @app_commands.describe(usuario="Quem será cadastrado", cargo="Cargo que a pessoa terá")
    @app_commands.choices(cargo=ROLE_CHOICES)
    async def adicionar(
        self, interaction: discord.Interaction, usuario: discord.User, cargo: app_commands.Choice[str]
    ) -> None:
        """Cadastra alguem na equipe com um cargo."""
        if usuario.bot:
            await interaction.response.send_message("❌ Bots não podem entrar na equipe.", ephemeral=True)
            return
        name = _name_of(usuario)
        await self._run(
            interaction,
            lambda: self.api.add_staff(interaction.user.id, usuario.id, cargo.value, name),
            lambda _: f"✅ **{name}** foi cadastrado como **{cargo.name}**. Já pode entrar no painel com o Discord.",
        )

    @app_commands.command(name="cargo", description="Troca o cargo de alguém da equipe")
    @app_commands.describe(usuario="Membro da equipe", cargo="Novo cargo")
    @app_commands.choices(cargo=ROLE_CHOICES)
    async def cargo(
        self, interaction: discord.Interaction, usuario: discord.User, cargo: app_commands.Choice[str]
    ) -> None:
        """Troca o cargo de alguem da equipe."""
        name = _name_of(usuario)
        await self._run(
            interaction,
            lambda: self.api.change_role(interaction.user.id, usuario.id, cargo.value),
            lambda _: f"✅ **{name}** agora é **{cargo.name}**. A sessão dele foi encerrada e ele entra de novo com o cargo novo.",
        )

    @app_commands.command(name="desativar", description="Tira o acesso de alguém (na hora)")
    @app_commands.describe(usuario="Membro da equipe")
    async def desativar(self, interaction: discord.Interaction, usuario: discord.User) -> None:
        """Tira o acesso de alguem na hora."""
        name = _name_of(usuario)
        await self._run(
            interaction,
            lambda: self.api.set_active(interaction.user.id, usuario.id, False),
            lambda _: f"✅ **{name}** foi desativado e perdeu o acesso agora mesmo.",
        )

    @app_commands.command(name="reativar", description="Devolve o acesso de alguém desativado")
    @app_commands.describe(usuario="Membro da equipe")
    async def reativar(self, interaction: discord.Interaction, usuario: discord.User) -> None:
        """Devolve o acesso de alguem."""
        name = _name_of(usuario)
        await self._run(
            interaction,
            lambda: self.api.set_active(interaction.user.id, usuario.id, True),
            lambda _: f"✅ **{name}** foi reativado. Precisa entrar no painel de novo.",
        )
