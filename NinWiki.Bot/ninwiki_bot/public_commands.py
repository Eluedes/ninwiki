"""
Comandos PUBLICOS do bot (qualquer pessoa do servidor pode usar), todos com Components V2 (LayoutView/Container):

  /status          API, banco e site no ar agora? (tempo de resposta e disponibilidade desde que o bot ligou)
  /search <termo>  procura no wiki (itens, mobs, armas, jutsus, masteries e posts) e mostra o melhor resultado com IMAGEM, dados e
                   RESUMO (+ botao para a pagina completa e um menu para ver os outros resultados)

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


def _open_url(site_url: str, href: str) -> str | None:
    """Endereco completo da pagina (so' caminhos do proprio site: nada de '//outro-site')."""
    base = site_url.rstrip("/")
    if base and href.startswith("/") and not href.startswith("//"):
        return f"{base}{href}"
    return None


def _hit_children(hit: dict, site_url: str) -> list[discord.ui.Item]:
    """Cartao de UM resultado: imagem + titulo + dados, resumo e botao para a pagina completa."""
    icon = hit.get("icon") or KIND_ICON.get(hit.get("kind", ""), "🔹")
    kind = _clean(str(hit.get("kind", "")).title())
    title = _clean(str(hit.get("title", "")))[:100]
    facts = "\n".join(f"**{_clean(str(f.get('label', '')))}:** {_clean(str(f.get('value', '')))[:80]}" for f in (hit.get("facts") or [])[:6])
    head = f"-# {icon} {kind}\n## {title}" + (f"\n{facts}" if facts else "")
    image = hit.get("image")
    children: list[discord.ui.Item] = []
    if isinstance(image, str) and image.startswith(("https://", "http://")):
        children.append(discord.ui.Section(discord.ui.TextDisplay(head), accessory=discord.ui.Thumbnail(image, description=title[:100])))
    else:
        children.append(discord.ui.TextDisplay(head))
    summary = "\n".join(_clean(line) for line in str(hit.get("summary") or hit.get("snippet") or "").splitlines())[:600]
    if summary:
        children += [discord.ui.Separator(), discord.ui.TextDisplay(summary)]
    url = _open_url(site_url, str(hit.get("href", "")))
    if url:
        children.append(discord.ui.ActionRow(discord.ui.Button(style=discord.ButtonStyle.link, label="Open the full page", url=url, emoji="🔗")))
    return children


class SearchView(discord.ui.LayoutView):
    """Resultado do /search: o melhor resultado em destaque e, se houver mais, um menu para trocar de resultado (so' quem buscou usa)."""

    def __init__(self, query: str, hits: list[dict], site_url: str, index: int = 0, owner_id: int | None = None, interactive: bool = True):
        super().__init__(timeout=600)
        self.query, self.hits, self.site_url, self.index, self.owner_id = query, hits, site_url, index, owner_id
        self.message: discord.Message | None = None
        shown = _clean(query)[:60]
        children: list[discord.ui.Item] = []
        if not hits:
            children.append(discord.ui.TextDisplay(f"## 🔎 No results\nNothing matched **{shown}**. Try a shorter word or another spelling."))
        else:
            children += _hit_children(hits[index], site_url)
            if len(hits) > 1 and interactive:
                children.append(discord.ui.Separator())
                children.append(discord.ui.TextDisplay(f"-# {len(hits)} results for “{shown}”"))
                select = discord.ui.Select(
                    placeholder="See another result…",
                    options=[discord.SelectOption(label=_clean(str(h.get("title", "")))[:100] or "?", description=str(h.get("kind", "")).title()[:100],
                                                  value=str(i), default=(i == index)) for i, h in enumerate(hits[:25])],
                )
                select.callback = self._picked
                children.append(discord.ui.ActionRow(select))
        self.add_item(discord.ui.Container(*children, accent_colour=KIND_COLOR))

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        """So' quem digitou o /search troca o resultado (a mensagem e' de todos)."""
        if self.owner_id is not None and interaction.user.id != self.owner_id:
            await interaction.response.send_message("Only the person who ran this search can switch results. Run /search yourself!", ephemeral=True)
            return False
        return True

    async def _picked(self, interaction: discord.Interaction) -> None:
        """Mostra o resultado escolhido no menu (edita a mesma mensagem)."""
        chosen = int(interaction.data["values"][0])  # type: ignore[index]
        view = SearchView(self.query, self.hits, self.site_url, chosen, self.owner_id)
        view.message = self.message
        await interaction.response.edit_message(view=view, allowed_mentions=NO_MENTIONS)
        self.stop()

    async def on_timeout(self) -> None:
        """Depois de 10 min tira o menu (so' fica o resultado atual)."""
        if self.message is not None:
            try:
                await self.message.edit(view=SearchView(self.query, self.hits, self.site_url, self.index, self.owner_id, interactive=False))
            except discord.HTTPException:
                pass


def build_search_view(query: str, hits: list[dict], site_url: str, index: int = 0, owner_id: int | None = None) -> SearchView:
    """Tela do /search (ver SearchView)."""
    return SearchView(query, hits, site_url, index, owner_id)


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
        view = build_search_view(term, hits, site_url, owner_id=interaction.user.id)
        view.message = await interaction.followup.send(view=view, allowed_mentions=NO_MENTIONS, wait=True)
