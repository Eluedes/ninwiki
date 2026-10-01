"""
Traducao automatica EN -> PT via API da DeepL, usada pra preencher os
campos "_pt" de content_items (name_pt, description_pt, lore_pt,
synergy_pt, spawn_location_pt - ver app/models/content.py) sem a
equipe precisar escrever tudo duas vezes.

Direcao EN -> PT (nao PT -> EN): decisao final do Rafael (25/09) - o
padrao do site e do painel e' INGLES, entao todo conteudo nasce em
ingles (e' a lingua "principal" de escrita), e a DeepL preenche a
versao em portugues automaticamente por cima.

DESIGN - POR QUE SEM CHAVE NAO QUEBRA NADA: deepl_api_key vazio (o
padrao) faz toda funcao aqui devolver None/o valor original sem
chamar a API - a aplicacao inteira continua funcionando normal, so'
sem traduzir automaticamente, ate' alguem configurar a chave.

DESIGN - PRESERVANDO FORMATACAO DO TIPTAP: description/lore/synergy
sao guardados como JSON do editor rico (ver
app/schemas/validators.py::validate_rich_content), nao texto puro.
Mandar o JSON inteiro pra DeepL traduziria tambem as CHAVES/ESTRUTURA
("type", "doc", "paragraph"...), quebrando o documento. Em vez disso:
percorremos a arvore, juntamos SO' os nos de texto (node["text"]) numa
lista, mandamos a lista inteira numa UNICA chamada (a API da DeepL
aceita varios textos por requisicao), e recolocamos cada traducao de
volta EXATAMENTE na mesma posicao da arvore - a estrutura (negrito,
cor, alinhamento, paragrafos) nunca e' tocada, so' o texto dentro dela.
"""
import json
from typing import Any

import httpx

from app.core import error_log
from app.core.config import settings

# Endpoint muda entre plano gratuito e pago da DeepL - free sempre
# comeca com "api-free.", nunca "api.". A chave gratuita tem esse
# sufixo ":fx" no final, que usamos aqui pra decidir qual URL bater
# automaticamente, sem precisar de uma configuracao a mais no .env.
_DEEPL_URL = (
    "https://api-free.deepl.com/v2/translate"
    if settings.deepl_api_key.endswith(":fx")
    else "https://api.deepl.com/v2/translate"
)


async def _deepl_translate_batch(texts: list[str], reverse: bool = False) -> list[str] | None:
    """
    Traduz uma LISTA de textos numa unica chamada a' API - sempre em
    lote (nunca um texto por vez) pra nao gastar uma requisicao HTTP
    inteira so' pra' traduzir, por exemplo, os 8 nos de texto de uma
    description com varios paragrafos.

    reverse=True inverte a direcao padrao (EN->PT) pra PT->EN - usado
    SO' por scripts/backfill_mastery_jutsu_english.py (ver esse
    arquivo pro motivo completo: Masteries/Jutsus ja' tinham conteudo
    escrito em portugues ANTES da decisao de "site em ingles por
    padrao" existir, e precisam de uma traducao pontual na direcao
    contraria pra' alcancar o mesmo estado que content_items ja' tem).
    O fluxo normal do dia a dia (criar/editar uma entry) NUNCA usa
    reverse=True - so' sempre EN->PT.

    Devolve None (em vez de lancar excecao) se a chave nao estiver
    configurada OU se a API falhar por qualquer motivo - traducao
    automatica e' um "extra", nunca deve derrubar a criacao/edicao de
    uma entry so' porque a DeepL esta' fora do ar.
    """
    if not settings.deepl_api_key or not texts:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                _DEEPL_URL,
                headers={"Authorization": f"DeepL-Auth-Key {settings.deepl_api_key}"},
                data={
                    "text": texts,
                    "source_lang": "PT" if reverse else "EN",
                    "target_lang": "EN-US" if reverse else "PT-BR",
                    # preserve_formatting: evita que a DeepL "corrija"
                    # quebra de linha/espacamento do texto original -
                    # importante porque cada item da lista e' so' um
                    # fragmento de uma arvore maior, nao uma frase
                    # completa e independente.
                    "preserve_formatting": "1",
                },
            )
            response.raise_for_status()
            data = response.json()
            return [t["text"] for t in data["translations"]]
    except (httpx.HTTPError, KeyError, json.JSONDecodeError) as exc:
        # A traducao e' um "extra" e nunca derruba a criacao/edicao - mas a equipe PRECISA saber que ela parou
        # (chave recusada, cota do plano gratuito acabada...): registra em /admin/errors e no canal do bot.
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        title = {
            456: "DeepL quota exceeded", 403: "DeepL key rejected", 429: "DeepL rate limited",
        }.get(status or 0, "DeepL request failed")
        await error_log.record(
            source="deepl", level="warning", title=title,
            message=f"{type(exc).__name__}{f' (HTTP {status})' if status else ''}: {exc}",
            status=status,
        )
        return None


def _is_tiptap_json(value: str) -> bool:
    """Mesma logica de app/schemas/validators.py::validate_rich_content, so' checando (nao validando)."""
    stripped = value.strip()
    if not stripped.startswith("{"):
        return False
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        return False
    return isinstance(parsed, dict) and parsed.get("type") == "doc"


