"""
Teste SEM banco da traducao BIDIRECIONAL (EN <-> PT). Uso (pasta NinWiki.Api): `$env:PYTHONPATH="."; py scripts/testar_traducao_reversa.py`
Cobre: dicionario reverso (unico/ambiguo/inexistente/normalizacao), Tiptap PT->EN, decisao de direcao, DeepL simulada e erro amigavel.
"""
import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.core import game_dictionary as gd
from app.core import translation as tr


def doc(texto: str) -> str:
    """Documento Tiptap com um unico paragrafo."""
    return json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": texto}]}]})


async def main() -> None:
    """Roda as verificacoes; qualquer falha levanta AssertionError."""
    # --- dicionario reverso: unico, normalizacao, inexistente
    assert gd.reverse_lookup("Bandagem de Braço") == "Arm Bandage"
    assert gd.reverse_lookup("  bandagem   de braço ") == "arm bandage"          # sem maiuscula no PT -> sem maiuscula no EN
    assert gd.reverse_lookup("Bandagem de Braço.") == "Arm Bandage."
    assert gd.reverse_lookup("frase que nao existe xyzzy") is None and gd.reverse_lookup("") is None and gd.reverse_lookup(None) is None
    # --- ambiguo (2+ EN para o mesmo PT) nao e' usado
    amb = [k for k, v in gd._reverso().items() if v is None]
    assert amb, "esperava ao menos um PT ambiguo no dicionario"
    assert gd.reverse_lookup(amb[0]) is None
    # --- Tiptap PT -> EN mantem a estrutura; texto desconhecido = None (nao mistura idiomas)
    out = json.loads(gd.translate_doc(doc("Bandagem de Braço"), reverso=True))
    assert out["content"][0]["content"][0]["text"] == "Arm Bandage" and out["type"] == "doc"
    assert gd.translate_doc(doc("frase que nao existe xyzzy"), reverso=True) is None
    # --- decisao de direcao: os 4 casos + "PT digitado no campo EN" nunca vira PT->EN
    assert tr.decide_direction("Sword", "") == "en_to_pt"
    assert tr.decide_direction("", "Espada") == "pt_to_en"
    assert tr.decide_direction("Sword", "Espada") is None
    assert tr.decide_direction("", "") is None and tr.decide_direction(None, "  ") is None
    assert tr.decide_direction("Espada de fogo muito forte", "") == "en_to_pt"   # PT no campo EN: nao traduz sozinho para o EN
    assert tr.is_empty(doc("")) and not tr.is_empty(doc("x"))                      # doc do editor sem texto = vazio

    # --- fill_missing_translations com a DeepL simulada
    async def falsa(texts, reverse=False):
        return [("EN:" if reverse else "PT:") + t for t in texts]

    with patch.object(tr, "_deepl_translate_batch", new=falsa):
        o = SimpleNamespace(name="", name_pt="Frase inexistente xyzzy", description="Hello xyzzy", description_pt="")
        await tr.fill_missing_translations(o, [("name", "name_pt"), ("description", "description_pt")], required=("name",))
        assert o.name == "EN:Frase inexistente xyzzy" and o.description_pt == "PT:Hello xyzzy"
        # dicionario inverso vem antes da DeepL
        o = SimpleNamespace(name="", name_pt="Bandagem de Braço")
        await tr.fill_missing_translations(o, [("name", "name_pt")], required=("name",))
        assert o.name == "Arm Bandage"
        # nunca sobrescreve texto escrito a mao (os dois preenchidos)
        o = SimpleNamespace(name="Mine", name_pt="Meu")
        await tr.fill_missing_translations(o, [("name", "name_pt")])
        assert (o.name, o.name_pt) == ("Mine", "Meu")
        # bot (bidirectional=False) nunca faz PT -> EN
        o = SimpleNamespace(name="", name_pt="Espada")
        await tr.fill_missing_translations(o, [("name", "name_pt")], bidirectional=False)
        assert o.name == ""
        # Retraduzir (force): EN escrito refaz o PT; EN vazio gera o EN; nao apaga nada
        o = SimpleNamespace(name="Sword xyzzy", name_pt="Velho", description="", description_pt="Descricao xyzzy")
        await tr.retranslate_fields(o, [("name", "name_pt"), ("description", "description_pt")])
        assert o.name_pt == "PT:Sword xyzzy" and o.description == "EN:Descricao xyzzy"
        # Tiptap PT -> EN via DeepL: so' os textos mudam
        o = SimpleNamespace(d="", d_pt=doc("Texto xyzzy"))
        await tr.fill_missing_translations(o, [("d", "d_pt")])
        assert json.loads(o.d)["content"][0]["content"][0]["text"] == "EN:Texto xyzzy"

    # --- sem DeepL (sem chave/cota): campo opcional fica vazio; obrigatorio vira 422 amigavel; nunca copia o PT
    with patch.object(tr, "_deepl_translate_batch", new=AsyncMock(return_value=None)):
        o = SimpleNamespace(name="", name_pt="Frase inexistente xyzzy", description="", description_pt="Descricao xyzzy")
        await tr.fill_missing_translations(o, [("description", "description_pt")])
        assert o.description == ""
        try:
            await tr.fill_missing_translations(o, [("name", "name_pt")], required=("name",))
            raise AssertionError("deveria ter dado 422")
        except HTTPException as exc:
            assert exc.status_code == 422 and "escreva tambem em ingles" in exc.detail
        assert o.name == ""
    print("OK - traducao reversa")


asyncio.run(main())
