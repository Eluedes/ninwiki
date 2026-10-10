"""
API do NinWiki.Bot (Discord) - busca publica, feeds (log, erros, versao) e backup.

Os comandos /team (gerir a equipe pelo Discord) foram REMOVIDOS: equipe e permissoes agora so' pelo painel.

COMO A CONFIANCA FUNCIONA: o bot prova quem ELE e' com o header
X-Bot-Token (BOT_API_TOKEN do .env, comparado em tempo constante). As rotas
daqui so' LEEM (busca, log sem IP, erros sem traceback, versao) ou geram o
backup cifrado - nenhuma muda equipe ou permissoes. O token e' tratado como
senha: so' no .env, nunca no Git, nunca em log.

BOT_API_TOKEN vazio = tudo aqui devolve 404 (desligado).
"""
import asyncio
import hmac
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import backup
from app.api.uploads import UPLOAD_DIR
from app.core.config import settings
from app.core.translation import fill_missing_translations
from app.core.database import get_db
from app.core.rate_limit import BOT_FAIL, client_key, limiter, retry_message
from app.api.content_items import _dropped_by
from app.models.content import ContentItem
from app.models.enums import ContentCategory, ContentStatus
from app.models.masteries import Jutsu, Mastery
from app.models.posts import Post
from app.models.reports import ContentReport
from app.models.errors import ErrorEvent
from app.models.users import AuditLogEntry
from app.schemas.content import CamelModel
from app.schemas.errors import BotErrorEntry


async def require_bot(x_bot_token: str | None = Header(default=None)) -> None:
    """Dependencia das rotas /bot: confere o X-Bot-Token (tempo constante) e freia quem erra demais."""
    if not settings.bot_api_token:
        raise HTTPException(status_code=404, detail="Not Found")
    # Quem errou o token vezes demais fica bloqueado ate' a janela andar (freio contra adivinhacao).
    window = 10 * 60
    wait = limiter.blocked(BOT_FAIL, client_key(), settings.bot_fail_limit, window)
    if wait is not None:
        raise HTTPException(status_code=429, detail=retry_message(wait), headers={"Retry-After": str(wait)})
    if not x_bot_token or not hmac.compare_digest(x_bot_token, settings.bot_api_token):
        limiter.fail(BOT_FAIL, client_key(), window)
        raise HTTPException(status_code=401, detail="Invalid bot token")


router = APIRouter(prefix="/bot", tags=["bot"], dependencies=[Depends(require_bot)])


# ---------------- feed do log geral para o Discord ----------------

class BotLogEntry(CamelModel):
    """Uma linha do log geral SEM o IP (o canal do Discord nao deve mostrar IPs de ninguem)."""
    id: UUID
    created_at: datetime
    action: str
    entity_type: str
    entity_id: str
    diff: dict | None
    actor_name: str | None
    actor_role: str | None
    source: str


class BotLogEntryWithIp(BotLogEntry):
    """Igual, mas COM o IP de quem agiu (so' quando o bot pede includeIp=true: LOG_SHOW_IP=true no .env do bot)."""
    ip_address: str | None = None


@router.get("/audit-log", response_model=None)
async def bot_audit_log(
    since: datetime = Query(..., description="So' linhas criadas DEPOIS deste instante (ISO 8601)"),
    limit: int = Query(50, ge=1, le=100),
    include_ip: bool = Query(False, alias="includeIp", description="Inclui o IP de quem agiu (so' se o dono do bot quiser ver no canal)"),
    db: AsyncSession = Depends(get_db),
):
    """
    O bot pergunta de tempos em tempos "o que aconteceu desde X?" e posta o que vier no canal de log.
    Ordem crescente (mais antigo primeiro) para o canal ficar em ordem cronologica.
    """
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    stmt = select(AuditLogEntry).where(AuditLogEntry.created_at > since).order_by(AuditLogEntry.created_at).limit(limit)
    model = BotLogEntryWithIp if include_ip else BotLogEntry
    return [model.model_validate(row, from_attributes=True) for row in (await db.execute(stmt)).scalars().all()]


