"""
Teste SEM banco do dicionario do jogo (app/core/game_dictionary.py). Uso (pasta NinWiki.Api): `$env:PYTHONPATH="."; py scripts/testar_dicionario_jogo.py`
"""
import json

from app.core import game_dictionary as gd

ING, PT = "Arm Bandage", "Bandagem de Braço"


def doc(*paragrafos: list[dict]) -> str:
    """Monta um documento Tiptap com os paragrafos dados (cada um e' uma lista de nos de texto)."""
    return json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": p} for p in paragrafos]})


def main() -> None:
    """Roda as verificacoes; qualquer falha levanta AssertionError."""
    assert len(gd._dados()) > 10000, "dicionario nao carregou"
    # texto simples + normalizacao (espacos, maiusculas, ponto final)
    assert gd.translate_plain(ING) == PT
    assert gd.translate_plain("  arm   BANDAGE ") == PT
    assert gd.translate_plain(ING + ".") == PT
    assert gd.translate_plain("Esta frase nao existe no jogo xyzzy") is None
    assert gd.translate_plain("") is None and gd.translate_plain(None) is None
    # doc: todos os paragrafos casam -> traduz, mantendo estrutura e marcacao
    d = doc([{"type": "text", "text": ING, "marks": [{"type": "bold"}]}], [{"type": "text", "text": "Agility Bandages"}])
    out = json.loads(gd.translate_doc(d))
    assert out["content"][0]["content"][0] == {"type": "text", "text": PT, "marks": [{"type": "bold"}]}
    assert out["content"][1]["content"][0]["text"] == "Bandagens de Agilidade"
    assert [n["type"] for n in out["content"]] == ["paragraph", "paragraph"]
    # doc parcial: um paragrafo fora do dicionario -> None (nao mistura idiomas)
    assert gd.translate_doc(doc([{"type": "text", "text": ING}], [{"type": "text", "text": "xyzzy plugh nao existe"}])) is None
    # texto simples passado a translate_doc, e JSON que nao e' doc
    assert gd.translate_doc(ING) == PT
    assert gd.translate_doc('{"a": 1}') is None
    assert gd.translate_doc(None) is None and gd.translate_doc("   ") is None
    # entrada nao e' alterada (a arvore e' copiada)
    original = doc([{"type": "text", "text": ING}])
    gd.translate_doc(original)
    assert json.loads(original)["content"][0]["content"][0]["text"] == ING
    print("OK - dicionario do jogo: todos os testes passaram.")


if __name__ == "__main__":
    main()
