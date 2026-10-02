"""
Validadores Pydantic compartilhados entre schemas diferentes (content.py,
masteries.py, e qualquer schema futuro que tenha campo de texto rico
editado pelo Tiptap). Extraido pra' arquivo proprio pra' nao duplicar a
mesma logica de seguranca em cada schema - um lugar so' pra manter.
"""
import json
import re
from typing import Any

# Tipos de no' e de marca que o editor Tiptap (e o StarterKit) realmente gera. Qualquer outro tipo
# num documento enviado direto pela API e' recusado: assim ninguem injeta estrutura que o site
# nao saiba renderizar (nem tente esconder algo estranho dentro do JSON).
ALLOWED_NODE_TYPES = frozenset({
    "doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote",
    "codeBlock", "hardBreak", "horizontalRule", "table", "tableRow", "tableCell", "tableHeader", "ficha",
    # blog: imagem, mencao (@), video do YouTube/Twitch e spoiler (details/summary)
    "image", "mention", "video", "details", "detailsSummary", "detailsContent",
})
ALLOWED_MARK_TYPES = frozenset({"bold", "italic", "underline", "strike", "code", "link", "textStyle"})
# Estilo de texto (marca textStyle): vira `style="..."` no site, entao so' valores de formato conhecido (nada de `;`, `url(...)`, `expression`...).
_COLOR_RE = re.compile(r"^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[0-9.]{1,4}\s*)?\))$")
_SIZE_RE = re.compile(r"^\d{1,3}(\.\d)?(px|em|rem|%)$")
_FONT_RE = re.compile(r"^(var\(--font-[a-z]{2,20}\)|[A-Za-z0-9 \"',.-]{1,80})(, ?(var\(--font-[a-z]{2,20}\)|[A-Za-z0-9 \"'.-]{1,40})){0,5}$")
_STYLE_ATTRS = {"color": _COLOR_RE, "backgroundColor": _COLOR_RE, "fontSize": _SIZE_RE, "fontFamily": _FONT_RE}
# Esquemas de link aceitos (links relativos "/..." e ancoras "#..." tambem). Bloqueia javascript:, data:, vbscript:...
ALLOWED_LINK_SCHEMES = ("http://", "https://", "mailto:", "/", "#")
# Enderecos aceitos para midia embutida: imagens locais (/uploads/...) ou https; videos SO' dos players oficiais.
ALLOWED_IMAGE_PREFIXES = ("/uploads/", "https://", "http://localhost", "http://127.0.0.1")
ALLOWED_VIDEO_PREFIXES = ("https://www.youtube-nocookie.com/embed/", "https://player.twitch.tv/")
MAX_RICH_BYTES = 300_000   # tamanho maximo de UM campo rico (impede encher o banco / travar o render)
MAX_RICH_DEPTH = 40        # profundidade maxima de aninhamento (impede "bomba" de listas dentro de listas...)


def _check_attrs(node: dict) -> None:
    """Confere os atributos dos nos de midia/mencao: so' enderecos permitidos e textos curtos (nada de javascript:/data:)."""
    kind, attrs = node.get("type"), node.get("attrs") or {}
    if kind == "image":
        src = str(attrs.get("src", "")).strip()
        if not src.startswith(ALLOWED_IMAGE_PREFIXES) or len(src) > 500:
            raise ValueError("Invalid rich content: image address not allowed")
    elif kind == "video":
        src = str(attrs.get("src", "")).strip()
        if not src.startswith(ALLOWED_VIDEO_PREFIXES) or len(src) > 300:
            raise ValueError("Invalid rich content: video address not allowed (only YouTube and Twitch)")
    elif kind == "mention":
        if len(str(attrs.get("id", ""))) > 120 or len(str(attrs.get("label", ""))) > 120:
            raise ValueError("Invalid rich content: mention too long")
        href = str(attrs.get("href") or "")
        if href and (not href.startswith("/") or href.startswith("//") or "\\" in href or len(href) > 200):
            raise ValueError("Invalid rich content: mention link must be a page of this site")


def _check_node(node: Any, depth: int) -> None:
    """Percorre o documento Tiptap conferindo tipos permitidos, profundidade e links. Levanta ValueError se algo for suspeito."""
    if depth > MAX_RICH_DEPTH:
        raise ValueError("Invalid rich content: nesting too deep")
    if not isinstance(node, dict):
        raise ValueError("Invalid rich content: malformed node")
    if node.get("type") not in ALLOWED_NODE_TYPES:
        raise ValueError(f"Invalid rich content: block type not allowed ({str(node.get('type'))[:30]})")
    _check_attrs(node)
    for mark in node.get("marks") or []:
        if not isinstance(mark, dict) or mark.get("type") not in ALLOWED_MARK_TYPES:
            raise ValueError("Invalid rich content: formatting not allowed")
        if mark.get("type") == "textStyle":
            for key, value in (mark.get("attrs") or {}).items():
                if value is None:
                    continue
                pattern = _STYLE_ATTRS.get(key)
                if pattern is None or not isinstance(value, str) or not pattern.match(value.strip()):
                    raise ValueError(f"Invalid rich content: text style not allowed ({key})")
        if mark.get("type") == "link":
            href = str((mark.get("attrs") or {}).get("href", "")).strip().lower()
            if not href.startswith(ALLOWED_LINK_SCHEMES):
                raise ValueError("Invalid rich content: link address not allowed")
    for child in node.get("content") or []:
        _check_node(child, depth + 1)


def validate_rich_content(value: str | None) -> str | None:
    """
    Valida o que o editor Tiptap (components/admin/rich-text-editor.tsx
    no front) manda pra' um campo de texto rico, ANTES de aceitar salvar -
    nunca confiar cegamente no que o navegador enviou, mesmo sendo o
    nosso proprio editor (alguem pode bater direto na API sem passar
    pela UI).

    Regras:
    - string vazia ou None: ok, campo opcional.
    - comeca com "{": precisa ser JSON valido com "type": "doc" (o
      formato que o Tiptap gera) - rejeita qualquer outra coisa.
    - nao comeca com "{": trata como texto simples (retrocompatibilidade
      com entries criadas antes deste editor existir) - mas rejeita
      se tiver uma tag <script, uma defesa a mais contra HTML cru
      sendo empurrado direto pela API, ignorando o editor.
    """
    if not value:
        return value
    stripped = value.strip()
    if stripped.startswith("{"):
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            raise ValueError("Invalid rich content: not valid JSON")
        if not isinstance(parsed, dict) or parsed.get("type") != "doc":
            raise ValueError("Invalid rich content: expected a Tiptap document (\"type\": \"doc\")")
        if len(stripped.encode("utf-8")) > MAX_RICH_BYTES:
            raise ValueError("Rich content too large")
        _check_node(parsed, 0)
        return value
    if "<script" in stripped.lower():
        raise ValueError("Content cannot contain <script> tags")
    return value