@router.get("/version")
async def bot_version() -> dict:
    """A atualizacao publicada na API (sha, titulo e data do commit): o bot mostra no Discord e edita a mesma mensagem a cada deploy."""
    from app.core.build_info import read_build
    return read_build()


# ---- Backup (banco + imagens, cifrado): o bot pede para criar, baixa em partes, manda para o canal privado e apaga o temporario ----

_backup_lock = asyncio.Lock()   # um backup por vez (consome memoria/disco)


class BackupInfo(CamelModel):
    """Resumo de um backup recem-criado: id (para baixar), tamanho total, linhas do banco e imagens incluidas."""
    id: str
    size: int
    rows: int
    files: int


def _backup_path(backup_id: str) -> Path:
    """Caminho do arquivo temporario de um backup; id fora do formato (hex de 32) = 404 (nada de '../')."""
    if not re.fullmatch(r"[0-9a-f]{32}", backup_id):
        raise HTTPException(status_code=404, detail="Backup not found")
    path = backup.BACKUP_DIR / f"{backup_id}.nbk"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Backup not found")
    return path


@router.post("/backup", response_model=BackupInfo)
async def create_backup_file(db: AsyncSession = Depends(get_db)) -> BackupInfo:
    """Cria um backup cifrado AGORA (banco + imagens). 503 se BACKUP_PASSPHRASE nao estiver configurada (nunca gera sem senha)."""
    if not settings.backup_passphrase:
        raise HTTPException(status_code=503, detail="Backups are disabled: set BACKUP_PASSPHRASE in the API variables")
    if _backup_lock.locked():
        raise HTTPException(status_code=409, detail="A backup is already running")
    async with _backup_lock:
        exclude = {t.strip() for t in settings.backup_exclude_tables.split(",") if t.strip()}
        info = await backup.create_backup(db, settings.backup_passphrase, UPLOAD_DIR, exclude)
    return BackupInfo(id=info["id"], size=info["size"], rows=info["rows"], files=info["files"])


@router.get("/backup/{backup_id}")
async def download_backup_part(backup_id: str, part: int = Query(1, ge=1), size: int = Query(9 * 1024 * 1024, ge=1024, le=24 * 1024 * 1024)) -> Response:
    """Baixa um PEDACO do backup (a parte `part`, de `size` bytes) - o Discord limita o tamanho de cada arquivo."""
    path = _backup_path(backup_id)
    with open(path, "rb") as fh:
        fh.seek((part - 1) * size)
        data = fh.read(size)
    if not data:
        raise HTTPException(status_code=404, detail="Part not found")
    return Response(content=data, media_type="application/octet-stream")


@router.delete("/backup/{backup_id}", status_code=204)
async def delete_backup_file(backup_id: str) -> None:
    """Apaga o arquivo temporario do backup (depois que o bot ja' guardou no Discord)."""
    _backup_path(backup_id).unlink(missing_ok=True)


