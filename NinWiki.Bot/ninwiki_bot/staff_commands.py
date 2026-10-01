"""
Slash commands /team ... to manage the panel staff from Discord (English: the team and the site are English-first).

The bot decides NOTHING on its own: for every command it just forwards to the API WHO typed it (Discord guarantees
that ID) and what they asked for. The API applies the SAME rules as the panel (must be an active staff member, have
the permission, respect the hierarchy...) and answers with a message, which the bot shows as it came. There is no
role logic duplicated here - if the rules change in the API, the bot follows by itself. Today only the S.Adm can
manage the staff, so everyone else gets a clear refusal.

All answers are EPHEMERAL (only the person who typed sees them) - the staff list must not show up for the whole channel.
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
    """Command group /team (list, add, role, deactivate, reactivate)."""
    def __init__(self, api: NinWikiApi, allowed_guilds: set[int] | None = None):
        super().__init__(
            name="team",
            description="Manage the NinWiki panel staff",
            guild_only=True,  # nao funciona em mensagem direta
        )
        self.api = api
        self.allowed_guilds = allowed_guilds or set()

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        """Before every command: only runs on allowed servers (ALLOWED_GUILD_IDS)."""
        # Defesa extra (a API ja' barra quem nao e' staff): so' nos servidores permitidos.
        if self.allowed_guilds and interaction.guild_id not in self.allowed_guilds:
            await interaction.response.send_message(
                "This command is not available on this server.", ephemeral=True
            )
            return False
        return True

    async def _run(
        self,
        interaction: discord.Interaction,
        action: Callable[[], Awaitable[object]],
        on_success: Callable[[object], str],
    ) -> None:
        """Runs the action on the API and answers only the person who typed (success or error)."""
        # defer primeiro: a API pode demorar mais que os 3s que o Discord da' pra responder.
        await interaction.response.defer(ephemeral=True)
        try:
            result = await action()
        except ApiError as e:
            await interaction.followup.send(f"❌ {e.detail}", ephemeral=True, allowed_mentions=NO_MENTIONS)
            return
        await interaction.followup.send(on_success(result), ephemeral=True, allowed_mentions=NO_MENTIONS)

    @app_commands.command(name="list", description="Show who is on the staff and each person's role")
    async def list_staff(self, interaction: discord.Interaction) -> None:
        """Shows who is on the staff and each person's role."""
        await interaction.response.defer(ephemeral=True)
        try:
            staff = await self.api.list_staff(interaction.user.id)
        except ApiError as e:
            await interaction.followup.send(f"❌ {e.detail}", ephemeral=True, allowed_mentions=NO_MENTIONS)
            return

        staff.sort(key=lambda m: (-ROLE_RANK.get(m["role"], 0), m["username"].lower()))
        lines = []
        for m in staff:
            status = "" if m["isActive"] else " · *deactivated*"
            owner = " · owner" if m.get("isOwner") else ""
            lines.append(f"**{m['username']}** — {ROLE_LABEL.get(m['role'], m['role'])}{owner}{status} · <@{m['discordId']}>")
        text = "\n".join(lines) or "Nobody registered."
        if len(text) > 4000:  # limite de descricao de um embed
            text = text[:3990].rsplit("\n", 1)[0] + "\n…"
        embed = discord.Embed(title=f"NinWiki staff ({len(staff)})", description=text)
        await interaction.followup.send(embed=embed, ephemeral=True, allowed_mentions=NO_MENTIONS)

    @app_commands.command(name="add", description="Register someone on the staff")
    @app_commands.describe(user="Who will be registered", role="Role the person will have")
    @app_commands.choices(role=ROLE_CHOICES)
    async def add(
        self, interaction: discord.Interaction, user: discord.User, role: app_commands.Choice[str]
    ) -> None:
        """Registers someone on the staff with a role."""
        if user.bot:
            await interaction.response.send_message("❌ Bots cannot join the staff.", ephemeral=True)
            return
        name = _name_of(user)
        await self._run(
            interaction,
            lambda: self.api.add_staff(interaction.user.id, user.id, role.value, name),
            lambda _: f"✅ **{name}** was registered as **{role.name}**. They can now sign in to the panel with Discord.",
        )

    @app_commands.command(name="role", description="Change the role of a staff member")
    @app_commands.describe(user="Staff member", role="New role")
    @app_commands.choices(role=ROLE_CHOICES)
    async def role(
        self, interaction: discord.Interaction, user: discord.User, role: app_commands.Choice[str]
    ) -> None:
        """Changes the role of a staff member."""
        name = _name_of(user)
        await self._run(
            interaction,
            lambda: self.api.change_role(interaction.user.id, user.id, role.value),
            lambda _: f"✅ **{name}** is now **{role.name}**. Their session was ended and they sign in again with the new role.",
        )

    @app_commands.command(name="deactivate", description="Remove someone's access (immediately)")
    @app_commands.describe(user="Staff member")
    async def deactivate(self, interaction: discord.Interaction, user: discord.User) -> None:
        """Removes someone's access immediately."""
        name = _name_of(user)
        await self._run(
            interaction,
            lambda: self.api.set_active(interaction.user.id, user.id, False),
            lambda _: f"✅ **{name}** was deactivated and lost access right away.",
        )

    @app_commands.command(name="reactivate", description="Give access back to someone deactivated")
    @app_commands.describe(user="Staff member")
    async def reactivate(self, interaction: discord.Interaction, user: discord.User) -> None:
        """Gives access back to someone."""
        name = _name_of(user)
        await self._run(
            interaction,
            lambda: self.api.set_active(interaction.user.id, user.id, True),
            lambda _: f"✅ **{name}** was reactivated. They need to sign in to the panel again.",
        )
