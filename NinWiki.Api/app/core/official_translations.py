"""
Traducoes OFICIAIS do jogo (arquivos "nin-online-translation" exportados do proprio Nin Online) aplicadas ao wiki.

O arquivo e' um dicionario {texto em ingles: texto traduzido}. Aqui procuramos, nos nossos registros (conteudo, jutsus,
masteries, vilas, cla's e organizacoes), os textos em ingles que existem no dicionario e preenchemos o campo `_pt` com a
traducao oficial - melhor que a automatica (DeepL).

REGRAS DE SEGURANCA (nada e' apagado nem sobrescrito sem querer):
  - comparacao pelo texto em ingles inteiro, sem diferenciar maiusculas e ignorando espacos extras (so' acerto exato);
  - por padrao so' preenche o `_pt` que esta' VAZIO (e, no conteudo, o que veio da traducao automatica); com `overwrite`
    troca tambem o portugues que ja' existe (inclusive o escrito a mao) pela versao oficial;
  - traducao maior que o limite da coluna e' ignorada (nao corta no meio);
  - campo rico (descricoes) so' e' trocado quando o texto INTEIRO bate (ou todos os paragrafos batem), nunca pela metade.
Este arquivo nao faz commit: quem chama decide (preview so' calcula; apply grava).
"""
import json
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import ContentItem
from app.models.masteries import Jutsu, Mastery
from app.models.villages import Clan, Organization, Village

# (rotulo, modelo, [(campo EN, campo PT, tipo)]) - tipo: "plain" = texto simples; "rich" = campo do editor (JSON do Tiptap ou texto)
SPECS: list[tuple[str, type, list[tuple[str, str, str]]]] = [
    ("content", ContentItem, [("name", "name_pt", "plain"), ("description", "description_pt", "rich"), ("lore", "lore_pt", "rich"),
                              ("synergy", "synergy_pt", "rich"), ("spawn_location", "spawn_location_pt", "plain")]),
    ("jutsu", Jutsu, [("name", "name_pt", "plain"), ("description", "description_pt", "rich"), ("long_description", "long_description_pt", "rich")]),
    ("mastery", Mastery, [("name", "name_pt", "plain"), ("description", "description_pt", "rich"), ("long_description", "long_description_pt", "rich")]),
    ("village", Village, [("name", "name_pt", "plain"), ("motto", "motto_pt", "plain"), ("climate", "climate_pt", "plain"),
                          ("description", "description_pt", "rich"), ("long_description", "long_description_pt", "rich")]),
    ("clan", Clan, [("name", "name_pt", "plain"), ("description", "description_pt", "rich")]),
    ("organization", Organization, [("name", "name_pt", "plain"), ("description", "description_pt", "rich")]),
]
MAX_ENTRIES = 100_000
MAX_KEY_CHARS = 5000


def norm(text: str) -> str:
    """Forma de comparacao: espacos/quebras de linha colapsados e sem diferenciar maiusculas."""
    return " ".join(text.split()).casefold()


def build_index(translations: dict[str, str]) -> dict[str, str]:
    """Dicionario normalizado {texto EN: traducao}, so' com pares uteis (chave com texto de verdade e traducao preenchida)."""
    index: dict[str, str] = {}
    for key, value in translations.items():
        if not isinstance(key, str) or not isinstance(value, str) or len(key) > MAX_KEY_CHARS:
            continue
        k, v = norm(key), value.strip()
        if k and "\x00" not in key and v and k not in index:
            index[k] = v
    return index


def _blocks(value: str) -> list[str] | None:
    """Textos dos blocos de um campo rico (JSON do Tiptap); None se for texto simples (ou JSON que nao e' documento)."""
    stripped = value.strip()
    if not stripped.startswith("{"):
        return None
    try:
        doc = json.loads(stripped)
    except ValueError:
        return None
    if not isinstance(doc, dict) or doc.get("type") != "doc":
        return None

    def text_of(node: dict) -> str:
        """Texto de um no (concatena os filhos)."""
        if node.get("type") == "text":
            return str(node.get("text", ""))
        return "".join(text_of(c) for c in node.get("content", []) if isinstance(c, dict))

    return [t for t in (text_of(n).strip() for n in doc.get("content", []) if isinstance(n, dict)) if t]


