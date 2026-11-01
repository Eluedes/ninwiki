"""
Comandos PUBLICOS do bot (qualquer pessoa do servidor pode usar), todos com Components V2 (LayoutView/Container):

  /status                    API, banco e site no ar agora (tempo de resposta e disponibilidade desde que o bot ligou)
  /search <termo> [language] procura no wiki e mostra o melhor resultado com IMAGEM, dados da ficha e RESUMO (+ botao para a
                             pagina completa e um menu para ver os outros resultados); rodape com quem pesquisou e a marca da equipe
  /drop <item>               quais mobs dropam o item (e a chance de cada um)
  /patchnotes                as noticias/patch notes mais recentes do blog
  /language <en|pt>          idioma padrao do bot NESTE servidor (so' quem tem "Gerenciar servidor")
  (/item /mob /jutsu /mastery /compare /help: ver wiki_commands.py)
  (/search e /drop sugerem nomes enquanto a pessoa digita: autocompletar do Discord)

Nada aqui mostra dado interno: so' online/offline e conteudo PUBLICADO do site. Os construtores de tela (build_*) nao falam
com o Discord, so' montam o LayoutView - assim podem ser testados sem conexao.
"""
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

import discord
from discord import app_commands

from ninwiki_bot.api_client import ApiError, NinWikiApi
from ninwiki_bot.error_feed import COLORS, ServiceStatus, uptime_pct
from ninwiki_bot.language import DEFAULT, LANGS, LanguageStore, TEXT

log = logging.getLogger("ninwiki_bot")
NO_MENTIONS = discord.AllowedMentions.none()
KIND_ICON = {"item": "🎒", "mob": "👹", "weapon": "⚔️", "guide": "📘", "mission": "📜", "mastery": "✨", "jutsu": "🌀", "post": "📰"}
KIND_COLOR = 0x38BDF8
LOGO_PATH = "/images/logo/nin-codex-logo.png"
LOGO_URL: str | None = None   # endereco completo do logo (main.py aponta para a API: o Cloudflare do site barra o Discord); sem ele usa SITE_URL + LOGO_PATH


def set_logo_url(url: str | None) -> None:
    """Define o endereco do logo usado no rodape das respostas e na ajuda."""
    global LOGO_URL
    LOGO_URL = url


def logo_for(site_url: str) -> str | None:
    """Logo a mostrar: o da API (set_logo_url) ou, sem ele, o do site; None se nao ha nenhum."""
    base = site_url.rstrip("/")
    return LOGO_URL or (f"{base}{LOGO_PATH}" if base else None)


def _clean(text: str) -> str:
    """Texto vindo do site, sem formatacao do Discord nem mencoes (nada de @everyone dentro de um resultado)."""
    return discord.utils.escape_mentions(discord.utils.escape_markdown(text))


def build_status_view(statuses: list[ServiceStatus], checked_at: datetime, site_monitored: bool, lang: str = DEFAULT) -> discord.ui.LayoutView:
    """Tela do /status: um cartao com uma linha por servico."""
    t = TEXT[lang]
    lines = []
    for st in statuses:
        if st.last_ok is None:
            lines.append(f"⚪ **{st.name}** — {t['unknown']}")
            continue
        icon, word = ("🟢", t["online"]) if st.last_ok else ("🔴", t["offline"])
        extra = []
        if st.last_ok and st.last_ms is not None:
            extra.append(f"{st.last_ms} ms")
        pct = uptime_pct(st)
        if pct is not None:
            extra.append(f"{pct:.1f}% {t['uptime']}")
        lines.append(f"{icon} **{st.name}** — {word}" + (f"\n-# {' · '.join(extra)}" if extra else ""))
    if not site_monitored:
        lines.append(f"⚪ **Website** — {t['not_monitored']}")
    known = [st.last_ok for st in statuses if st.last_ok is not None]
    all_ok = bool(known) and all(known)
    when = f"<t:{int(checked_at.timestamp())}:R>"
    view = discord.ui.LayoutView(timeout=None)
    view.add_item(discord.ui.Container(
        discord.ui.TextDisplay(f"{t['st_title']}\n{t['st_ok'] if all_ok else t['st_bad']}"),
        discord.ui.Separator(),
        discord.ui.TextDisplay("\n".join(lines)),
        discord.ui.Separator(visible=False),
        discord.ui.TextDisplay(f"-# {t['checked'].format(when=when)}"),
        accent_colour=COLORS["recovered"] if all_ok else COLORS["down"],
    ))
    return view


