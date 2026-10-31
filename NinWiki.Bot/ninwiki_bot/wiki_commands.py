"""
Comandos de CONSULTA do bot (qualquer pessoa do servidor), lendo so' a API publica do wiki (nenhuma regra de cargo aqui):

  /item <nome> · /mob <nome> · /jutsu <nome> · /mastery <nome>   cartao do resultado (mesmo do /search, so' do tipo pedido)
  /compare <a> <b>           dois itens/armas/mobs/jutsus lado a lado
  /help                      lista dos comandos no idioma do servidor

Os construtores (build_*) nao falam com o Discord: da' para testar sem conexao. O idioma vem do LanguageStore (o do servidor).
"""
import asyncio
import logging
from collections.abc import Awaitable, Callable

import discord
from discord import app_commands

from ninwiki_bot.api_client import ApiError, NinWikiApi
from ninwiki_bot.language import DEFAULT, LanguageStore, TEXT
from ninwiki_bot.public_commands import KIND_COLOR, LOGO_PATH, NO_MENTIONS, _autocomplete_for, _clean, build_search_view

log = logging.getLogger("ninwiki_bot")

# Tipos (campo "kind" da API) aceitos por cada comando de consulta.
KINDS = {"item": ("item", "weapon"), "mob": ("mob",), "jutsu": ("jutsu",), "mastery": ("mastery",)}
COMPARABLE = ("item", "weapon", "mob", "jutsu")


def _link(site_url: str, href: str) -> str | None:
    """Endereco completo de uma pagina do site (so' caminhos proprios; sem SITE_URL = sem link)."""
    base = site_url.rstrip("/")
    return f"{base}{href}" if base and href.startswith("/") and not href.startswith("//") else None


def pick_hits(hits: list[dict], kinds: tuple[str, ...], query: str) -> list[dict]:
    """So' os resultados dos tipos pedidos, com o nome IGUAL ao digitado na frente (a ordem da API vale no resto)."""
    wanted = [h for h in hits if h.get("kind") in kinds]
    return sorted(wanted, key=lambda h: str(h.get("title", "")).lower() != query.strip().lower())


def _facts(hit: dict) -> dict[str, str]:
    """Os dados de um resultado como {rotulo: valor} (ordem preservada)."""
    return {str(f.get("label", "")): str(f.get("value", "")) for f in hit.get("facts") or []}


def build_compare_embed(a: dict, b: dict, site_url: str, lang: str = DEFAULT) -> discord.Embed:
    """Embed do /compare: uma linha por dado (A · B); dado que so' um dos dois tem aparece com '—' no outro."""
    t = TEXT[lang]
    fa, fb = _facts(a), _facts(b)

    def name(h: dict) -> str:
        """Nome linkado para a pagina do wiki (sem link se nao houver SITE_URL)."""
        title, url = _clean(str(h.get("title", "")))[:80], _link(site_url, str(h.get("href", "")))
        return f"[{title}]({url})" if url else title

    rows = [f"**{_clean(label)}:** {_clean(fa.get(label, '—'))[:60]} · {_clean(fb.get(label, '—'))[:60]}" for label in dict.fromkeys([*fa, *fb])]
    body = f"🅰️ {name(a)}\n🅱️ {name(b)}\n\n" + ("\n".join(rows) if rows else t["cmp_nodata"])
    embed = discord.Embed(title=t["cmp_title"].format(a=_clean(str(a.get("title", "")))[:100], b=_clean(str(b.get("title", "")))[:100])[:256],
                          description=body[:4000], color=KIND_COLOR)
    if isinstance(a.get("image"), str) and a["image"].startswith(("https://", "http://")):
        embed.set_thumbnail(url=a["image"])
    embed.set_footer(text=t["cmp_hint"])
    return embed


def build_help_embed(site_url: str, lang: str = DEFAULT) -> discord.Embed:
    """Embed do /help: um campo por comando, no idioma do servidor, com a marca do wiki."""
    t = TEXT[lang]
    embed = discord.Embed(title=t["help_title"], color=KIND_COLOR, description=t["help_site"].format(url=site_url.rstrip("/")) if site_url else None)
    for cmd, desc in t["help_lines"]:
        embed.add_field(name=cmd, value=desc, inline=False)
    base = site_url.rstrip("/")
    embed.set_footer(text=t["team"])
    if base:
        embed.set_thumbnail(url=f"{base}{LOGO_PATH}")
    return embed