def _collect_text_nodes(node: Any, out: list[tuple[dict, str]]) -> None:
    """
    Percorre a arvore do Tiptap recursivamente, juntando em `out` cada
    par (dicionario, chave) que aponta pra' um texto traduzivel -
    guardamos o DICIONARIO (nao uma copia do texto) porque depois
    vamos MODIFICAR container[chave] direto no lugar, e' assim que a
    traducao volta pra posicao certa na arvore sem reconstruir a
    estrutura do zero.

    Dois casos:
    - No' de texto normal (paragrafo, titulo...): a chave e' sempre
      "text", dentro do proprio no'.
    - No' tipo "ficha" (ver lib/tiptap-extensions/ficha.ts, 26/09): o
      texto fica em `attrs`, nao em `content` - titulo e' uma chave
      unica ("title"), e cada linha do array `attrs.rows` tem DUAS
      chaves traduziveis ("label" e "value"). Sem esse caso especial,
      o texto de dentro de uma Ficha nunca seria alcancado por este
      walker (ele so' desce por `content`, e Ficha e' `atom: true` -
      nao tem `content` nenhum).
    """
    if not isinstance(node, dict):
        return
    if node.get("type") == "ficha":
        attrs = node.get("attrs") or {}
        if isinstance(attrs.get("title"), str) and attrs["title"].strip():
            out.append((attrs, "title"))
        for row in attrs.get("rows") or []:
            if isinstance(row, dict):
                if isinstance(row.get("label"), str) and row["label"].strip():
                    out.append((row, "label"))
                if isinstance(row.get("value"), str) and row["value"].strip():
                    out.append((row, "value"))
        return  # atom: true - nunca tem content pra descer
    if "text" in node and isinstance(node["text"], str) and node["text"].strip():
        out.append((node, "text"))
    for child in node.get("content", []) or []:
        _collect_text_nodes(child, out)


async def _translate_tiptap_json(value: str, reverse: bool = False) -> str | None:
    """Traduz so' os nos de texto (e o conteudo de blocos de Ficha) de um documento Tiptap, mantendo a estrutura/formatacao intacta."""
    doc = json.loads(value)
    text_nodes: list[tuple[dict, str]] = []
    _collect_text_nodes(doc, text_nodes)
    if not text_nodes:
        return value  # documento sem texto nenhum (ex: so' uma imagem) - nada pra traduzir

    translations = await _deepl_translate_batch([container[key] for container, key in text_nodes], reverse=reverse)
    if translations is None:
        return None

    for (container, key), translated in zip(text_nodes, translations):
        container[key] = translated
    return json.dumps(doc, ensure_ascii=False)


async def translate_field(value: str | None, reverse: bool = False) -> str | None:
    """
    Ponto de entrada usado pelos endpoints - traduz UM campo (texto
    simples OU Tiptap JSON, detecta sozinho qual e'), EN -> PT por
    padrao. reverse=True inverte pra PT -> EN - ver o comentario
    completo em _deepl_translate_batch (so' scripts/
    backfill_mastery_jutsu_english.py usa isso, nunca o fluxo normal
    de criar/editar).

    Devolve None se: o campo original esta' vazio, a chave da DeepL
    nao esta' configurada, ou a traducao falhou por qualquer motivo -
    nos TRES casos, quem chamou deve simplesmente deixar o campo "_pt"
    como estava (nunca apagar um valor existente por causa de uma
    falha de traducao).
    """
    if not value or not value.strip():
        return None
    if _is_tiptap_json(value):
        return await _translate_tiptap_json(value, reverse=reverse)
    return None if (result := await _deepl_translate_batch([value], reverse=reverse)) is None else result[0]


async def retranslate_fields(obj: object, field_pairs: list[tuple[str, str]]) -> None:
    """
    Como fill_missing_translations, mas SOBRESCREVE a traducao existente (botao "Retraduzir" do painel):
    util quando o texto em ingles mudou e a versao em portugues ficou velha. So' troca o campo `_pt`
    quando a DeepL realmente devolveu algo (sem chave ou com falha, o valor atual e' preservado).
    """
    for field_en, field_pt in field_pairs:
        translated = await translate_field(getattr(obj, field_en))
        if translated:
            setattr(obj, field_pt, translated)


async def fill_missing_translations(obj: object, field_pairs: list[tuple[str, str]]) -> None:
    """
    Versao GENERICA de _fill_missing_translations (que existia so' em
    app/api/content_items.py) - reaproveitada por Masteries/Jutsus
    (app/api/masteries.py) pra' nao duplicar a mesma logica em cada
    arquivo de rota que precisar de traducao automatica.

    `obj` e' qualquer objeto ORM (ContentItem, Mastery, Jutsu...) e
    `field_pairs` e' a lista de (campo_en, campo_pt) desse objeto -
    ver app/api/content_items.py::_TRANSLATABLE_FIELDS pro formato
    exato. Mesma regra de sempre: so' preenche o que estiver vazio,
    nunca sobrescreve uma traducao ja existente (automatica ou
    corrigida a mao).
    """
    for field_en, field_pt in field_pairs:
        if getattr(obj, field_pt):
            continue
        translated = await translate_field(getattr(obj, field_en))
        if translated:
            setattr(obj, field_pt, translated)