def _doc(lines: list[str]) -> str:
    """Monta um documento Tiptap simples (um paragrafo por linha)."""
    paragraphs = [{"type": "paragraph", "content": [{"type": "text", "text": line}]} for line in lines if line.strip()]
    return json.dumps({"type": "doc", "content": paragraphs}, ensure_ascii=False)


def translate_plain(value: str | None, index: dict[str, str]) -> str | None:
    """Traducao oficial de um texto simples (None se nao ha' acerto exato)."""
    if not value or not value.strip():
        return None
    return index.get(norm(value))


def translate_rich(value: str | None, index: dict[str, str]) -> str | None:
    """
    Traducao oficial de um campo rico, no MESMO formato do campo (JSON do Tiptap -> JSON do Tiptap; texto -> texto).
    So' quando o texto inteiro bate, ou quando TODOS os paragrafos batem um a um.
    """
    if not value or not value.strip():
        return None
    blocks = _blocks(value)
    if blocks is None:   # texto simples (campo antigo)
        return index.get(norm(value))
    if not blocks:
        return None
    whole = index.get(norm(" ".join(blocks)))
    if whole is not None:
        return _doc(whole.splitlines())
    parts = [index.get(norm(b)) for b in blocks]
    if all(p is not None for p in parts):
        return _doc([line for p in parts for line in p.splitlines()])
    return None


# Primeira palavra de rotulos de tela / missoes / comandos (nao de nomes de coisas): "Click to hide", "Reset all perks", "Talk to ...".
_NOT_NAME_FIRST_WORDS = frozenset({
    "click", "right-click", "left-click", "enter", "reset", "add", "remove", "unequip", "equip", "filter", "return", "talk", "eliminate", "clear",
    "wear", "select", "choose", "press", "hold", "use", "you", "your", "you're", "are", "is", "do", "does", "did", "can", "will", "would", "should",
    "please", "no", "yes", "not", "now", "all", "show", "hide", "open", "close", "go", "get", "find", "collect", "defeat", "kill", "deliver", "bring",
    "visit", "speak", "check", "buy", "sell", "learn", "claim", "accept", "decline", "cancel", "confirm", "save", "load", "send", "search", "sort",
    "view", "next", "previous", "back", "continue", "loading", "waiting", "invalid", "unknown", "failed", "success", "welcome", "warning",
})
_NAME_BAD_CHARS = set('.!?;,*"{}[]<>%\n\\/=+#@$^|~`_')


def looks_like_name(text: str) -> bool:
    """
    Palpite se um texto do jogo parece um NOME (item, mob, arma, jutsu...) e nao uma frase/fala/rotulo de tela: curto, poucas
    palavras, comeca com letra maiuscula, sem pontuacao de frase, numeros soltos nem marcadores. E' so' um filtro - a pessoa confere a lista.
    """
    t = text.strip()
    if not 2 <= len(t) <= 45 or not t[0].isalpha() or not t[0].isupper() or t.endswith(":"):
        return False
    if any(ch in _NAME_BAD_CHARS for ch in t) or "\x00" in t or len(t.split()) > 6 or t.split()[0].casefold() in _NOT_NAME_FIRST_WORDS:
        return False
    if " " not in t and re.search(r"[a-z][A-Z]", t):   # identificador interno do jogo (PrisonTimer, ArrowGeninTest), nao um nome
        return False
    return not any(ch.isdigit() for ch in t) or t.count("(") > 0 and sum(ch.isdigit() for ch in t) <= 2


def name_hint(text: str) -> str | None:
    """Palpite do tipo pelo final do nome: 'jutsu' (…Technique / …Jutsu / (NPC)) ou 'recipe' (… Recipe); None = nao sabe."""
    t = text.strip().casefold()
    if t.endswith(("technique", "jutsu", "(npc)")):
        return "jutsu"
    return "recipe" if t.endswith("recipe") else None