def _open_url(site_url: str, href: str) -> str | None:
    """Endereco completo da pagina (so' caminhos do proprio site: nada de '//outro-site')."""
    base = site_url.rstrip("/")
    if base and href.startswith("/") and not href.startswith("//"):
        return f"{base}{href}"
    return None


def _hit_children(hit: dict, site_url: str, lang: str) -> list[discord.ui.Item]:
    """Cartao de UM resultado: imagem + titulo + dados, resumo e botao para a pagina completa."""
    t = TEXT[lang]
    code = str(hit.get("kind", ""))
    icon = hit.get("icon") or KIND_ICON.get(code, "🔹")
    kind = _clean(t["kind"].get(code, code.title()))
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
        children.append(discord.ui.ActionRow(discord.ui.Button(style=discord.ButtonStyle.link, label=t["open"], url=url, emoji="🔗")))
    return children


def _footer(user_name: str | None, site_url: str, lang: str, when: datetime) -> list[discord.ui.Item]:
    """Rodape do /search: quem pesquisou, quando, e a marca da equipe (com o logo do site, se SITE_URL estiver configurada)."""
    t = TEXT[lang]
    who = t["searched_by"].format(user=_clean(user_name)[:40]) if user_name else ""
    line = " · ".join(x for x in (f"🔎 {who}" if who else "", f"<t:{int(when.timestamp())}:R>") if x)
    text = f"-# {line}\n-# 📖 **{t['team']}**"
    logo = logo_for(site_url)
    if logo:
        return [discord.ui.Separator(), discord.ui.Section(discord.ui.TextDisplay(text), accessory=discord.ui.Thumbnail(logo, description=t["team"]))]
    return [discord.ui.Separator(), discord.ui.TextDisplay(text)]


class SearchView(discord.ui.LayoutView):
    """Resultado do /search: o melhor resultado em destaque, menu para trocar de resultado (so' quem buscou usa) e rodape da equipe."""

    def __init__(self, query: str, hits: list[dict], site_url: str, index: int = 0, owner_id: int | None = None, interactive: bool = True,
                 lang: str = DEFAULT, owner_name: str | None = None, when: datetime | None = None):
        super().__init__(timeout=600)
        self.query, self.hits, self.site_url, self.index, self.owner_id = query, hits, site_url, index, owner_id
        self.lang, self.owner_name = lang, owner_name
        self.when = when or datetime.now(timezone.utc)
        self.message: discord.Message | None = None
        t = TEXT[lang]
        shown = _clean(query)[:60]
        children: list[discord.ui.Item] = []
        if not hits:
            children.append(discord.ui.TextDisplay(t["none"].format(q=shown)))
        else:
            children += _hit_children(hits[index], site_url, lang)
            if len(hits) > 1 and interactive:
                children.append(discord.ui.Separator())
                children.append(discord.ui.TextDisplay("-# " + t["results"].format(n=len(hits), q=shown)))
                select = discord.ui.Select(
                    placeholder=t["more"],
                    options=[discord.SelectOption(label=str(h.get("title", ""))[:100] or "?",
                                                  description=t["kind"].get(str(h.get("kind", "")), str(h.get("kind", "")).title())[:100],
                                                  value=str(i), default=(i == index)) for i, h in enumerate(hits[:25])],
                )
                select.callback = self._picked
                children.append(discord.ui.ActionRow(select))
        children += _footer(owner_name, site_url, lang, self.when)
        self.add_item(discord.ui.Container(*children, accent_colour=KIND_COLOR))

    def _again(self, index: int, interactive: bool = True) -> "SearchView":
        """Mesma busca, outro resultado (ou sem menu, quando o tempo acaba)."""
        return SearchView(self.query, self.hits, self.site_url, index, self.owner_id, interactive, self.lang, self.owner_name, self.when)

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        """So' quem digitou o /search troca o resultado (a mensagem e' de todos)."""
        if self.owner_id is not None and interaction.user.id != self.owner_id:
            await interaction.response.send_message(TEXT[self.lang]["only_owner"], ephemeral=True)
            return False
        return True

    async def _picked(self, interaction: discord.Interaction) -> None:
        """Mostra o resultado escolhido no menu (edita a mesma mensagem)."""
        view = self._again(int(interaction.data["values"][0]))  # type: ignore[index]
        view.message = self.message
        await interaction.response.edit_message(view=view, allowed_mentions=NO_MENTIONS)
        self.stop()

    async def on_timeout(self) -> None:
        """Depois de 10 min tira o menu (so' fica o resultado atual)."""
        if self.message is not None:
            try:
                await self.message.edit(view=self._again(self.index, interactive=False))
            except discord.HTTPException as exc:
                log.debug("Nao consegui tirar o menu no timeout: %s", exc)


