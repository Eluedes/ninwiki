"""
Dicionario OFICIAL EN -> PT-BR do proprio jogo (Nin Online), gerado por scripts/extrair_dicionario_jogo.py em app/data/game_pt.json.

E' a PRIMEIRA tentativa de traducao (app/core/translation.py): se o texto em ingles existe no dicionario, o portugues e' o do jogo
(oficial, de graca, sem selo de 'traducao automatica') e a DeepL nem e' chamada. So' acerta texto INTEIRO - nunca traduz pela metade e
nunca mistura idiomas no mesmo texto.

Comparacao tolerante: espacos extras, maiusculas/minusculas e pontuacao final (. ! : ;) nao atrapalham.
O arquivo (~2 MB) so' e' lido na primeira vez que alguem pergunta (lazy); sem o arquivo tudo devolve None e o resto segue como antes.
"""
import copy
import json
from functools import lru_cache
from pathlib import Path

from app.core.text import limpar_marcacao_jogo

_ARQUIVO = Path(__file__).resolve().parent.parent / "data" / "game_pt.json"
_PONTUACAO_FINAL = ".!:;"


def norm(texto: str) -> str:
    """Forma de comparacao: sem marcacao do jogo (<color=..>), espacos colapsados e sem diferenciar maiusculas."""
    return " ".join((limpar_marcacao_jogo(texto) or "").replace("\\n", " ").split()).casefold()


@lru_cache(maxsize=1)
def _dados() -> dict[str, str]:
    """Carrega o dicionario na 1a vez (lazy). Arquivo ausente/quebrado = dicionario vazio (a traducao segue para a DeepL)."""
    try:
        bruto = json.loads(_ARQUIVO.read_text(encoding="utf-8")).get("entries", {})
        # chaves e traducoes do jogo trazem <color=..> (e "\n" literal): entram limpas, para a traducao automatica nao copiar a marcacao para o _pt
        return {norm(en): (limpar_marcacao_jogo(pt) or "").replace("\\n", "\n") for en, pt in bruto.items()}
    except (OSError, ValueError):
        return {}


def lookup(texto: str | None) -> str | None:
    """Traducao oficial de um texto simples (None se o texto inteiro nao esta' no dicionario)."""
    if not texto or not texto.strip():
        return None
    dados = _dados()
    chave = norm(texto)
    achou = dados.get(chave)
    if achou is None and chave[-1] in _PONTUACAO_FINAL:   # "Hello." vs "Hello"
        achou = dados.get(chave.rstrip(_PONTUACAO_FINAL).rstrip())
    if achou is None and chave[-1] not in _PONTUACAO_FINAL:
        achou = next((dados[chave + p] for p in _PONTUACAO_FINAL if chave + p in dados), None)
    return achou


_PALAVRAS_MIUDAS = {"of", "the", "a", "an", "and", "in", "on", "to", "for", "at", "by", "with", "or"}


@lru_cache(maxsize=1)
def _reverso() -> dict[str, str | None]:
    """
    Dicionario INVERSO (PT normalizado, sem pontuacao final -> EN normalizado). Montado na 1a vez (lazy). Se o mesmo PT e' traducao de
    2+ EN diferentes, vira None (ambiguo: nao usamos). As chaves EN do arquivo ja' estao em minusculas (casefold): a caixa e'
    restaurada em _restaurar_caixa.
    """
    reverso: dict[str, str | None] = {}
    for en, pt in _dados().items():
        chave_pt = norm(pt).rstrip(_PONTUACAO_FINAL).rstrip()
        en_limpo = en.rstrip(_PONTUACAO_FINAL).rstrip()
        if not chave_pt or not en_limpo:
            continue
        if chave_pt in reverso and reverso[chave_pt] != en_limpo:
            reverso[chave_pt] = None
        else:
            reverso.setdefault(chave_pt, en_limpo)
    return reverso


def _restaurar_caixa(en: str, pt_original: str) -> str:
    """
    O dicionario guarda o EN em minusculas. Se o PT digitado tem todas as palavras principais com inicial maiuscula (nome proprio/titulo),
    devolve o EN em 'Title Case' (palavras miudas como of/the ficam minusculas); senao so' a 1a letra segue a do PT.
    shortcut: heuristica de caixa (siglas e nomes com maiuscula no meio saem em minuscula); melhorar se reclamarem.
    """
    palavras_pt = [p for p in pt_original.split() if len(p) > 3 and p[0].isalpha()]
    if palavras_pt and all(p[0].isupper() for p in palavras_pt) and len(pt_original.split()) <= 8:
        palavras = en.split(" ")
        return " ".join(w if (i and w in _PALAVRAS_MIUDAS) else w[:1].upper() + w[1:] for i, w in enumerate(palavras))
    return en[:1].upper() + en[1:] if pt_original[:1].isupper() else en