async def existing_names(db: AsyncSession) -> set[str]:
    """Nomes (EN e PT, normalizados) de tudo que o wiki ja' tem: conteudo (rascunho ou no ar), jutsus, masteries, vilas, cla's e organizacoes."""
    names: set[str] = set()
    for _, model, _fields in SPECS:
        for en, pt in (await db.execute(select(model.name, model.name_pt))).all():
            for value in (en, pt):
                if value and value.strip():
                    names.add(norm(value))
    return names


@dataclass
class Change:
    """Uma alteracao planejada: em qual registro, qual campo, de que para que."""
    entity: str
    entity_id: str
    label: str
    field: str
    old: str | None
    new: str
    obj: object = field(repr=False, default=None)


@dataclass
class Plan:
    """Resultado do planejamento: alteracoes, contagem por tipo/campo e os registros SEM traducao oficial no nome."""
    changes: list[Change] = field(default_factory=list)
    unmatched: dict[str, list[str]] = field(default_factory=dict)   # tipo -> nomes (EN) sem acerto
    records: dict[str, int] = field(default_factory=dict)           # tipo -> quantos registros existem


def _max_len(model: type, column: str) -> int | None:
    """Tamanho maximo da coluna de texto (None = sem limite)."""
    return getattr(model.__table__.c[column].type, "length", None)


async def plan_import(db: AsyncSession, index: dict[str, str], overwrite: bool = False) -> Plan:
    """Calcula (sem gravar) o que mudaria no banco com este dicionario."""
    plan = Plan()
    for entity, model, fields in SPECS:
        rows = (await db.execute(select(model))).scalars().all()
        plan.records[entity] = len(rows)
        plan.unmatched[entity] = []
        for obj in rows:
            label = str(getattr(obj, "name", ""))
            ident = str(getattr(obj, "id", getattr(obj, "slug", "")))
            if translate_plain(getattr(obj, "name", None), index) is None:
                plan.unmatched[entity].append(label)
            auto = bool(getattr(obj, "translation_auto", False))   # so' o conteudo tem; traducao automatica pode ser trocada sem 'overwrite'
            for en_field, pt_field, kind in fields:
                translate = translate_plain if kind == "plain" else translate_rich
                new = translate(getattr(obj, en_field, None), index)
                if new is None:
                    continue
                limit = _max_len(model, pt_field)
                if limit is not None and len(new) > limit:
                    continue
                current = getattr(obj, pt_field)
                if current == new:
                    continue
                if (current or "").strip() and not overwrite and not auto:
                    continue
                plan.changes.append(Change(entity, ident, label, pt_field, current, new, obj))
            if entity == "jutsu":   # nome em cada nivel: elemento a elemento
                names_en, names_pt = list(obj.name_by_level or []), list(obj.name_by_level_pt or [])
                names_pt += [""] * (len(names_en) - len(names_pt))
                changed = False
                for i, en_name in enumerate(names_en):
                    new = translate_plain(en_name, index)
                    if new and new != names_pt[i] and (overwrite or not (names_pt[i] or "").strip()) and len(new) <= 100:
                        names_pt[i], changed = new, True
                if changed:
                    plan.changes.append(Change(entity, ident, label, "name_by_level_pt", json.dumps(obj.name_by_level_pt or [], ensure_ascii=False),
                                               json.dumps(names_pt, ensure_ascii=False), obj))
    return plan


def apply_plan(plan: Plan) -> int:
    """Grava as alteracoes nos objetos (quem chama faz o commit). No conteudo, tira o selo de 'traducao automatica' se todo o portugues agora e' oficial."""
    touched: dict[int, set[str]] = {}
    for ch in plan.changes:
        value = json.loads(ch.new) if ch.field == "name_by_level_pt" else ch.new
        setattr(ch.obj, ch.field, value)
        touched.setdefault(id(ch.obj), set()).add(ch.field)
    seen: set[int] = set()
    for ch in plan.changes:
        obj = ch.obj
        if id(obj) in seen or not hasattr(obj, "translation_auto"):
            continue
        seen.add(id(obj))
        pt_fields = [pt for _, pt, _ in next(f for e, _, f in SPECS if e == "content")]
        filled = {pt for pt in pt_fields if (getattr(obj, pt) or "").strip()}
        if filled <= touched[id(obj)]:
            obj.translation_auto = False   # todo o portugues preenchido agora veio do jogo
    return len(plan.changes)
