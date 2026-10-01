"""
Slash commands /team ... to manage the panel staff from Discord (English: the team and the site are English-first).

  /team list     who is on the staff and each person's role
  /team manage   ONE modal to do everything: add someone, change a role, rename, deactivate (remove access) or reactivate
  /team status   is the API / database / website up right now?

The bot decides NOTHING on its own: for every action it just forwards to the API WHO typed it (Discord guarantees
that ID) and what they asked for. The API applies the SAME rules as the panel (must be an active staff member, have
the permission, respect the hierarchy...) and answers with a message, which the bot shows as it came. There is no
role logic duplicated here - if the rules change in the API, the bot follows by itself. Today only the S.Adm can
manage the staff, so everyone else gets a clear refusal.

All answers are EPHEMERAL (only the person who typed sees them) - the staff list must not show up for the whole channel.
"""
import discord
from discord import app_commands

from ninwiki_bot.api_client import ApiError, NinWikiApi

ROLE_LABEL = {"super_admin": "S.Adm", "admin": "Adm", "creator": "Creator"}
ROLE_RANK = {"super_admin": 3, "admin": 2, "creator": 1}

# Nunca deixa uma mencao no texto da resposta notificar ninguem.
NO_MENTIONS = discord.AllowedMentions.none()


def _name_of(user: discord.abc.User) -> str:
    """Nome para mostrar de um usuario do Discord."""
    return getattr(user, "global_name", None) or user.name


# Acoes do modal /team manage (value -> texto que aparece na lista).
ACTIONS = [
    discord.SelectOption(label="Add to the staff", value="add", description="Register someone (pick the role below)", emoji="➕"),
    discord.SelectOption(label="Change role", value="role", description="Promote or demote (pick the role below)", emoji="🔁"),
    discord.SelectOption(label="Rename", value="rename", description="Change the display name (type the name below)", emoji="✏️"),
    discord.SelectOption(label="Deactivate (remove access)", value="deactivate", description="They lose access right away", emoji="⛔"),
    discord.SelectOption(label="Reactivate", value="reactivate", description="Give access back", emoji="✅"),
]
ROLE_OPTIONS = [
    discord.SelectOption(label="S.Adm", value="super_admin"),
    discord.SelectOption(label="Adm", value="admin"),
    discord.SelectOption(label="Creator", value="creator"),
]


class ManageStaffModal(discord.ui.Modal, title="Manage staff"):
    """
    Modal with Discord's NEW components (selects inside the modal): action, person, role and display name.
    The role and the name are optional - each action uses only what it needs (Add/Change role: role; Rename: name).
    """
    action = discord.ui.Label(
        text="What do you want to do?",
        component=discord.ui.Select(placeholder="Choose an action", options=ACTIONS, min_values=1, max_values=1, required=True),
    )
    member = discord.ui.Label(
        text="Who?",
        component=discord.ui.UserSelect(placeholder="Pick the person", min_values=1, max_values=1, required=True),
    )
    role = discord.ui.Label(
        text="Role",
        description="Used by Add and Change role",
        component=discord.ui.Select(placeholder="Pick a role", options=ROLE_OPTIONS, min_values=0, max_values=1, required=False),
    )
    name = discord.ui.Label(
        text="Display name",
        description="Used by Rename (and by Add; empty = their Discord name)",
        component=discord.ui.TextInput(placeholder="e.g. Rafael", max_length=100, required=False),
    )

    def __init__(self, api: NinWikiApi, allowed_guilds: set[int], preselected: discord.abc.User | None = None) -> None:
        super().__init__()
        self.api = api
        self.allowed_guilds = allowed_guilds
        if preselected is not None:
            self.member.component.default_values = [preselected]  # type: ignore[union-attr]

    async def on_submit(self, interaction: discord.Interaction) -> None:
        """Reads the 4 answers and runs the chosen action on the API (as the person who submitted the modal)."""
        if self.allowed_guilds and interaction.guild_id not in self.allowed_guilds:
            await interaction.response.send_message("This command is not available on this server.", ephemeral=True)
            return
        action = self.action.component.values[0]  # type: ignore[union-attr]
        target = self.member.component.values[0]  # type: ignore[union-attr]
        role_values = self.role.component.values  # type: ignore[union-attr]
        role = role_values[0] if role_values else None
        typed_name = (self.name.component.value or "").strip()  # type: ignore[union-attr]
        await run_manage_action(self.api, interaction, action, target, role, typed_name)

    async def on_error(self, interaction: discord.Interaction, error: Exception) -> None:
        """Any unexpected failure becomes a friendly message instead of the modal 'failing' silently."""
        message = "❌ Something went wrong. Try again; if it keeps happening, tell whoever maintains the bot."
        if interaction.response.is_done():
            await interaction.followup.send(message, ephemeral=True)
        else:
            await interaction.response.send_message(message, ephemeral=True)