def _chance(m: dict) -> str:
    """Texto da chance de um drop: 'Over 10%', 'Below 1%' ou '25%' (igual ao site)."""
    q = m.get("chanceQualifier")
    return f"Over {m['chance']:g}%" if q == "over" else f"Below {m['chance']:g}%" if q == "below" else f"{m['chance']:g}%"


def build_drop_embed(result: dict, query: str, site_url: str, lang: str = DEFAULT) -> discord.Embed:
    """Embed do /drop: o item e a lista de mobs que o dropam (com link para a pagina de cada um)."""
    t = TEXT[lang]
    base = site_url.rstrip("/")
    if not result.get("found"):
        return discord.Embed(description=t["drop_none"].format(q=_clean(query)), color=KIND_COLOR)
    embed = discord.Embed(title=t["drop_title"].format(item=_clean(result["title"]))[:256], url=f"{base}{result['href']}" if base else None, color=KIND_COLOR)
    if result.get("image"):
        embed.set_thumbnail(url=result["image"])
    mobs = result.get("mobs") or []
    if mobs:
        lines = [f"• [{_clean(m['name'])}]({base}{m['href']}) — {_chance(m)}" if base else f"• {_clean(m['name'])} — {_chance(m)}" for m in mobs[:20]]
        embed.description = "\n".join(lines)[:4096]
        if len(mobs) > 20:
            embed.set_footer(text=f"+{len(mobs) - 20}")
    else:
        embed.description = t["drop_nobody"]
    return embed


def build_recipe_embed(result: dict, query: str, site_url: str, lang: str = DEFAULT) -> discord.Embed:
    """Embed do /recipe: o item feito e, para cada profissao, nivel, bancada, de onde se aprende e os ingredientes (com link)."""
    t = TEXT[lang]
    base = site_url.rstrip("/")

    def link(name: str, href: str) -> str:
        """Nome com link para o wiki (sem link se nao houver SITE_URL)."""
        return f"[{_clean(name)}]({base}{href})" if base else _clean(name)

    if not result.get("found"):
        return discord.Embed(description=t["rec_none"].format(q=_clean(query)), color=KIND_COLOR)
    embed = discord.Embed(title=t["rec_title"].format(item=_clean(result["title"]))[:256], url=f"{base}{result['href']}" if base else None, color=KIND_COLOR)
    if result.get("image"):
        embed.set_thumbnail(url=result["image"])
    for r in (result.get("recipes") or [])[:5]:
        head = [t["rec_level"].format(n=r["level"]), t["rec_bench"] if r.get("workbench") else t["rec_nobench"]]
        if r.get("learnedFrom"):
            head.append(t["rec_learn"].format(item=_clean(r["learnedFrom"])))
        needs = "\n".join(f"• {n['qty']}× {link(n['name'], n['href'])}" for n in r.get("needs") or [])
        embed.add_field(name=_clean(r["profession"])[:256], value=(" · ".join(head) + "\n" + needs)[:1024], inline=False)
    return embed


