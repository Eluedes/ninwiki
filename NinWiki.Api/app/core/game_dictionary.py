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

_ARQUIVO = Path(__file__).resolve().parent.parent / "data" / "game_pt.json"
_PONTUACAO_FINAL = ".!:;"


def norm(texto: str) -> str:
    """Forma de comparacao: espacos colapsados e sem diferenciar maiusculas (igual ao script que gera o arquivo)."""
    return " ".join(texto.split()).casefold()


@lru_cache(maxsize=1)
def _dados() -> dict[str, str]:
    """Carrega o dicionario na 1a vez (lazy). Arquivo ausente/quebrado = dicionario vazio (a traducao segue para a DeepL)."""
    try:
        return json.loads(_ARQUIVO.read_text(encoding="utf-8")).get("entries", {})
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


def translate_plain(texto: str | None) -> str | None:
    """Alias legivel: traducao oficial de um texto simples, so' se o texto INTEIRO esta' no dicionario."""
    return lookup(texto)


def _eh_texto(no: dict) -> bool:
    """No' de texto do Tiptap."""
    return no.get("type") == "text" and isinstance(no.get("text"), str)


def _traduzir_no(no: object) -> bool:
    """
    Traduz NO LUGAR (a arvore ja' e' uma copia) cada bloco de texto do Tiptap. Devolve False se algum texto nao estiver no dicionario
    (quem chama joga tudo fora - nada de documento meio traduzido). Tambem cobre o bloco 'ficha' (texto em attrs).
    shortcut: paragrafo com varias marcacoes so' casa se cada trecho OU o paragrafo inteiro estiver no dicionario; no 2o caso a
    marcacao do 1o trecho vale para o paragrafo todo. Melhorar se aparecerem muitos casos.
    """
    if not isinstance(no, dict):
        return True
    if no.get("type") == "ficha":
        attrs = no.get("attrs") or {}
        alvos = [(attrs, "title")] + [(r, k) for r in attrs.get("rows") or [] if isinstance(r, dict) for k in ("label", "value")]
        for dono, chave in alvos:
            if isinstance(dono.get(chave), str) and dono[chave].strip():
                if (pt := lookup(dono[chave])) is None:
                    return False
                dono[chave] = pt
        return True
    filhos = [f for f in no.get("content") or [] if isinstance(f, dict)]
    textos = [f for f in filhos if _eh_texto(f)]
    if textos:   # bloco de texto (paragrafo, titulo, item de lista...)
        if all(not t["text"].strip() for t in textos):
            return True
        traduzidos = [lookup(t["text"]) if t["text"].strip() else t["text"] for t in textos]
        if all(p is not None for p in traduzidos):   # cada trecho casou: marcacoes preservadas 1 a 1
            for t, p in zip(textos, traduzidos):
                t["text"] = p
        else:   # tenta o paragrafo inteiro
            inteiro = lookup("".join(t["text"] for t in textos))
            if inteiro is None:
                return False
            textos[0]["text"] = inteiro
            no["content"] = [f for f in no["content"] if not (isinstance(f, dict) and _eh_texto(f) and f is not textos[0])]
    return all(_traduzir_no(f) for f in filhos if not _eh_texto(f))


def translate_doc(valor: str | None) -> str | None:
    """
    Traducao oficial de um campo rico: JSON do Tiptap -> JSON do Tiptap com a MESMA estrutura/marcacoes; texto simples -> texto.
    So' devolve algo se TODOS os trechos de texto estao no dicionario (senao None: nao mistura idiomas). Documento sem texto = None.
    """
    if not valor or not valor.strip():
        return None
    if not valor.lstrip().startswith("{"):
        return lookup(valor)
    try:
        doc = json.loads(valor)
    except ValueError:
        return lookup(valor)
    if not isinstance(doc, dict) or doc.get("type") != "doc":
        return lookup(valor)
    nova = copy.deepcopy(doc)
    if not _traduzir_no(nova) or nova == doc:
        return None
    return json.dumps(nova, ensure_ascii=False)