async def run_manage_action(
    api: NinWikiApi, interaction: discord.Interaction, action: str,
    target: discord.abc.User, role: str | None, typed_name: str,
) -> None:
    """Runs one /team manage action. Separated from the modal class so it can be tested without Discord."""
    name = typed_name or _name_of(target)
    role_label = ROLE_LABEL.get(role or "", role or "")
    invoker = interaction.user.id

    async def refuse(text: str) -> None:
        await interaction.response.send_message(f"❌ {text}", ephemeral=True, allowed_mentions=NO_MENTIONS)

    if action == "add":
        if target.bot:
            return await refuse("Bots cannot join the staff.")
        if not role:
            return await refuse("Pick a role to register this person.")
        call = lambda: api.add_staff(invoker, target.id, role, name)  # noqa: E731
        ok = f"✅ **{name}** was registered as **{role_label}**. They can now sign in to the panel with Discord."
    elif action == "role":
        if not role:
            return await refuse("Pick the new role.")
        call = lambda: api.change_role(invoker, target.id, role)  # noqa: E731
        ok = f"✅ **{_name_of(target)}** is now **{role_label}**. Their session was ended and they sign in again with the new role."
    elif action == "rename":
        if not typed_name:
            return await refuse("Type the new display name.")
        call = lambda: api.rename_staff(invoker, target.id, typed_name)  # noqa: E731
        ok = f"✅ Renamed to **{typed_name}**. The name stays saved (signing in with Discord no longer changes it)."
    elif action == "deactivate":
        call = lambda: api.set_active(invoker, target.id, False)  # noqa: E731
        ok = f"✅ **{_name_of(target)}** was deactivated and lost access right away."
    elif action == "reactivate":
        call = lambda: api.set_active(invoker, target.id, True)  # noqa: E731
        ok = f"✅ **{_name_of(target)}** was reactivated. They need to sign in to the panel again."
    else:
        return await refuse("Unknown action.")

    # defer primeiro: a API pode demorar mais que os 3s que o Discord da' pra responder.
    await interaction.response.defer(ephemeral=True)
    try:
        await call()
    except ApiError as e:
        await interaction.followup.send(f"❌ {e.detail}", ephemeral=True, allowed_mentions=NO_MENTIONS)
        return
    await interaction.followup.send(ok, ephemeral=True, allowed_mentions=NO_MENTIONS)


class StaffGroup(app_commands.Group):
    """Command group /team (list, manage, status)."""
    def __init__(self, api: NinWikiApi, allowed_guilds: set[int] | None = None, site_url: str = ""):
        super().__init__(
            name="team",
            description="Manage the NinWiki panel staff",
            guild_only=True,  # nao funciona em mensagem direta
        )
        self.api = api
        self.allowed_guilds = allowed_guilds or set()
        self.site_url = site_url

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        """Before every command: only runs on allowed servers (ALLOWED_GUILD_IDS)."""
        # Defesa extra (a API ja' barra quem nao e' staff): so' nos servidores permitidos.
        if self.allowed_guilds and interaction.guild_id not in self.allowed_guilds:
            await interaction.response.send_message(
                "This command is not available on this server.", ephemeral=True
            )
            return False
        return True

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

    @app_commands.command(name="manage", description="Add, edit, rename or remove access of a staff member (opens a form)")
    @app_commands.describe(user="(optional) Pre-select this person in the form")
    async def manage(self, interaction: discord.Interaction, user: discord.User | None = None) -> None:
        """Opens the modal that does everything (add / change role / rename / deactivate / reactivate)."""
        await interaction.response.send_modal(ManageStaffModal(self.api, self.allowed_guilds, user))

    @app_commands.command(name="status", description="Is the API, the database and the website up right now?")
    async def status(self, interaction: discord.Interaction) -> None:
        """Checks API, database and website right now and shows each one as online or offline."""
        await interaction.response.defer(ephemeral=True)
        api_up, db_up = await self.api.api_status()
        lines = [
            f"{'🟢' if api_up else '🔴'} **API** — {'online' if api_up else 'OFFLINE'}",
            f"{'🟢' if (api_up and db_up) else ('🔴' if api_up else '⚪')} **Database** — "
            + ("online" if (api_up and db_up) else ("OFFLINE" if api_up else "unknown (API is down)")),
        ]
        all_ok = api_up and db_up
        if self.site_url:
            site_up = await self.api.site_ok(self.site_url)
            all_ok = all_ok and site_up
            lines.append(f"{'🟢' if site_up else '🔴'} **Website** — {'online' if site_up else 'OFFLINE'}")
        else:
            lines.append("⚪ **Website** — not monitored (set SITE_URL in the bot .env)")
        embed = discord.Embed(title="NinWiki status", description="\n".join(lines),
                              color=0x2ECC71 if all_ok else 0xE74C3C)
        await interaction.followup.send(embed=embed, ephemeral=True, allowed_mentions=NO_MENTIONS)
