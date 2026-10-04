"""
Importador de noticias da Steam: copia para o blog, com a tag "Patch Notes", os posts de atualizacao do jogo.

COMO FUNCIONA
  1. Pergunta a' API publica da Steam (ISteamNews/GetNewsForApp, sem chave) pelas noticias do jogo STEAM_NEWS_APP_ID.
  2. Fica so' com os posts marcados com a tag da Steam (padrao `patchnotes`) que ainda NAO foram importados (o `gid` da Steam vai em posts.source_id, unico).
  3. Converte o texto (BBCode/HTML simples da Steam) para o formato do editor do blog (documento Tiptap) e cria o post: titulo e data da Steam, imagens
     pelo endereco da Steam, tag "Patch Notes", nome da desenvolvedora em "por/by", e um credito no topo com o link do original.
  4. A DeepL traduz EN -> PT como em qualquer post (se falhar, o post entra assim mesmo).
STEAM_NEWS_STATUS=published (padrao) publica na hora; =draft cria rascunho para voce revisar antes.

Roda sozinho a cada STEAM_NEWS_INTERVAL_MINUTES (ver app/main.py) e pode ser disparado pelo painel (POST /steam-news/import).
Este arquivo NAO depende do FastAPI: a conversao (`bbcode_to_doc`) e' funcao pura, facil de testar.
"""
import html
import json
import logging
import re
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.config import settings
from app.core.translation import fill_missing_translations, translate_field
from app.models.enums import ContentStatus
from app.models.posts import Post, Tag
from app.schemas.validators import MAX_RICH_BYTES, validate_rich_content

log = logging.getLogger("ninwiki.steam")

NEWS_URL = "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/"
CLAN_IMAGE = "https://clan.akamai.steamstatic.com/images/"   # os posts da Steam usam {STEAM_CLAN_IMAGE}/... no lugar do endereco
PATCH_TAG_ID, PATCH_TAG_NAME, PATCH_TAG_NAME_PT = "patch-notes", "Patch Notes", "Notas de Atualização"
POST_TRANSLATABLE = [("title", "title_pt"), ("excerpt", "excerpt_pt"), ("content", "content_pt")]
LINK_OK = ("http://", "https://", "mailto:")

# Resultado da ultima conferencia (para o painel mostrar): {"at", "fetched", "matched", "imported", "skipped", "errors"}
last_run: dict = {}


# ---------------------------------------------------------------- BBCode -> documento do editor ----------------------------------------------------------

_TOKEN = re.compile(r"\[(/?)([a-zA-Z0-9*]+)(?:=([^\]]*))?\]")
_LIST_TAGS = {"list", "olist"}
_SKIP_TAGS = {"hr", "noparse", "spoiler", "table", "tr", "td", "th", "th", "p", "center", "small", "sup", "sub"}   # so' o conteudo importa (nao o tag)


def _prepare(text: str) -> str:
    """Normaliza o texto da Steam: placeholders de imagem, HTML simples (<br>, <p>...), entidades e quebras de linha."""
    text = text.replace("{STEAM_CLAN_IMAGE}", CLAN_IMAGE.rstrip("/")).replace("{STEAM_CLAN_LOC_IMAGE}", CLAN_IMAGE.rstrip("/"))
    # Formato novo da Steam: [img src="URL" ...] (sem [/img]) -> [img]URL[/img]
    text = re.sub(r"(?i)\[img\s+[^\]]*?src=[\"']([^\"']+)[\"'][^\]]*\](?:\s*\[/img\])?", lambda m: f"[img]{m.group(1)}[/img]", text)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h[1-6]>|</div>", "\n", text)
    text = re.sub(r"(?i)<li[^>]*>", "\n[*]", text)
    text = re.sub(r"(?i)<(/?)(b|strong)>", lambda m: f"[{m.group(1)}b]", text)
    text = re.sub(r"(?i)<(/?)(i|em)>", lambda m: f"[{m.group(1)}i]", text)
    text = re.sub(r"(?i)<img\s[^>]*?src=[\"']([^\"']+)[\"'][^>]*>", lambda m: f"[img]{m.group(1)}[/img]", text)
    text = re.sub(r"<[^>\[]+>", "", text)   # qualquer outro HTML some (so' o texto fica)
    return html.unescape(text.replace("\r\n", "\n").replace("\r", "\n"))


