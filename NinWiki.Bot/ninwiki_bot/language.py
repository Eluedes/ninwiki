"""
Idioma do bot POR SERVIDOR (en = ingles, o padrao; pt = portugues). Quem tem a permissao "Gerenciar servidor" escolhe com /language
e a escolha fica salva em language_state.json (sobrevive a reinicio e a deploy). /search e /status respondem nesse idioma.
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
        "searched_by": "Searched by {user}", "team": "Nin Online Wiki Team", "full_info": "Full details on the wiki",
        "wiki_down": "❌ The wiki is not answering right now. Try again in a moment.",
        "st_title": "## 📡 NinWiki status", "st_ok": "All systems operational.", "st_bad": "Something is not responding.",
        "online": "Online", "offline": "OFFLINE", "unknown": "unknown", "uptime": "uptime", "not_monitored": "not monitored",
        "checked": "Checked {when} · uptime counts since the bot started",
        "lang_set": "✅ This server's language is now **English**. `/search` and `/status` will answer in English here.",
        "lang_need_perm": "❌ You need the **Manage Server** permission to change the language.",
        "wrong_guild": "This command is not available on this server.", "slow": "⏳ Slow down - try again in {s}s.",
    },
    "pt": {
        "kind": {"item": "Item", "mob": "Mob", "weapon": "Arma", "guide": "Guia", "mission": "Missão", "mastery": "Maestria", "jutsu": "Jutsu", "post": "Post do blog"},
        "open": "Abrir a página completa", "more": "Ver outro resultado…", "results": "{n} resultados para “{q}”",
        "none": "## 🔎 Nada encontrado\nNada combinou com **{q}**. Tente uma palavra menor ou outra grafia.",
        "only_owner": "Só quem fez esta busca pode trocar de resultado. Use /search você mesmo!",
        "searched_by": "Pesquisado por {user}", "team": "Equipe Nin Online Wiki", "full_info": "Detalhes completos no wiki",
        "wiki_down": "❌ O wiki não está respondendo agora. Tente de novo em instantes.",
        "st_title": "## 📡 Status do NinWiki", "st_ok": "Todos os sistemas funcionando.", "st_bad": "Algo não está respondendo.",
        "online": "Online", "offline": "FORA DO AR", "unknown": "desconhecido", "uptime": "disponibilidade", "not_monitored": "não monitorado",
        "checked": "Verificado {when} · a disponibilidade conta desde que o bot ligou",
        "lang_set": "✅ O idioma deste servidor agora é **Português**. `/search` e `/status` vão responder em português aqui.",
        "lang_need_perm": "❌ Você precisa da permissão **Gerenciar servidor** para trocar o idioma.",
        "wrong_guild": "Este comando não está disponível neste servidor.", "slow": "⏳ Calma - tente de novo em {s}s.",
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