def build_posts_embed(posts: list[dict], site_url: str, lang: str = DEFAULT) -> discord.Embed:
    """Embed do /patchnotes: os posts mais recentes (titulo com link, data e resumo)."""
    t = TEXT[lang]
    base = site_url.rstrip("/")
    embed = discord.Embed(title=t["posts_title"], color=KIND_COLOR)
    if not posts:
        embed.description = t["posts_none"]
        return embed
    for p in posts:
        when = f" · <t:{int(datetime.fromisoformat(p['publishedAt'].replace('Z', '+00:00')).timestamp())}:D>" if p.get("publishedAt") else ""
        shown = _clean(p["title"])[:150]
        title = f"[{shown}]({base}{p['href']})" if base else shown
        embed.add_field(name="\u200b", value=f"**{title}**{when}\n{_clean(p.get('excerpt', ''))[:300]}"[:1024], inline=False)
    if posts[0].get("image"):
        embed.set_image(url=posts[0]["image"])
    return embed


def build_search_view(query: str, hits: list[dict], site_url: str, index: int = 0, owner_id: int | None = None,
                      lang: str = DEFAULT, owner_name: str | None = None) -> SearchView:
    """Tela do /search (ver SearchView)."""
    return SearchView(query, hits, site_url, index, owner_id, True, lang, owner_name)


