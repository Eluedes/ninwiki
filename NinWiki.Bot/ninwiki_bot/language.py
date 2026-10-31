"""
Idioma do bot POR SERVIDOR (en = ingles, o padrao; pt = portugues). Quem tem a permissao "Gerenciar servidor" escolhe com /language
e a escolha fica salva em language_state.json (sobrevive a reinicio e a deploy). /search, /item, /help e os outros respondem nesse idioma.
Este arquivo NAO importa discord.py: so' guarda e le a escolha, e tem os textos das duas linguas.
"""
import json
from pathlib import Path

LANGS = ("en", "pt")
DEFAULT = "en"

# Textos das telas publicas (/search e /status) nas duas linguas.
TEXT = {
    "en": {
        "kind": {"item": "Item", "mob": "Mob", "weapon": "Weapon", "guide": "Guide", "mission": "Mission", "mastery": "Mastery", "jutsu": "Jutsu", "post": "Blog post"},
        "open": "Open the full page", "more": "See another result…", "results": "{n} results for “{q}”",
        "none": "## 🔎 No results\nNothing matched **{q}**. Try a shorter word or another spelling.",
        "only_owner": "Only the person who ran this search can switch results. Run /search yourself!",
        "searched_by": "Searched by {user}", "team": "Nin Codex Team", "full_info": "Full details on the wiki",
        "wiki_down": "❌ The wiki is not answering right now. Try again in a moment.",
        "st_title": "## 📡 Nin Codex status", "st_ok": "All systems operational.", "st_bad": "Something is not responding.",
        "online": "Online", "offline": "OFFLINE", "unknown": "unknown", "uptime": "uptime", "not_monitored": "not monitored",
        "checked": "Checked {when} · uptime counts since the bot started",
        "lang_set": "✅ This server's language is now **English**. every command will answer in English here.",
        "lang_need_perm": "❌ You need the **Manage Server** permission to change the language.",
        "wrong_guild": "This command is not available on this server.", "slow": "⏳ Slow down - try again in {s}s.",
        "drop_none": "Nothing matched **{q}**. Try another name (the item must be published on the wiki).",
        "drop_title": "🎁 Where to get {item}", "drop_nobody": "No published mob drops this item yet.", "drop_chance": "chance",
        "drop_footer": "Full details on the wiki", "posts_title": "📰 Latest patch notes / news", "posts_none": "No posts yet.",
        # --- comandos de consulta (wiki_commands.py) ---
        "pick_none": "## 🔎 No {kind} found\nNothing matched **{q}** here. Try /search for everything, or another spelling.",
        "kind_item": "item or weapon", "kind_mob": "mob", "kind_jutsu": "jutsu", "kind_mastery": "mastery",
        "short_term": "❌ Type at least 2 letters.",
        "cmp_title": "⚖️ {a} vs {b}", "cmp_same": "Pick two different names.", "cmp_missing": "❌ Could not find **{q}** (items, weapons, mobs or jutsus).",
        "cmp_hint": "Higher is not always better: read the full pages.", "cmp_nodata": "No data to compare.", "cmp_open": "Open {name}",
        "help_title": "📖 Nin Codex bot — commands", "help_site": "Wiki: {url}",
        "help_lines": [
            ("/search", "Search items, mobs, weapons, jutsus, masteries and posts"),
            ("/item · /mob · /jutsu · /mastery", "Look up one thing by name (start typing for suggestions)"),
            ("/drop", "Which mobs drop an item, and how likely"),
            ("/compare", "Two items, weapons or mobs side by side"),
            ("/patchnotes", "Latest news and patch notes"),
            ("/status", "Are the API, database and site up?"),
            ("/language", "Server language (needs Manage Server)"),
        ],
    },
    "pt": {
        "kind": {"item": "Item", "mob": "Mob", "weapon": "Arma", "guide": "Guia", "mission": "Missão", "mastery": "Maestria", "jutsu": "Jutsu", "post": "Post do blog"},
        "open": "Abrir a página completa", "more": "Ver outro resultado…", "results": "{n} resultados para “{q}”",
        "none": "## 🔎 Nada encontrado\nNada combinou com **{q}**. Tente uma palavra menor ou outra grafia.",
        "only_owner": "Só quem fez esta busca pode trocar de resultado. Use /search você mesmo!",
        "searched_by": "Pesquisado por {user}", "team": "Equipe Nin Codex", "full_info": "Detalhes completos no wiki",
        "wiki_down": "❌ O wiki não está respondendo agora. Tente de novo em instantes.",
        "st_title": "## 📡 Status do Nin Codex", "st_ok": "Todos os sistemas funcionando.", "st_bad": "Algo não está respondendo.",
        "online": "Online", "offline": "FORA DO AR", "unknown": "desconhecido", "uptime": "disponibilidade", "not_monitored": "não monitorado",
        "checked": "Verificado {when} · a disponibilidade conta desde que o bot ligou",
        "lang_set": "✅ O idioma deste servidor agora é **Português**. todos os comandos vão responder em português aqui.",
        "lang_need_perm": "❌ Você precisa da permissão **Gerenciar servidor** para trocar o idioma.",
        "wrong_guild": "Este comando não está disponível neste servidor.", "slow": "⏳ Calma - tente de novo em {s}s.",
        "drop_none": "Nada combinou com **{q}**. Tente outro nome (o item precisa estar publicado no wiki).",
        "drop_title": "🎁 Onde conseguir {item}", "drop_nobody": "Nenhum mob publicado dropa este item ainda.", "drop_chance": "chance",
        "drop_footer": "Detalhes completos no wiki", "posts_title": "📰 Últimas notícias / patch notes", "posts_none": "Nenhum post ainda.",
        # --- comandos de consulta (wiki_commands.py) ---
        "pick_none": "## 🔎 Nenhum(a) {kind} encontrado(a)\nNada combinou com **{q}** aqui. Tente /search para tudo, ou outra grafia.",
        "kind_item": "item ou arma", "kind_mob": "mob", "kind_jutsu": "jutsu", "kind_mastery": "maestria",
        "short_term": "❌ Digite pelo menos 2 letras.",
        "cmp_title": "⚖️ {a} vs {b}", "cmp_same": "Escolha dois nomes diferentes.", "cmp_missing": "❌ Não achei **{q}** (itens, armas, mobs ou jutsus).",
        "cmp_hint": "Maior nem sempre é melhor: leia as páginas completas.", "cmp_nodata": "Sem dados para comparar.", "cmp_open": "Abrir {name}",
        "help_title": "📖 Bot do Nin Codex — comandos", "help_site": "Wiki: {url}",
        "help_lines": [
            ("/search", "Busca itens, mobs, armas, jutsus, maestrias e posts"),
            ("/item · /mob · /jutsu · /mastery", "Consulta uma coisa pelo nome (comece a digitar para ver sugestões)"),
            ("/drop", "Quais mobs dropam um item, e com que chance"),
            ("/compare", "Dois itens, armas ou mobs lado a lado"),
            ("/patchnotes", "Últimas notícias e patch notes"),
            ("/status", "API, banco e site estão no ar?"),
            ("/language", "Idioma do servidor (precisa de Gerenciar servidor)"),
        ],
    },
}


class LanguageStore:
    """Guarda/le o idioma de cada servidor num arquivo JSON (escrita atomica)."""

    def __init__(self, path: Path):
        self.path = path

    def _all(self) -> dict[str, str]:
        """Todos os idiomas salvos ({id do servidor: 'en'|'pt'}); arquivo ausente/corrompido = nada salvo."""
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return {str(k): v for k, v in raw.items() if v in LANGS}
        except (OSError, ValueError, AttributeError):
            return {}

    def get(self, guild_id: int | None) -> str:
        """Idioma do servidor (ingles se nunca foi escolhido ou se for mensagem direta)."""
        return self._all().get(str(guild_id), DEFAULT)

    def set(self, guild_id: int, lang: str) -> None:
        """Salva o idioma do servidor."""
        if lang not in LANGS:
            raise ValueError("unknown language")
        data = self._all()
        data[str(guild_id)] = lang
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data), encoding="utf-8")
        tmp.replace(self.path)
