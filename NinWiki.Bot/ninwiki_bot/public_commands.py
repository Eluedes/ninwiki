"""
Comandos PUBLICOS do bot (qualquer pessoa do servidor pode usar), todos com Components V2 (LayoutView/Container):

  /status          API, banco e site no ar agora? (tempo de resposta e disponibilidade desde que o bot ligou)
  /search <termo>  procura no wiki (itens, mobs, armas, jutsus, masteries e posts) e devolve cartoes com botao "Open"

Nada aqui mostra dado interno: so' online/offline e conteudo PUBLICADO do site. Os construtores de tela (build_*) nao
falam com o Discord, so' montam o LayoutView - assim podem ser testados sem conexao.
"""
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

import discord
from discord import app_commands

from ninwiki_bot.api_client import ApiError, NinWikiApi
from ninwiki_bot.error_feed import COLORS, ServiceStatus, uptime_pct

NO_MENTIONS = discord.AllowedMentions.none()
KIND_ICON = {"item": "🎒", "mob": "👹", "weapon": "⚔️", "guide": "📘", "mission": "📜", "mastery": "✨", "jutsu": "🌀", "post": "📰"}
KIND_COLOR = 0x38BDF8


def _clean(text: str) -> str:
    """Texto vindo do site, sem formatacao do Discord nem mencoes (nada de @everyone dentro de um resultado)."""
    return discord.utils.escape_mentions(discord.utils.escape_markdown(text))


def build_status_view(statuses: list[ServiceStatus], checked_at: datetime, site_monitored: bool) -> discord.ui.LayoutView:
    """Tela do /status: um cartao com uma linha por servico."""
    lines = []
    for st in statuses:
        if st.last_ok is None:
            lines.append(f"⚪ **{st.name}** — unknown")
            continue
        icon, word = ("🟢", "Online") if st.last_ok else ("🔴", "OFFLINE")
        extra = []
        if st.last_ok and st.last_ms is not None:
            extra.append(f"{st.last_ms} ms")
        pct = uptime_pct(st)
        if pct is not None:
            extra.append(f"{pct:.1f}% uptime")
        lines.append(f"{icon} **{st.name}** — {word}" + (f"\n-# {' · '.join(extra)}" if extra else ""))
    if not site_monitored:
        lines.append("⚪ **Website** — not monitored")
    known = [st.last_ok for st in statuses if st.last_ok is not None]
    all_ok = bool(known) and all(known)
    view = discord.ui.LayoutView(timeout=None)
    view.add_item(discord.ui.Container(
        discord.ui.TextDisplay(f"## 📡 NinWiki status\n{'All systems operational.' if all_ok else 'Something is not responding.'}"),
        discord.ui.Separator(),
        discord.ui.TextDisplay("\n".join(lines)),
        discord.ui.Separator(visible=False),
        discord.ui.TextDisplay(f"-# Checked <t:{int(checked_at.timestamp())}:R> · uptime counts since the bot started"),
        accent_colour=COLORS["recovered"] if all_ok else COLORS["down"],
    ))
    return view


def build_search_view(query: str, hits: list[dict], site_url: str) -> discord.ui.LayoutView:
    """Tela do /search: um cartao com um bloco (texto + botao "Open") por resultado, ou a dica de "nada encontrado"."""
    shown = _clean(query)[:60]
    base = site_url.rstrip("/")
    children: list[discord.ui.Item] = []
    if not hits:
        children.append(discord.ui.TextDisplay(f"## 🔎 No results\nNothing matched **{shown}**. Try a shorter word or another spelling."))
    else:
        children.append(discord.ui.TextDisplay(f"## 🔎 Results for “{shown}”"))
        for hit in hits[:8]:
            icon = hit.get("icon") or KIND_ICON.get(hit.get("kind", ""), "🔹")
            text = f"**{icon} {_clean(str(hit.get('title', '')))[:90]}**\n-# {_clean(str(hit.get('kind', '')).title())}"
            snippet = _clean(str(hit.get("snippet") or ""))[:140]
            if snippet:
                text += f" · {snippet}"
            children.append(discord.ui.Separator())
            href = str(hit.get("href", ""))
            if base and href.startswith("/") and not href.startswith("//"):
                children.append(discord.ui.Section(discord.ui.TextDisplay(text), accessory=discord.ui.Button(style=discord.ButtonStyle.link, label="Open", url=f"{base}{href}")))
            else:
                children.append(discord.ui.TextDisplay(text))
    view = discord.ui.LayoutView(timeout=None)
    view.add_item(discord.ui.Container(*children, accent_colour=KIND_COLOR))
    return view


def register_public_commands(
    tree: app_commands.CommandTree, api: NinWikiApi, allowed_guilds: set[int], site_url: str,
    check_now: Callable[[], Awaitable[list[ServiceStatus]]], site_monitored: bool,
) -> None:
    """Adiciona /status e /search na arvore de comandos (respeitando ALLOWED_GUILD_IDS)."""

    async def allowed(interaction: discord.Interaction) -> bool:
        """So' nos servidores permitidos (se a lista existir)."""
        if allowed_guilds and interaction.guild_id not in allowed_guilds:
            await interaction.response.send_message("This command is not available on this server.", ephemeral=True)
            return False
        return True

    @tree.command(name="status", description="Is the NinWiki API, database and website up right now?")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 10.0, key=lambda i: i.user.id)
    async def status(interaction: discord.Interaction) -> None:
        """Confere agora e mostra o resultado."""
        if not await allowed(interaction):
            return
        await interaction.response.defer(thinking=True)
        statuses = await check_now()
        await interaction.followup.send(view=build_status_view(statuses, datetime.now(timezone.utc), site_monitored), allowed_mentions=NO_MENTIONS)

    @tree.command(name="search", description="Search the wiki: items, mobs, weapons, jutsus, masteries and posts")
    @app_commands.describe(term="What to look for (at least 2 letters)")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def search(interaction: discord.Interaction, term: app_commands.Range[str, 2, 60]) -> None:
        """Busca no wiki e responde com cartoes."""
        if not await allowed(interaction):
            return
        await interaction.response.defer(thinking=True)
        try:
            hits = await api.search(term.strip())
        except ApiError:
            await interaction.followup.send("❌ The wiki is not answering right now. Try again in a moment.", ephemeral=True)
            return
        await interaction.followup.send(view=build_search_view(term, hits, site_url), allowed_mentions=NO_MENTIONS)