@router.get("/errors", response_model=list[BotErrorEntry])
async def bot_errors(
    since: datetime = Query(..., description="So' problemas com ultima ocorrencia DEPOIS deste instante (ISO 8601)"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    O bot pergunta "que problemas aconteceram desde X?" e posta no canal de erros. Cada linha e' UM problema (com o
    contador de ocorrencias), sem traceback e sem IP. Quem decide se um problema que se repete merece uma nova
    mensagem e' o bot (ver NinWiki.Bot/ninwiki_bot/error_feed.py).
    """
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    stmt = select(ErrorEvent).where(ErrorEvent.last_seen > since).order_by(ErrorEvent.last_seen).limit(limit)
    return (await db.execute(stmt)).scalars().all()


class BotReportEntry(CamelModel):
    """Um report de visitante como o bot recebe: o suficiente para o aviso no Discord (sem IP)."""
    id: UUID
    kind: str
    target_type: str
    target_name: str
    target_path: str
    message: str
    locale: str | None
    created_at: datetime


@router.get("/reports", response_model=list[BotReportEntry])
async def bot_reports(
    since: datetime = Query(..., description="So' reports criados DEPOIS deste instante (ISO 8601)"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Reports de visitantes novos desde X (mais antigos primeiro) para o bot avisar no canal de erros. Sem IP."""
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    stmt = select(ContentReport).where(ContentReport.created_at > since).order_by(ContentReport.created_at).limit(limit)
    return (await db.execute(stmt)).scalars().all()


# ---- /search do bot: so' conteudo PUBLICO (nada de rascunho, equipe ou log) ----

class BotFact(CamelModel):
    """Um dado curto da ficha (ex.: Health = 120)."""
    label: str
    value: str


class BotDropMob(CamelModel):
    """Um mob que dropa o item (resposta do /drop)."""
    name: str
    href: str
    chance: float
    chance_qualifier: str | None = None


class BotDropResult(CamelModel):
    """Resposta do /drop: o item achado (ou nada) e os mobs publicados que o dropam."""
    found: bool
    title: str = ""
    href: str = ""
    image: str | None = None
    rarity: str | None = None
    mobs: list[BotDropMob] = []


class BotPostEntry(CamelModel):
    """Um post do blog no ar (resposta do /patchnotes)."""
    title: str
    excerpt: str
    image: str | None = None
    href: str
    published_at: datetime | None = None


class BotSearchHit(CamelModel):
    """Um resultado da busca do bot: o que e', um resumo, a imagem, os dados principais e o caminho da pagina no site."""
    kind: str
    title: str
    icon: str | None = None
    snippet: str = ""                     # 1 linha (lista de outros resultados)
    summary: str = ""                     # resumo maior (cartao do resultado principal)
    image: str | None = None              # endereco ABSOLUTO (o Discord precisa conseguir baixar)
    facts: list[BotFact] = []
    href: str


def _blocks(value: str | None) -> list[str]:
    """Texto de um campo rico em linhas: um paragrafo/titulo por linha e '• ' nos itens de lista (texto antigo: uma linha por quebra)."""
    if not value:
        return []
    if not value.lstrip().startswith("{"):
        return [" ".join(line.split()) for line in value.splitlines() if line.strip()]
    lines: list[str] = []

    def text_of(node: object) -> str:
        """Todo o texto corrido de um no (e dos filhos)."""
        if not isinstance(node, dict):
            return ""
        if isinstance(node.get("text"), str):
            return node["text"]
        return "".join(text_of(c) for c in node.get("content") or [])

    def walk(node: object, bullet: bool = False) -> None:
        """Percorre o documento: itens de lista viram '• texto', outros blocos viram uma linha."""
        if not isinstance(node, dict):
            return
        kind = node.get("type")
        if kind in ("paragraph", "heading", "codeBlock", "blockquote"):
            t = " ".join(text_of(node).split())
            if t:
                lines.append(("• " if bullet else "") + t)
        elif kind == "listItem":
            for child in node.get("content") or []:
                walk(child, True)
        else:
            for child in node.get("content") or []:
                walk(child, bullet)

    try:
        walk(json.loads(value))
    except ValueError:
        return [" ".join(value.split())]
    return lines


def _clip(text: str, limit: int) -> str:
    """Corta em `limit` caracteres com reticencias."""
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _plain(value: str | None, limit: int = 140) -> str:
    """Texto simples (uma linha so') de um campo rico, cortado em `limit` caracteres."""
    return _clip(" ".join(_blocks(value)), limit)


def _summary(value: str | None, limit: int = 480) -> str:
    """Resumo com quebras de linha e marcadores, cortado em `limit` caracteres (nunca no meio de uma linha, se der)."""
    out, size = [], 0
    for line in _blocks(value):
        if size + len(line) > limit:
            remaining = limit - size
            if remaining > 60 or not out:
                out.append(_clip(line, max(remaining, 60)))
            break
        out.append(line)
        size += len(line) + 1
    return "\n".join(out)


def _abs_image(path: str | None) -> str | None:
    """Endereco absoluto da imagem: /uploads/... esta' na API, /images/... no site, https://... ja' e' completo."""
    if not path:
        return None
    path = path.strip()
    if path.startswith(("https://", "http://")):
        return path
    if path.startswith("/uploads/"):
        return settings.api_base_url.rstrip("/") + path
    if path.startswith("/images/"):
        return settings.frontend_origin.rstrip("/") + path
    return None


LABELS_PT = {
    "Health": "Vida", "Damage": "Dano", "XP": "XP", "Range": "Alcance", "Respawn": "Respawn", "Spawns at": "Aparece em", "Rarity": "Raridade", "Level": "Nível",
    "Type": "Tipo", "Base damage": "Dano base", "Requirement": "Requisito", "Special": "Especial", "Speed": "Velocidade", "Knockback": "Knockback", "NPC": "NPC",
    "Stack": "Pilha", "Element": "Elemento", "Tier": "Tier", "Chakra": "Chakra", "Cooldown": "Recarga", "Cast time": "Conjuração", "Effect": "Efeito",
    "Published": "Publicado em",
}
RARITY_PT = {"Common": "Comum", "Uncommon": "Incomum", "Rare": "Raro", "Epic": "Épico", "Legendary": "Lendário", "Enchanted": "Encantado", "Unique": "Único", "Event": "Evento"}


def _facts(*pairs: tuple[str, object], lang: str = "en") -> list[BotFact]:
    """So' os dados que tem valor (vazio/None some); em `pt` os rotulos (e a raridade) saem em portugues."""
    out = []
    for label, value in pairs:
        if value in (None, "", 0):
            continue
        if lang == "pt":
            value = RARITY_PT.get(str(value), value) if label == "Rarity" else value
            label = LABELS_PT.get(label, label)
        out.append(BotFact(label=label, value=str(value)))
    return out


def _pick(lang: str, en: str | None, pt: str | None) -> str:
    """Texto no idioma pedido; sem traducao cai para o ingles."""
    return (pt if lang == "pt" and pt else en) or ""


def _like(q: str) -> str:
    """Escapa % e _ para o texto digitado nao virar curinga do LIKE."""
    return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _item_hit(i: ContentItem, lang: str = "en") -> BotSearchHit:
    """Resultado de um item/mob/arma/guia/missao publicado, com os dados certos para cada categoria."""
    cat = i.category.value
    common = [("Rarity", i.rarity.value.title()), ("Level", i.level)]
    if cat == "mobs":
        facts = _facts(("Health", i.mob_health), ("Damage", i.mob_damage), ("XP", i.mob_experience), ("Range", i.mob_range),
                       ("Respawn", i.mob_respawn_time), ("Spawns at", _pick(lang, i.spawn_location, i.spawn_location_pt)), *common[1:], lang=lang)   # mob nao tem raridade: so' o nivel
    elif cat == "weapons":
        facts = _facts(("Type", i.weapon_type), ("Base damage", i.weapon_base_damage), ("Requirement", " · ".join((i.weapon_requirement or "").splitlines()) or None),
                       ("Special", i.weapon_special_ability), ("Speed", i.weapon_speed), ("Knockback", i.weapon_knockback_distance),
                       ("NPC", i.weapon_npc), *common, lang=lang)
    else:
        facts = _facts(("Stack", f"{i.max_stack:,}" if i.max_stack else None), *common, lang=lang)
    desc = _pick(lang, i.description, i.description_pt)
    return BotSearchHit(kind=cat.rstrip("s"), title=_pick(lang, i.name, i.name_pt), icon=i.icon, snippet=_plain(desc), summary=_summary(desc),
                        image=_abs_image(i.image), facts=facts[:6], href=f"/detail/{i.slug}")


PT_FIELDS = {
    ContentItem: [("name", "name_pt"), ("description", "description_pt"), ("spawn_location", "spawn_location_pt")],
    Mastery: [("name", "name_pt"), ("description", "description_pt")],
    Jutsu: [("name", "name_pt"), ("description", "description_pt")],
    Post: [("title", "title_pt"), ("excerpt", "excerpt_pt")],
}
MAX_TRANSLATED_PER_SEARCH = 4  # limite de linhas traduzidas pela DeepL numa busca (protege a cota do plano gratis)


async def _fill_pt(db: AsyncSession, rows: list) -> None:
    """Busca em portugues: o que ainda nao tem traducao e' traduzido (DeepL) UMA vez e fica salvo - igual ao que o painel faz ao salvar. Sem chave da DeepL nada muda."""
    changed = False
    for row in rows[:MAX_TRANSLATED_PER_SEARCH]:
        pairs = PT_FIELDS[type(row)]
        if any(not getattr(row, pt) and getattr(row, en) for en, pt in pairs):
            await fill_missing_translations(row, pairs)
            changed = True
    if changed:
        await db.commit()


@router.get("/suggest", response_model=list[str])
async def bot_suggest(
    q: str = Query(..., min_length=2, max_length=60),
    lang: str = Query("en", pattern="^(en|pt)$"),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Nomes para o autocompletar do Discord (itens/mobs/armas publicados, jutsus e masteries), ate' 20, sem repetir."""
    like = _like(q.strip())
    items = (await db.execute(select(ContentItem).where(
        ContentItem.status == ContentStatus.PUBLISHED, ContentItem.name.ilike(like, escape="\\") | ContentItem.name_pt.ilike(like, escape="\\"))
        .order_by(ContentItem.name).limit(12))).scalars().all()
    jutsus = (await db.execute(select(Jutsu).where(Jutsu.name.ilike(like, escape="\\") | Jutsu.name_pt.ilike(like, escape="\\"))
                               .order_by(Jutsu.name).limit(6))).scalars().all()
    masteries = (await db.execute(select(Mastery).where(Mastery.name.ilike(like, escape="\\") | Mastery.name_pt.ilike(like, escape="\\"))
                                  .order_by(Mastery.name).limit(4))).scalars().all()
    names = [_pick(lang, r.name, r.name_pt) for r in (*items, *jutsus, *masteries)]
    return list(dict.fromkeys(n for n in names if n))[:20]


@router.get("/drops", response_model=BotDropResult)
async def bot_drops(
    q: str = Query(..., min_length=2, max_length=60),
    lang: str = Query("en", pattern="^(en|pt)$"),
    db: AsyncSession = Depends(get_db),
) -> BotDropResult:
    """Quais mobs dropam o item `q`: acha o item publicado (nome exato primeiro, senao o primeiro que contem) e lista os mobs com a chance."""
    like = _like(q.strip())
    rows = (await db.execute(select(ContentItem).where(
        ContentItem.status == ContentStatus.PUBLISHED, ContentItem.category != ContentCategory.MOBS,
        ContentItem.name.ilike(like, escape="\\") | ContentItem.name_pt.ilike(like, escape="\\")).order_by(ContentItem.name).limit(10))).scalars().all()
    if not rows:
        return BotDropResult(found=False)
    exact = [r for r in rows if q.strip().lower() in (r.name.lower(), (r.name_pt or "").lower())]
    item = (exact or rows)[0]
    mobs = await _dropped_by(item, db)
    return BotDropResult(
        found=True, title=_pick(lang, item.name, item.name_pt), href=f"/detail/{item.slug}", image=_abs_image(item.image), rarity=item.rarity.value,
        mobs=[BotDropMob(name=_pick(lang, m.name, m.name_pt), href=f"/detail/{m.slug}", chance=m.chance,
                         chance_qualifier=m.chance_qualifier.value if m.chance_qualifier else None) for m in mobs],
    )


@router.get("/latest-posts", response_model=list[BotPostEntry])
async def bot_latest_posts(
    limit: int = Query(3, ge=1, le=5), lang: str = Query("en", pattern="^(en|pt)$"), db: AsyncSession = Depends(get_db),
) -> list[BotPostEntry]:
    """Os posts mais recentes que ja' estao NO AR (publicados e com a data alcancada), para o /patchnotes."""
    now = datetime.now(timezone.utc)
    posts = (await db.execute(select(Post).where(Post.status == ContentStatus.PUBLISHED, (Post.published_at.is_(None)) | (Post.published_at <= now))
                              .order_by(Post.published_at.desc().nullslast(), Post.created_at.desc()).limit(limit))).scalars().all()
    if lang == "pt":
        await _fill_pt(db, list(posts))
    return [BotPostEntry(title=_pick(lang, p.title, p.title_pt), excerpt=_summary(_pick(lang, p.excerpt, p.excerpt_pt)), image=_abs_image(p.cover_image),
                         href=f"/blog/{p.slug}", published_at=p.published_at) for p in posts]


@router.get("/search", response_model=list[BotSearchHit])
async def bot_search(
    q: str = Query(..., min_length=2, max_length=60),
    lang: str = Query("en", pattern="^(en|pt)$", description="Idioma do resumo e dos rotulos (sem traducao cai para o ingles)"),
    db: AsyncSession = Depends(get_db),
) -> list[BotSearchHit]:
    """Procura pelo nome (em ingles ou portugues) em itens/mobs/armas/guias/missoes publicados, jutsus, masteries e posts publicados (ate' 10), com resumo, imagem e dados."""
    q = q.strip()
    if len(q) < 2:
        return []
    like = _like(q)
    now = datetime.now(timezone.utc)
    hits: list[BotSearchHit] = []
    items = (await db.execute(
        select(ContentItem).where(ContentItem.status == ContentStatus.PUBLISHED,
                                  ContentItem.name.ilike(like, escape="\\") | ContentItem.name_pt.ilike(like, escape="\\"))
        .order_by(ContentItem.name).limit(6))).scalars().all()
    masteries = (await db.execute(select(Mastery).where(Mastery.name.ilike(like, escape="\\") | Mastery.name_pt.ilike(like, escape="\\"))
                                  .order_by(Mastery.name).limit(3))).scalars().all()
    jutsus = (await db.execute(select(Jutsu).where(Jutsu.name.ilike(like, escape="\\") | Jutsu.name_pt.ilike(like, escape="\\"))
                               .order_by(Jutsu.name).limit(4))).scalars().all()
    posts = (await db.execute(
        select(Post).where(Post.status == ContentStatus.PUBLISHED, (Post.published_at.is_(None)) | (Post.published_at <= now),
                           Post.title.ilike(like, escape="\\") | Post.title_pt.ilike(like, escape="\\"))
        .order_by(Post.published_at.desc()).limit(3))).scalars().all()
    if lang == "pt":
        await _fill_pt(db, [*items, *masteries, *jutsus, *posts])
    hits += [_item_hit(i, lang) for i in items]
    for m in masteries:
        desc = _pick(lang, m.description, m.description_pt)
        long_desc = (m.long_description_pt if lang == "pt" else m.long_description) or ""
        hits.append(BotSearchHit(kind="mastery", title=_pick(lang, m.name, m.name_pt), icon=None, snippet=_plain(desc), summary=_summary(long_desc or desc),
                                 image=_abs_image(m.image or m.gif), facts=_facts(("Type", m.type.value.title()), ("Element", m.element), lang=lang),
                                 href=f"/masteries/{m.id}"))
    for j in jutsus:
        desc = _pick(lang, j.description, j.description_pt)
        long_desc = (j.long_description_pt if lang == "pt" else j.long_description) or ""
        hits.append(BotSearchHit(kind="jutsu", title=_pick(lang, j.name, j.name_pt), icon=None, snippet=f"Tier {j.tier} · {_plain(desc, 110)}",
                                 summary=_summary(long_desc or desc), image=_abs_image(j.gif),
                                 facts=_facts(("Tier", j.tier), ("Chakra", j.chakra_cost), ("Cooldown", j.cooldown), ("Range", j.range),
                                              ("Cast time", j.cast_time), ("Effect", j.effect), lang=lang),
                                 href=f"/jutsus/{j.id}"))
    for p in posts:
        excerpt = _pick(lang, p.excerpt, p.excerpt_pt)
        hits.append(BotSearchHit(kind="post", title=_pick(lang, p.title, p.title_pt), icon="📰", snippet=_plain(excerpt), summary=_summary(excerpt),
                                 image=_abs_image(p.cover_image),
                                 facts=_facts(("Published", p.published_at.strftime("%d/%m/%Y" if lang == "pt" else "%b %d, %Y") if p.published_at else None), lang=lang),
                                 href=f"/blog/{p.slug}"))
    return hits[:10]
