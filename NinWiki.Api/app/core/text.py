"""Utilitarios de texto compartilhados."""
import json
import re


def escape_like(q: str) -> str:
    """Escapa \\, % e _ digitados pela pessoa (use com ilike(..., escape="\\\\")); sem isso "%" casaria com tudo."""
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ---------------------------------------------------------------------------
# Marcacao de texto rico do CLIENTE DO JOGO (Unity/TextMeshPro), ex.: "<color=yellow>Hand Weapon</color>".
# Ela vazava para o texto do wiki e aparecia crua para o leitor. So' casam tags CONHECIDAS (nome + "=valor" opcional + ">"):
# um "<" de comparacao ("HP < 50", "a<b") nunca e' apagado.
# ---------------------------------------------------------------------------

_TAG_JOGO = re.compile(
    r"</?(?:color|b|i|u|s|size|sprite|link|material|quad|align|mark|style|font|sup|sub|nobr|indent|line-height)\b(?:=[^<>\n]*)?\s*/?>", re.I)
_TAG_BR = re.compile(r"<br\s*/?>", re.I)


def limpar_marcacao_jogo(texto: str | None) -> str | None:
    """Tira as tags do jogo (<color=..>, </color>, <b>, <size=..>, <sprite..>...) deixando o texto de dentro; <br> vira quebra de linha. Texto sem tag volta igual."""
    if not texto or "<" not in texto:
        return texto
    return _TAG_JOGO.sub("", _TAG_BR.sub("\n", texto))


def _limpar_no(no: object) -> None:
    """Limpa so' os nos de texto de um documento Tiptap (estrutura e marcas ficam como estao)."""
    if isinstance(no, dict):
        if isinstance(no.get("text"), str):
            no["text"] = limpar_marcacao_jogo(no["text"])
        for filho in no.get("content") or []:
            _limpar_no(filho)


def limpar_marcacao_campo(valor: str | None) -> str | None:
    """
    Igual a limpar_marcacao_jogo, mas entende campo rico: se for documento Tiptap (JSON), limpa so' os nos de texto e regrava o JSON
    no mesmo formato (compacto ou com espacos); se nada mudou devolve o MESMO valor (idempotente, sem regravar a toa).
    """
    if not valor or "<" not in valor:
        return valor
    if not valor.lstrip().startswith("{"):
        return limpar_marcacao_jogo(valor)
    try:
        doc = json.loads(valor)
    except ValueError:
        return limpar_marcacao_jogo(valor)
    _limpar_no(doc)
    novo = json.dumps(doc, ensure_ascii=False, separators=(",", ":") if '"type":"doc"' in valor[:30] else None)
    return valor if json.loads(novo) == json.loads(valor) else novo