def reverse_lookup(texto: str | None) -> str | None:
    """
    Traducao oficial PT -> EN de um texto simples: so' se o texto INTEIRO e' a traducao oficial de UM unico EN (ambiguo ou ausente = None,
    quem chama segue para a DeepL).
    """
    if not texto or not texto.strip():
        return None
    limpo = norm(texto).rstrip(_PONTUACAO_FINAL).rstrip()
    en = _reverso().get(limpo) if limpo else None
    if not en:
        return None
    base = texto.rstrip()
    sufixo = base[len(base.rstrip(_PONTUACAO_FINAL)):]   # devolve a mesma pontuacao final que a pessoa digitou
    return _restaurar_caixa(en, " ".join(texto.split())) + sufixo


def translate_plain(texto: str | None) -> str | None:
    """Alias legivel: traducao oficial de um texto simples, so' se o texto INTEIRO esta' no dicionario."""
    return lookup(texto)


def _eh_texto(no: dict) -> bool:
    """No' de texto do Tiptap."""
    return no.get("type") == "text" and isinstance(no.get("text"), str)


def _traduzir_no(no: object, busca=None) -> bool:
    """
    Traduz NO LUGAR (a arvore ja' e' uma copia) cada bloco de texto do Tiptap. Devolve False se algum texto nao estiver no dicionario
    (quem chama joga tudo fora - nada de documento meio traduzido). Tambem cobre o bloco 'ficha' (texto em attrs).
    shortcut: paragrafo com varias marcacoes so' casa se cada trecho OU o paragrafo inteiro estiver no dicionario; no 2o caso a
    marcacao do 1o trecho vale para o paragrafo todo. Melhorar se aparecerem muitos casos.
    """
    busca = busca or lookup   # `busca` = funcao de consulta (padrao EN->PT; o dicionario reverso troca por PT->EN)
    if not isinstance(no, dict):
        return True
    if no.get("type") == "ficha":
        attrs = no.get("attrs") or {}
        alvos = [(attrs, "title")] + [(r, k) for r in attrs.get("rows") or [] if isinstance(r, dict) for k in ("label", "value")]
        for dono, chave in alvos:
            if isinstance(dono.get(chave), str) and dono[chave].strip():
                if (pt := busca(dono[chave])) is None:
                    return False
                dono[chave] = pt
        return True
    filhos = [f for f in no.get("content") or [] if isinstance(f, dict)]
    textos = [f for f in filhos if _eh_texto(f)]
    if textos:   # bloco de texto (paragrafo, titulo, item de lista...)
        if all(not t["text"].strip() for t in textos):
            return True
        traduzidos = [busca(t["text"]) if t["text"].strip() else t["text"] for t in textos]
        if all(p is not None for p in traduzidos):   # cada trecho casou: marcacoes preservadas 1 a 1
            for t, p in zip(textos, traduzidos):
                t["text"] = p
        else:   # tenta o paragrafo inteiro
            inteiro = busca("".join(t["text"] for t in textos))
            if inteiro is None:
                return False
            textos[0]["text"] = inteiro
            no["content"] = [f for f in no["content"] if not (isinstance(f, dict) and _eh_texto(f) and f is not textos[0])]
    return all(_traduzir_no(f, busca) for f in filhos if not _eh_texto(f))


def translate_doc(valor: str | None, reverso: bool = False) -> str | None:
    """
    Traducao oficial de um campo rico: JSON do Tiptap -> JSON do Tiptap com a MESMA estrutura/marcacoes; texto simples -> texto.
    So' devolve algo se TODOS os trechos de texto estao no dicionario (senao None: nao mistura idiomas). Documento sem texto = None.
    """
    busca = reverse_lookup if reverso else lookup   # reverso=True: PT -> EN (ver reverse_lookup)
    if not valor or not valor.strip():
        return None
    if not valor.lstrip().startswith("{"):
        return busca(valor)
    try:
        doc = json.loads(valor)
    except ValueError:
        return busca(valor)
    if not isinstance(doc, dict) or doc.get("type") != "doc":
        return busca(valor)
    nova = copy.deepcopy(doc)
    if not _traduzir_no(nova, busca) or nova == doc:
        return None
    return json.dumps(nova, ensure_ascii=False)