def _parse(text: str) -> list:
    """Quebra o texto em uma arvore: [("text", str)] ou [("tag", nome, arg, [filhos])]. Tag que nao fecha fecha sozinha no fim."""
    root: list = []
    stack: list[tuple[str, str | None, list]] = []
    pos = 0
    for m in _TOKEN.finditer(text):
        cur = stack[-1][2] if stack else root
        if m.start() > pos:
            cur.append(("text", text[pos:m.start()]))
        pos = m.end()
        closing, name, arg = m.group(1) == "/", m.group(2).lower(), m.group(3)
        if name == "*":
            node = ("tag", "*", None, [])
            # novo item fecha o item anterior da mesma lista
            if stack and stack[-1][0] == "*":
                stack.pop()
            (stack[-1][2] if stack else root).append(node)
            stack.append(("*", None, node[3]))
        elif closing:
            if name in _LIST_TAGS | {"*"} and stack and stack[-1][0] == "*":
                stack.pop()
            for i in range(len(stack) - 1, -1, -1):
                if stack[i][0] == name:
                    del stack[i:]
                    break
        else:
            node = ("tag", name, arg, [])
            cur.append(node)
            stack.append((name, arg, node[3]))
    if pos < len(text):
        (stack[-1][2] if stack else root).append(("text", text[pos:]))
    return root


class _Builder:
    """Acumula blocos do documento; `buf` e' o paragrafo em andamento (nos de texto)."""

    def __init__(self) -> None:
        """Comeca com nenhum bloco pronto e nenhum paragrafo em andamento."""
        self.blocks: list[dict] = []
        self.buf: list[dict] = []

    def flush(self) -> None:
        """Fecha o paragrafo em andamento (se tiver texto)."""
        if any(n.get("text", "").strip() for n in self.buf):
            self.blocks.append({"type": "paragraph", "content": self.buf})
        self.buf = []


def _text_node(text: str, marks: list[dict]) -> dict:
    """No de texto com as marcas atuais (negrito, link...)."""
    node: dict = {"type": "text", "text": text}
    if marks:
        node["marks"] = [dict(m) for m in marks]
    return node


def _walk(nodes: list, marks: list[dict], out: _Builder) -> None:
    """Percorre a arvore gerando blocos: texto vira paragrafos, listas/citacoes/imagens viram os blocos do editor."""
    for node in nodes:
        if node[0] == "text":
            parts = node[1].split("\n")
            for i, part in enumerate(parts):
                if i > 0:
                    out.flush()
                if part:
                    out.buf.append(_text_node(part, marks))
            continue
        _, name, arg, children = node
        if name in {"b", "i", "u", "strike", "code"}:
            mark = {"b": "bold", "i": "italic", "u": "underline", "strike": "strike", "code": "code"}[name]
            _walk(children, marks + [{"type": mark}], out)
        elif name == "url":
            href = (arg or _plain(children)).strip()
            _walk(children, marks + ([{"type": "link", "attrs": {"href": href}}] if href.lower().startswith(LINK_OK) else []), out)
        elif name in {"h1", "h2", "h3"}:
            out.flush()
            sub = _Builder()
            _walk(children, marks, sub)
            sub.flush()
            for p in sub.blocks:
                out.blocks.append({"type": "heading", "attrs": {"level": 2 if name == "h1" else 3}, "content": p["content"]})
        elif name in _LIST_TAGS:
            out.flush()
            items = []
            for ch in children:
                if ch[0] == "tag" and ch[1] == "*":
                    sub = _Builder()
                    _walk(ch[3], marks, sub)
                    sub.flush()
                    if sub.blocks:
                        items.append({"type": "listItem", "content": sub.blocks})
            if items:
                out.blocks.append({"type": "orderedList" if name == "olist" else "bulletList", "content": items})
        elif name == "quote":
            out.flush()
            sub = _Builder()
            _walk(children, marks, sub)
            sub.flush()
            if sub.blocks:
                out.blocks.append({"type": "blockquote", "content": sub.blocks})
        elif name == "img":
            src = _plain(children).strip()
            if src.startswith("https://") and len(src) <= 500:
                out.flush()
                out.blocks.append({"type": "image", "attrs": {"src": src, "alt": ""}})
        elif name == "previewyoutube":
            vid = (arg or "").split(";")[0].strip()
            if re.fullmatch(r"[A-Za-z0-9_-]{6,20}", vid):
                out.flush()
                url = f"https://www.youtube.com/watch?v={vid}"
                out.blocks.append({"type": "paragraph", "content": [_text_node(url, [{"type": "link", "attrs": {"href": url}}])]})
        elif name in {"tr", "table"}:
            out.flush()
            _walk(children, marks, out)
            out.flush()
        elif name in {"td", "th"}:
            _walk(children, marks, out)
            out.buf.append(_text_node("  |  ", marks))
        elif name in _SKIP_TAGS or True:   # tag desconhecida: mantem so' o conteudo
            _walk(children, marks, out)