def _autocomplete_for(api: NinWikiApi, languages: LanguageStore, kind: str | None = None):
    """Autocompletar do Discord (sugere nomes do wiki enquanto a pessoa digita; 2+ letras; falha em silencio).
    `kind` limita as sugestoes ao tipo do comando (item, mob, jutsu, mastery, recipe); sem ele sugere de tudo (/search, /compare)."""
    async def _autocomplete(interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
        """Sugestoes (a API guarda em cache e responde em ate' 2,5 s: o Discord desiste em 3 s)."""
        if len(current.strip()) < 2:
            return []
        try:
            names = await api.suggest(current.strip(), languages.get(interaction.guild_id), kind)
        except ApiError:
            return []
        return [app_commands.Choice(name=n[:100], value=n[:100]) for n in names[:25]]
    return _autocomplete


def register_public_commands(
    tree: app_commands.CommandTree, api: NinWikiApi, allowed_guilds: set[int], site_url: str,
    check_now: Callable[[], Awaitable[list[ServiceStatus]]], site_monitored: bool, languages: LanguageStore,
) -> None:
    """Adiciona /status, /search e /language na arvore de comandos (respeitando ALLOWED_GUILD_IDS)."""

    async def allowed(interaction: discord.Interaction) -> bool:
        """So' nos servidores permitidos (se a lista existir)."""
        if allowed_guilds and interaction.guild_id not in allowed_guilds:
            await interaction.response.send_message(TEXT[DEFAULT]["wrong_guild"], ephemeral=True)
            return False
        return True

    @tree.command(name="status", description="Is the Nin Codex API, database and website up right now?")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 10.0, key=lambda i: i.user.id)
    async def status(interaction: discord.Interaction) -> None:
        """Confere agora e mostra o resultado no idioma do servidor."""
        if not await allowed(interaction):
            return
        await interaction.response.defer(thinking=True)
        statuses = await check_now()
        lang = languages.get(interaction.guild_id)
        await interaction.followup.send(view=build_status_view(statuses, datetime.now(timezone.utc), site_monitored, lang), allowed_mentions=NO_MENTIONS)

    @tree.command(name="search", description="Search the wiki: items, mobs, weapons, jutsus, masteries and posts")
    @app_commands.describe(term="What to look for (at least 2 letters)", language="Show the result in this language (default: this server's language)")
    @app_commands.choices(language=[app_commands.Choice(name="English", value="en"), app_commands.Choice(name="Português", value="pt")])
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def search(interaction: discord.Interaction, term: app_commands.Range[str, 2, 60], language: app_commands.Choice[str] | None = None) -> None:
        """Busca no wiki e responde com o cartao do melhor resultado (idioma: o escolhido ou o do servidor)."""
        if not await allowed(interaction):
            return
        lang = language.value if language else languages.get(interaction.guild_id)
        if len(term.strip()) < 2:   # "  a" passa pelo Range mas a API recusa (422): avisa em vez de dizer que o wiki caiu
            await interaction.response.send_message(TEXT[lang]["short_term"], ephemeral=True)
            return
        await interaction.response.defer(thinking=True)
        try:
            hits = await api.search(term.strip(), lang)
        except ApiError:
            await interaction.followup.send(TEXT[lang]["wiki_down"], ephemeral=True)
            return
        name = getattr(interaction.user, "display_name", None) or getattr(interaction.user, "name", None)
        view = build_search_view(term, hits, site_url, owner_id=interaction.user.id, lang=lang, owner_name=name)
        view.message = await interaction.followup.send(view=view, allowed_mentions=NO_MENTIONS, wait=True)

    _autocomplete = _autocomplete_for(api, languages)

    search.autocomplete("term")(_autocomplete)

    @tree.command(name="drop", description="Which mobs drop this item, and how likely")
    @app_commands.describe(item="Item or weapon name (start typing for suggestions)")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def drop(interaction: discord.Interaction, item: app_commands.Range[str, 2, 60]) -> None:
        """Mostra quais mobs dropam o item (no idioma do servidor)."""
        if not await allowed(interaction):
            return
        lang = languages.get(interaction.guild_id)
        if len(item.strip()) < 2:
            await interaction.response.send_message(TEXT[lang]["short_term"], ephemeral=True)
            return
        await interaction.response.defer(thinking=True)
        try:
            result = await api.drops(item.strip(), lang)
        except ApiError:
            await interaction.followup.send(TEXT[lang]["wiki_down"], ephemeral=True)
            return
        await interaction.followup.send(embed=build_drop_embed(result, item, site_url, lang), allowed_mentions=NO_MENTIONS)

    drop.autocomplete("item")(_autocomplete_for(api, languages, "item"))   # /drop: so' itens e armas (mob nao dropa)

    @tree.command(name="recipe", description="How to craft an item: ingredients, profession and level")
    @app_commands.describe(item="Item name (start typing for suggestions)")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 5.0, key=lambda i: i.user.id)
    async def recipe(interaction: discord.Interaction, item: app_commands.Range[str, 2, 60]) -> None:
        """Mostra como fazer o item (no idioma do servidor)."""
        if not await allowed(interaction):
            return
        lang = languages.get(interaction.guild_id)
        await interaction.response.defer(thinking=True)
        try:
            result = await api.recipe(item.strip(), lang)
        except ApiError:
            await interaction.followup.send(TEXT[lang]["wiki_down"], ephemeral=True)
            return
        await interaction.followup.send(embed=build_recipe_embed(result, item, site_url, lang), allowed_mentions=NO_MENTIONS)

    recipe.autocomplete("item")(_autocomplete_for(api, languages, "recipe"))   # /recipe: so' itens que alguma profissao fabrica

    @tree.command(name="patchnotes", description="The latest news and patch notes from the wiki blog")
    @app_commands.guild_only()
    @app_commands.checks.cooldown(1, 10.0, key=lambda i: i.user.id)
    async def patchnotes(interaction: discord.Interaction) -> None:
        """Mostra os 3 posts mais recentes do blog (no idioma do servidor)."""
        if not await allowed(interaction):
            return
        lang = languages.get(interaction.guild_id)
        await interaction.response.defer(thinking=True)
        try:
            posts = await api.latest_posts(3, lang)
        except ApiError:
            await interaction.followup.send(TEXT[lang]["wiki_down"], ephemeral=True)
            return
        await interaction.followup.send(embed=build_posts_embed(posts, site_url, lang), allowed_mentions=NO_MENTIONS)

    from ninwiki_bot.wiki_commands import register_wiki_commands   # import aqui dentro: wiki_commands importa deste arquivo (evita ciclo)
    register_wiki_commands(tree, api, site_url, languages, allowed)

    @tree.command(name="language", description="Set this bot's default language on this server (English or Português)")
    @app_commands.describe(language="Language used by /search and /status here")
    @app_commands.choices(language=[app_commands.Choice(name="English", value="en"), app_commands.Choice(name="Português", value="pt")])
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_guild=True)
    async def language_cmd(interaction: discord.Interaction, language: app_commands.Choice[str]) -> None:
        """Muda o idioma padrao do bot neste servidor (so' com a permissao Gerenciar servidor)."""
        if not await allowed(interaction):
            return
        lang = language.value if language.value in LANGS else DEFAULT
        if not interaction.permissions.manage_guild:
            await interaction.response.send_message(TEXT[languages.get(interaction.guild_id)]["lang_need_perm"], ephemeral=True)
            return
        languages.set(interaction.guild_id, lang)
        await interaction.response.send_message(TEXT[lang]["lang_set"], ephemeral=True)
