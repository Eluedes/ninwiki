"""
Comandos de CONSULTA do bot (qualquer pessoa do servidor), lendo so' a API publica do wiki (nenhuma regra de cargo aqui):

  /item <nome> · /mob <nome> · /jutsu <nome> · /mastery <nome>   cartao do resultado (mesmo do /search, so' do tipo pedido)
  /compare <a> <b>           dois itens/armas/mobs/jutsus lado a lado
  /map <area>                zona, mobs e saidas de uma area do mapa-mundi + link para o mapa do site (#map/<id>)
  /random                    um item/arma/mob sorteado
  /help                      lista dos comandos no idioma do servidor

Os construtores (build_*, find_area) nao falam com o Discord: da' para testar sem conexao. O idioma vem do LanguageStore (o do servidor).
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


def find_area(info: dict, query: str) -> str | None:
    """Id da area pelo que a pessoa digitou/escolheu: id exato, nome exato (EN ou PT) ou, por ultimo, o primeiro nome que contem o texto."""
    q = query.strip().lower()
    if not q:
        return None
    names: dict[str, list[str]] = info.get("names", {})
    if q in info.get("areas", {}):
        return q
    exact = [i for i, n in names.items() if q in (n[0].lower(), n[1].lower())]
    if exact:
        return exact[0]
    part = [i for i, n in sorted(names.items(), key=lambda kv: kv[1][0]) if q in n[0].lower() or q in n[1].lower()]
    return part[0] if part else None


def build_area_embed(info: dict, area_id: str, site_url: str, lang: str = DEFAULT) -> discord.Embed:
    """Embed do /map: nome, zona, mobs (nivel) e saidas (com o nome da area vizinha), imagem da area e link para #map/<id> no site."""
    t = TEXT[lang]
    idx = 1 if lang == "pt" else 0
    area = info["areas"][area_id]
    name = lambda i: (info["names"].get(str(i)) or [f"#{i}", f"#{i}"])[idx]   # noqa: E731 - nome da area no idioma pedido
    zone = str(area.get("z", ""))
    zone_text = t["map_safe"] if zone.startswith("Safe") else t["map_danger"] if zone.startswith("Danger") else t["map_war"] if zone.startswith("War") else t["map_neutral"]
    base = site_url.rstrip("/")
    embed = discord.Embed(title=f"🗺️ {_clean(name(area_id))}"[:256], url=f"{base}/map#map/{area_id}" if base else None, color=KIND_COLOR)
    embed.add_field(name=t["map_zone"], value=zone_text, inline=False)
    mobs = sorted(area.get("m") or [], key=lambda m: m[2])
    mob_lines = [f"• {_clean(m[idx] or m[0])} — {t['map_level'].format(lv=m[2])}" for m in mobs[:15]]
    if len(mobs) > 15:
        mob_lines.append(f"+{len(mobs) - 15}")
    embed.add_field(name=t["map_mobs"], value="\n".join(mob_lines) or t["map_nomobs"], inline=True)
    exits = [f"• {t['dir'].get(d, d)} → {_clean(name(to))}" for to, d in (area.get("e") or [])[:12]]
    embed.add_field(name=t["map_exits"], value="\n".join(exits) or t["map_noexits"], inline=True)
    if base:
        embed.set_image(url=f"{base}/game-maps/{area_id}.webp")
        embed.set_footer(text=t["map_open"])
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
    """Adiciona /item /mob /jutsu /mastery /compare /map /random /help (cada um com freio por pessoa, defer e erro tratado)."""
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

    @tree.command(name="map", description="A map area: zone, mobs, exits and a link to the world map")
    @app_commands.describe(area="Area name (start typing for suggestions)")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def map_cmd(interaction: discord.Interaction, area: app_commands.Range[str, 1, 80]) -> None:
        """Mostra a ficha de uma area do mapa-mundi (dados do proprio site, em cache por 1 h)."""
        if not await allowed(interaction):
            return
        lang = languages.get(interaction.guild_id)
        await interaction.response.defer(thinking=True)
        info = await api.areas_info(site_url) if site_url else None
        if not info:
            await interaction.followup.send(TEXT[lang]["map_down"], ephemeral=True)
            return
        area_id = find_area(info, area)
        if area_id is None or area_id not in info["areas"]:
            await interaction.followup.send(TEXT[lang]["map_none"].format(q=_clean(area)[:60]), ephemeral=True)
            return
        await interaction.followup.send(embed=build_area_embed(info, area_id, site_url, lang), allowed_mentions=NO_MENTIONS)

    @map_cmd.autocomplete("area")
    async def _area_autocomplete(interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
        """Sugere areas pelo nome (so' do cache local; se o mapa ainda nao carregou, espera no maximo 2,5 s e desiste em silencio)."""
        try:
            info = await asyncio.wait_for(api.areas_info(site_url), 2.5) if site_url else None
        except (asyncio.TimeoutError, ApiError):
            return []
        if not info:
            return []
        idx, q = (1 if languages.get(interaction.guild_id) == "pt" else 0), current.strip().lower()
        pairs = sorted(((n[idx], i) for i, n in info["names"].items() if not q or q in n[0].lower() or q in n[1].lower()), key=lambda p: p[0])
        return [app_commands.Choice(name=n[:100], value=i) for n, i in pairs[:25]]

    @tree.command(name="random", description="A random item, weapon or mob from the wiki")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def random_cmd(interaction: discord.Interaction) -> None:
        """Sorteia um item/arma/mob publicado e mostra o cartao."""
        if not await allowed(interaction):
            return
        lang = languages.get(interaction.guild_id)
        await interaction.response.defer(thinking=True)
        try:
            hit = await api.random_hit(lang)
        except ApiError as e:
            await interaction.followup.send(TEXT[lang]["random_none"] if e.status_code == 404 else TEXT[lang]["wiki_down"], ephemeral=True)
            return
        who = getattr(interaction.user, "display_name", None) or getattr(interaction.user, "name", None)
        view = build_search_view(str(hit.get("title", "")), [hit], site_url, owner_id=interaction.user.id, lang=lang, owner_name=who)
        view.message = await interaction.followup.send(view=view, allowed_mentions=NO_MENTIONS, wait=True)

    @tree.command(name="help", description="What this bot can do and how to use it")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def help_cmd(interaction: discord.Interaction) -> None:
        """Lista os comandos no idioma do servidor (so' quem pediu ve': nao enche o canal)."""
        if not await allowed(interaction):
            return
        await interaction.response.send_message(embed=build_help_embed(site_url, languages.get(interaction.guild_id)), ephemeral=True)