def register_wiki_commands(
    tree: app_commands.CommandTree, api: NinWikiApi, site_url: str, languages: LanguageStore,
    allowed: Callable[[discord.Interaction], Awaitable[bool]],
) -> None:
    """Adiciona /item /mob /jutsu /mastery /compare /help (cada um com freio por pessoa, defer e erro tratado)."""
    suggest = _autocomplete_for(api, languages)

    def lookup(command: str, kind_key: str, summary: str) -> None:
        """Cria um comando de consulta de UM tipo (usa a busca do wiki e filtra pelo tipo)."""
        @tree.command(name=command, description=summary)
        @app_commands.describe(name="Name (start typing for suggestions)")
        @app_commands.guild_only()
        @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
        async def _cmd(interaction: discord.Interaction, name: app_commands.Range[str, 2, 60]) -> None:
            """Mostra o cartao do resultado do tipo pedido (idioma do servidor)."""
            if not await allowed(interaction):
                return
            lang = languages.get(interaction.guild_id)
            q = name.strip()
            if len(q) < 2:
                await interaction.response.send_message(TEXT[lang]["short_term"], ephemeral=True)
                return
            await interaction.response.defer(thinking=True)
            try:
                hits = pick_hits(await api.search(q, lang), KINDS[kind_key], q)
            except ApiError:
                await interaction.followup.send(TEXT[lang]["wiki_down"], ephemeral=True)
                return
            who = getattr(interaction.user, "display_name", None) or getattr(interaction.user, "name", None)
            if hits:
                view = build_search_view(q, hits, site_url, owner_id=interaction.user.id, lang=lang, owner_name=who)
            else:   # sem resultado do tipo: cartao com a dica (texto proprio do tipo)
                view = discord.ui.LayoutView(timeout=None)
                view.add_item(discord.ui.Container(discord.ui.TextDisplay(TEXT[lang]["pick_none"].format(kind=TEXT[lang]["kind_" + kind_key], q=_clean(q)[:60])), accent_colour=KIND_COLOR))
            view.message = await interaction.followup.send(view=view, allowed_mentions=NO_MENTIONS, wait=True)

        _cmd.autocomplete("name")(suggest)

    lookup("item", "item", "Look up an item or weapon: stats, description and page link")
    lookup("mob", "mob", "Look up a mob: health, damage, XP, where it spawns")
    lookup("jutsu", "jutsu", "Look up a jutsu: tier, chakra, cooldown and effect")
    lookup("mastery", "mastery", "Look up a mastery and its description")

    @tree.command(name="compare", description="Compare two items, weapons, mobs or jutsus side by side")
    @app_commands.describe(first="First name (start typing for suggestions)", second="Second name")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 8.0, key=lambda i: i.user.id)
    async def compare(interaction: discord.Interaction, first: app_commands.Range[str, 2, 60], second: app_commands.Range[str, 2, 60]) -> None:
        """Busca os dois nomes e mostra os dados lado a lado."""
        if not await allowed(interaction):
            return
        lang = languages.get(interaction.guild_id)
        a_q, b_q = first.strip(), second.strip()
        if len(a_q) < 2 or len(b_q) < 2:
            await interaction.response.send_message(TEXT[lang]["short_term"], ephemeral=True)
            return
        if a_q.lower() == b_q.lower():
            await interaction.response.send_message(TEXT[lang]["cmp_same"], ephemeral=True)
            return
        await interaction.response.defer(thinking=True)
        try:
            found_a, found_b = await asyncio.gather(api.search(a_q, lang), api.search(b_q, lang))
        except ApiError:
            await interaction.followup.send(TEXT[lang]["wiki_down"], ephemeral=True)
            return
        pa, pb = pick_hits(found_a, COMPARABLE, a_q), pick_hits(found_b, COMPARABLE, b_q)
        for q, picked in ((a_q, pa), (b_q, pb)):
            if not picked:
                await interaction.followup.send(TEXT[lang]["cmp_missing"].format(q=_clean(q)[:60]), ephemeral=True)
                return
        await interaction.followup.send(embed=build_compare_embed(pa[0], pb[0], site_url, lang), allowed_mentions=NO_MENTIONS)

    compare.autocomplete("first")(suggest)
    compare.autocomplete("second")(suggest)

    @tree.command(name="help", description="What this bot can do and how to use it")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def help_cmd(interaction: discord.Interaction) -> None:
        """Lista os comandos no idioma do servidor (so' quem pediu ve': nao enche o canal)."""
        if not await allowed(interaction):
            return
        await interaction.response.send_message(embed=build_help_embed(site_url, languages.get(interaction.guild_id)), ephemeral=True)
