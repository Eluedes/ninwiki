"""
Slash commands /team ... to manage the panel staff from Discord (English: the team and the site are English-first).

  /team list     who is on the staff and each person's role
  /team manage   ONE modal to do everything: add someone, change a role, rename, deactivate (remove access) or reactivate
  /team status   is the API / database / website up right now?
  /team clearlog clears the OLD log (panel audit log and/or the messages in the Discord log channel) - S.Adm only, with confirmation

The bot decides NOTHING on its own: for every action it just forwards to the API WHO typed it (Discord guarantees
that ID) and what they asked for. The API applies the SAME rules as the panel (must be an active staff member, have
the permission, respect the hierarchy...) and answers with a message, which the bot shows as it came. There is no
role logic duplicated here - if the rules change in the API, the bot follows by itself. Today only the S.Adm can
manage the staff, so everyone else gets a clear refusal.

All answers are EPHEMERAL (only the person who typed sees them) - the staff list must not show up for the whole channel.
"""
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone

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
        component=discord.ui.TextInput(max_length=100, required=False),
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


# Onde limpar (valor do parametro `where` do /team clearlog).
WHERE_CHOICES = [
    app_commands.Choice(name="Panel audit log + Discord log channel", value="both"),
    app_commands.Choice(name="Panel audit log only", value="database"),
    app_commands.Choice(name="Discord log channel only", value="channel"),
]
MAX_PURGE = 1000  # mensagens apagadas do canal por execucao (apagar uma a uma e' lento; rode de novo se sobrar)


async def run_clear_log(
    api: NinWikiApi, invoker_id: int, where: str, older_than_days: int | None,
    channel: discord.abc.Messageable | None, bot_user_id: int | None,
) -> str:
    """
    Clears the log. The API checks the permission (only the S.Adm) and does the database part; then the bot deletes ITS OWN
    messages in the log channel (no special Discord permission needed to delete your own messages). Returns the answer text.
    """
    do_db = where in ("both", "database")
    do_channel = where in ("both", "channel")
    result = await api.clear_log(invoker_id, older_than_days, clear_database=do_db, discord_channel=do_channel)
    parts = []
    if do_db:
        parts.append(f"**{result.get('deleted', 0)}** panel log entries deleted")
    if do_channel:
        if channel is None or not hasattr(channel, "purge"):
            parts.append("no Discord log channel configured (LOG_CHANNEL_ID)")
        else:
            cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days) if older_than_days else None
            try:
                removed = await channel.purge(
                    limit=MAX_PURGE, check=lambda m: m.author.id == bot_user_id, before=cutoff, bulk=False, reason="NinWiki: log cleared",
                )
                note = f" (limit of {MAX_PURGE} per run - run again to remove more)" if len(removed) >= MAX_PURGE else ""
                parts.append(f"**{len(removed)}** messages deleted from the Discord log channel{note}")
            except discord.DiscordException as e:
                parts.append(f"could not clean the Discord channel ({type(e).__name__})")
    scope = f"older than {older_than_days} days" if older_than_days else "everything"
    return f"✅ Log cleared ({scope}): " + "; ".join(parts) + "."


class ConfirmClearView(discord.ui.View):
    """Two buttons (Confirm / Cancel) shown only to the person who typed the command; the work runs after Confirm."""

    def __init__(self, owner_id: int, work: Callable[[], Awaitable[str]]) -> None:
        super().__init__(timeout=60)
        self.owner_id = owner_id
        self.work = work

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        """Only the person who typed the command can press the buttons."""
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message("This confirmation is not yours.", ephemeral=True)
            return False
        return True

    @discord.ui.button(label="Yes, clear the log", style=discord.ButtonStyle.danger)
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        """Runs the clearing and shows the result in place of the question."""
        await interaction.response.edit_message(content="⏳ Clearing the log…", view=None)
        try:
            text = await self.work()
        except ApiError as e:
            text = f"❌ {e.detail}"
        await interaction.edit_original_response(content=text)
        self.stop()

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        """Gives up: nothing is deleted."""
        await interaction.response.edit_message(content="Cancelled. Nothing was deleted.", view=None)
        self.stop()


class StaffGroup(app_commands.Group):
    """Command group /team (list, manage, status)."""
    def __init__(
        self, api: NinWikiApi, allowed_guilds: set[int] | None = None, site_url: str = "",
        log_channel: Callable[[], Awaitable[discord.abc.Messageable | None]] | None = None,
    ):
        super().__init__(
            name="team",
            description="Manage the NinWiki panel staff",
            guild_only=True,  # nao funciona em mensagem direta
            # Escondido de quem nao gerencia o servidor (o servidor pode liberar para cargos especificos em Integracoes). A API continua
            # sendo quem decide de verdade: so' a equipe cadastrada consegue agir.
            default_permissions=discord.Permissions(manage_guild=True),
        )
        self.api = api
        self.allowed_guilds = allowed_guilds or set()
        self.site_url = site_url
        self.log_channel = log_channel  # devolve o canal de log do Discord (ou None se nao configurado)

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

    @app_commands.command(name="clearlog", description="Clear the old log so the team no longer sees it (S.Adm only)")
    @app_commands.describe(where="What to clear", older_than_days="Only entries older than N days (empty = everything)")
    @app_commands.choices(where=WHERE_CHOICES)
    async def clearlog(
        self, interaction: discord.Interaction, where: app_commands.Choice[str],
        older_than_days: app_commands.Range[int, 1, 3650] | None = None,
    ) -> None:
        """Asks for confirmation, then clears the panel audit log and/or the Discord log channel (the API only allows the S.Adm)."""
        scope = f"older than **{older_than_days} days**" if older_than_days else "**everything**"
        question = f"⚠️ Clear **{where.name}** — {scope}? This cannot be undone (the clearing itself is recorded in the new log)."
        invoker = interaction.user.id

        async def work() -> str:
            channel = await self.log_channel() if self.log_channel else None
            bot_id = interaction.client.user.id if interaction.client.user else None
            return await run_clear_log(self.api, invoker, where.value, older_than_days, channel, bot_id)

        # Primeiro confere a permissao (sem apagar nada): quem nao e' S.Adm recebe a recusa ja' aqui, antes da pergunta.
        await interaction.response.defer(ephemeral=True)
        try:
            await self.api.clear_log(invoker, older_than_days, clear_database=False, discord_channel=False, check_only=True)
        except ApiError as e:
            await interaction.followup.send(f"❌ {e.detail}", ephemeral=True, allowed_mentions=NO_MENTIONS)
            return
        await interaction.followup.send(question, view=ConfirmClearView(invoker, work), ephemeral=True, allowed_mentions=NO_MENTIONS)