def _plain(nodes: list) -> str:
    """Texto puro de uma sub-arvore (para enderecos de [img] e [url])."""
    return "".join(n[1] if n[0] == "text" else _plain(n[3]) for n in nodes)


def bbcode_to_doc(text: str, credit: list[dict] | None = None) -> dict:
    """Converte o texto de um post da Steam (BBCode/HTML simples) no documento do editor do blog. `credit` = paragrafo de credito no topo."""
    out = _Builder()
    _walk(_parse(_prepare(text or "")), [], out)
    out.flush()
    blocks = ([{"type": "paragraph", "content": credit}] if credit else []) + out.blocks
    return {"type": "doc", "content": blocks or [{"type": "paragraph"}]}


def plain_excerpt(doc: dict, limit: int = 220) -> str:
    """Resumo: primeiras palavras do texto do documento (sem cortar no meio de uma palavra)."""
    def texts(node: dict) -> str:
        """Texto de um no, recursivamente (imagens e creditos nao entram)."""
        if node.get("type") == "text":
            return node.get("text", "")
        sep = "" if node.get("type") in ("paragraph", "heading") else " "   # texto corrido de um paragrafo nao ganha espaco extra entre os trechos
        return sep.join(texts(c) for c in node.get("content", []))
    flat = " ".join(" ".join(texts(b) for b in doc.get("content", [])[1:]).split())   # [1:] pula o paragrafo de credito
    if len(flat) <= limit:
        return flat
    return flat[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


def first_image(doc: dict) -> str | None:
    """Endereco da primeira imagem do documento (vira a capa do post)."""
    for block in doc.get("content", []):
        if block.get("type") == "image":
            return block["attrs"]["src"]
    return None


# ---------------------------------------------------------------- busca na Steam e criacao dos posts ------------------------------------------------------

def _slugify(text: str) -> str:
    """Slug do endereco do post: minusculas, so' letras/numeros/hifen."""
    import unicodedata
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


async def fetch_news(app_id: str, count: int = 20, transport: httpx.AsyncBaseTransport | None = None) -> list[dict]:
    """Baixa as noticias mais recentes do jogo na API publica da Steam (sem chave). Levanta httpx.HTTPError se a Steam falhar."""
    async with httpx.AsyncClient(timeout=20.0, transport=transport, headers={"User-Agent": "NinWikiNewsImporter/1.0"}) as client:
        res = await client.get(NEWS_URL, params={"appid": app_id, "count": count, "maxlength": 0, "format": "json"})
        res.raise_for_status()
        return (res.json().get("appnews") or {}).get("newsitems") or []


def _is_update(item: dict, need: str) -> bool:
    """O post conta como atualizacao? Sem tag exigida (`need` vazio): todos. Senao: tem a tag da Steam OU o titulo bate com STEAM_NEWS_TITLE_PATTERN (a Steam nem sempre marca como `patchnotes`)."""
    if not need:
        return True
    if need in [str(t).lower() for t in (item.get("tags") or [])]:
        return True
    pattern = settings.steam_news_title_pattern.strip()
    try:
        return bool(pattern and re.search(pattern, str(item.get("title") or ""), re.IGNORECASE))
    except re.error:   # expressao invalida no .env: ignora (so' a tag vale) em vez de derrubar a importacao
        log.warning("Steam news: STEAM_NEWS_TITLE_PATTERN is not a valid regular expression")
        return False


async def _patch_tag(db: AsyncSession) -> Tag:
    """A tag "Patch Notes" (cria se ainda nao existir, ja' com a traducao)."""
    tag = await db.get(Tag, PATCH_TAG_ID)
    if tag is None:
        try:
            pt = await translate_field(PATCH_TAG_NAME) or PATCH_TAG_NAME_PT
        except Exception:  # noqa: BLE001 - traducao e' enfeite: nunca impede a importacao
            pt = PATCH_TAG_NAME_PT
        tag = Tag(id=PATCH_TAG_ID, name=PATCH_TAG_NAME, name_pt=pt)
        db.add(tag)
        await db.flush()
    return tag


def parse_post_ref(value: str) -> str | None:
    """O gid de um post da Steam a partir do LINK (.../news/app/1674010/view/532654232345) ou do proprio numero; None se nao achar um numero valido."""
    m = re.search(r"(\d{6,25})\s*/?\s*$", value.strip().split("?")[0].split("#")[0])
    return m.group(1) if m else None


async def _refresh_existing(db: AsyncSession, item: dict, run: dict) -> None:
    """Reconverte um post JA importado (mesmo gid): atualiza conteudo, resumo e capa e retraduz. Autor, tags, status e slug ficam como estao."""
    gid, title = str(item.get("gid")), " ".join(str(item.get("title") or "Patch Notes").split())[:200]
    try:
        post = (await db.execute(select(Post).where(Post.source_id == gid))).scalar_one()
        author = post.author_label or settings.steam_news_author_name or "Steam"
        url = str(item.get("url") or "")[:500]
        credit = [_text_node("Originally published on Steam" + (f" by {author}" if author != "Steam" else "") + ". ", [{"type": "italic"}])]
        if url.startswith("https://"):
            credit.append(_text_node("View the original post", [{"type": "italic"}, {"type": "link", "attrs": {"href": url}}]))
        doc = bbcode_to_doc(str(item.get("contents") or ""), credit)
        post.content = validate_rich_content(json.dumps(doc, ensure_ascii=False))
        post.excerpt = plain_excerpt(doc) or title
        post.cover_image = first_image(doc)
        post.content_pt = post.excerpt_pt = None
        try:
            await fill_missing_translations(post, POST_TRANSLATABLE)
        except Exception as exc:  # noqa: BLE001
            log.warning("Steam news: translation failed for %s: %s", gid, exc)
        await log_action(db, action="update", entity_type="post", entity_id=str(post.id), diff={"name": title, "source": "steam", "refreshed": True}, source="system")
        await db.commit()
        run["imported"] += 1
        run["titles"].append(title + " (updated)")
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        run["errors"].append(f"{title[:60]}: {type(exc).__name__}: {str(exc)[:120]}")


async def import_news(db: AsyncSession, transport: httpx.AsyncBaseTransport | None = None, max_new: int | None = None, only_gid: str | None = None) -> dict:
    """
    Confere a Steam e cria os posts novos. Devolve o resumo {"at", "fetched", "matched", "imported", "skipped", "errors", "titles"}.
    Nunca levanta por causa da Steam/DeepL: o erro vai em `errors` (e no log) e o proximo ciclo tenta de novo.
    `only_gid` = importa SO' esse post (mesmo antigo, mesmo sem a tag exigida): procura nos ultimos 300 posts da Steam.
    """
    run = {"at": datetime.now(timezone.utc).isoformat(), "fetched": 0, "matched": 0, "imported": 0, "skipped": 0, "errors": [], "titles": [], "seen": []}
    global last_run
    try:
        items = await fetch_news(settings.steam_news_app_id, 300 if only_gid else 20, transport)
    except Exception as exc:  # noqa: BLE001
        run["errors"].append(f"Steam request failed: {type(exc).__name__}")
        log.warning("Steam news: %s", exc)
        last_run = run
        return run
    run["fetched"] = len(items)
    # Diagnostico: titulo + tags dos primeiros posts que a Steam devolveu (o painel mostra, para entender por que algo nao foi importado)
    run["seen"] = [{"title": " ".join(str(i.get("title") or "?").split())[:80],
                    "tags": [str(t) for t in (i.get("tags") or [])][:6], "date": int(i.get("date") or 0)} for i in items[:8]]
    need = "" if only_gid else settings.steam_news_require_tag.strip().lower()   # post escolhido a dedo: nao exige a tag
    wanted = [i for i in items if (str(i.get("gid")) == only_gid if only_gid else _is_update(i, need))]
    if only_gid and not wanted:
        run["errors"].append(f"Post {only_gid} was not found among the latest {len(items)} Steam news of this game")
    run["matched"] = len(wanted)
    known = set((await db.execute(select(Post.source_id).where(Post.source_id.in_([str(i.get("gid")) for i in wanted])))).scalars().all()) if wanted else set()
    if only_gid and known:   # post ja importado e escolhido a dedo: refaz o conteudo (ex.: depois de melhorar o conversor)
        await _refresh_existing(db, wanted[0], run)
        known = set()
        wanted = []
        run["skipped"] = 0
    fresh = sorted((i for i in wanted if str(i.get("gid")) not in known), key=lambda i: int(i.get("date") or 0), reverse=True)
    run["skipped"] = len(wanted) - len(fresh)
    status = ContentStatus.DRAFT if settings.steam_news_status.strip().lower() == "draft" else ContentStatus.PUBLISHED
    tag = await _patch_tag(db) if fresh else None
    for item in sorted(fresh[: (len(fresh) if only_gid else (max_new if max_new is not None else settings.steam_news_max_per_run))], key=lambda i: int(i.get("date") or 0)):
        gid, title = str(item.get("gid")), " ".join(str(item.get("title") or "Patch Notes").split())[:200]
        try:
            author = (settings.steam_news_author_name or str(item.get("author") or "") or "Steam").strip()[:100]
            url = str(item.get("url") or "")[:500]
            credit = [_text_node("Originally published on Steam" + (f" by {author}" if author != "Steam" else "") + ". ", [{"type": "italic"}])]
            if url.startswith("https://"):
                credit.append(_text_node("View the original post", [{"type": "italic"}, {"type": "link", "attrs": {"href": url}}]))
            doc = bbcode_to_doc(str(item.get("contents") or ""), credit)
            if len(json.dumps(doc, ensure_ascii=False).encode()) > MAX_RICH_BYTES * 0.9:   # enorme: corta e manda ler o original
                doc = {"type": "doc", "content": doc["content"][:1] + [{"type": "paragraph", "content": [_text_node("This post is too long to copy here. Read the full post on Steam using the link above.", [])]}]}
            content = validate_rich_content(json.dumps(doc, ensure_ascii=False))
            when = datetime.fromtimestamp(int(item.get("date") or 0), tz=timezone.utc) if item.get("date") else datetime.now(timezone.utc)
            slug = f"{_slugify(title)[:120] or 'patch-notes'}-{gid[-6:]}"
            if (await db.execute(select(Post.id).where(Post.slug == slug))).first():
                slug = f"{slug}-{gid[-3:]}"
            post = Post(slug=slug, title=title, excerpt=plain_excerpt(doc) or title, content=content, cover_image=first_image(doc),
                        author_id=None, author_label=author, source_id=gid, source_url=url or None, status=status, published_at=when)
            post.tags = [tag]
            db.add(post)
            try:
                await fill_missing_translations(post, POST_TRANSLATABLE)
            except Exception as exc:  # noqa: BLE001 - sem traducao o post entra assim mesmo (da' para retraduzir depois)
                log.warning("Steam news: translation failed for %s: %s", gid, exc)
            await db.flush()
            await log_action(db, action="create", entity_type="post", entity_id=str(post.id),
                             diff={"name": title, "status": status.value, "source": "steam", "steamGid": gid}, source="system")
            await db.commit()
            run["imported"] += 1
            run["titles"].append(title)
        except Exception as exc:  # noqa: BLE001 - um post com problema nao impede os outros
            await db.rollback()
            run["errors"].append(f"{title[:60]}: {type(exc).__name__}: {str(exc)[:120]}")
            log.warning("Steam news: could not import %s: %s", gid, exc)
    last_run = run
    log.info("Steam news: %s lidos, %s com a tag '%s', %s importados, %s ja existiam, erros: %s", run["fetched"], run["matched"], need, run["imported"], run["skipped"], run["errors"] or "nenhum")
    return run
