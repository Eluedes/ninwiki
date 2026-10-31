"""
Traducao automatica EN -> PT via API da DeepL, usada pra preencher os
campos "_pt" de content_items (name_pt, description_pt, lore_pt,
synergy_pt, spawn_location_pt - ver app/models/content.py) sem a
equipe precisar escrever tudo duas vezes.

Direcao: o padrao do site e' INGLES (campo sem sufixo), o portugues e' o campo `_pt`. A traducao e' BIDIRECIONAL por par
(campo EN, campo PT): EN preenchido + PT vazio -> EN -> PT; PT preenchido + EN vazio -> PT -> EN (o dono pode escrever so' em
portugues); os dois preenchidos -> nunca mexe (texto escrito a mao jamais e' sobrescrito). Ordem em cada sentido: dicionario OFICIAL do
jogo (app/core/game_dictionary.py; no sentido PT -> EN so' o dicionario inverso sem ambiguidade), depois DeepL, senao fica vazio.
Campo ingles OBRIGATORIO (nome/titulo) que continuar vazio -> erro 422 amigavel (nunca copiamos o portugues pro campo ingles).

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
import time
from typing import Any

import httpx
from fastapi import HTTPException

from app.core import error_log, game_dictionary
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


# Cota da DeepL acabou (HTTP 456): enquanto isto estiver no futuro nem tentamos a DeepL (nao inunda o log de erros
# nem gasta tempo de cada salvamento). Volta a tentar depois de _QUOTA_PAUSA segundos.
_quota_ate = 0.0
_QUOTA_PAUSA = 3600


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
    global _quota_ate
    if not settings.deepl_api_key or not texts or time.monotonic() < _quota_ate:
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
        if status == 456:   # cota do mes acabou: um unico registro agrupado (o error_log soma o contador) e pausa as tentativas
            _quota_ate = time.monotonic() + _QUOTA_PAUSA
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


async def translate_field_source(value: str | None, reverse: bool = False) -> tuple[str | None, bool]:
    """
    Como translate_field, mas diz DE ONDE veio a traducao: (texto, oficial). Ordem: 1) dicionario do jogo (oficial, de graca,
    so' se o texto INTEIRO existe la'; no sentido PT -> EN, pelo dicionario inverso); 2) DeepL (se houver chave e cota); 3) (None, False) = deixa vazio.
    """
    if not value or not value.strip():
        return None, False
    if official := game_dictionary.translate_doc(value, reverso=reverse):   # EN -> PT, ou o inverso (so' se nao ha' ambiguidade)
        return official, True
    if _is_tiptap_json(value):
        return await _translate_tiptap_json(value, reverse=reverse), False
    result = await _deepl_translate_batch([value], reverse=reverse)
    return (None if result is None else result[0]), False


async def translate_field(value: str | None, reverse: bool = False) -> str | None:
    """
    Ponto de entrada usado pelos endpoints - traduz UM campo (texto simples OU Tiptap JSON, detecta sozinho), EN -> PT por padrao:
    primeiro o dicionario oficial do jogo, depois a DeepL. reverse=True inverte pra PT -> EN (so' scripts/
    backfill_mastery_jutsu_english.py usa; ver _deepl_translate_batch).

    Devolve None se o campo original esta' vazio ou nao ha' traducao (sem chave da DeepL, cota acabada, falha): quem chamou deve
    deixar o campo "_pt" como estava (nunca apagar um valor existente por causa de uma falha de traducao).
    """
    return (await translate_field_source(value, reverse=reverse))[0]


def is_empty(value: str | None) -> bool:
    """Vazio de verdade: None, so' espacos, ou documento do editor rico sem nenhum texto (ex.: um paragrafo vazio)."""
    if not value or not value.strip():
        return True
    if _is_tiptap_json(value):
        nodes: list[tuple[dict, str]] = []
        _collect_text_nodes(json.loads(value), nodes)
        return not nodes
    return False


def decide_direction(en: str | None, pt: str | None) -> str | None:
    """
    Decide o que fazer com um par (campo EN, campo PT): "en_to_pt" (PT vazio, EN escrito), "pt_to_en" (EN vazio, PT escrito) ou None
    (os dois escritos, ou os dois vazios = nada a fazer). So' o campo `_pt` preenchido dispara PT -> EN: texto em portugues digitado por
    engano no campo ingles NUNCA e' traduzido sozinho.
    """
    en_vazio, pt_vazio = is_empty(en), is_empty(pt)
    if pt_vazio and not en_vazio:
        return "en_to_pt"
    if en_vazio and not pt_vazio:
        return "pt_to_en"
    return None


async def fill_pair(obj: object, field_en: str, field_pt: str, bidirectional: bool = True) -> tuple[str | None, bool]:
    """
    Preenche o lado VAZIO de um par. Devolve (lado_preenchido, oficial): lado "pt"/"en" ou None se nada foi gravado; oficial=True quando
    veio do dicionario do jogo (nao ganha selo de traducao automatica). bidirectional=False (bot) so' faz EN -> PT.
    """
    direction = decide_direction(getattr(obj, field_en), getattr(obj, field_pt))
    if direction == "en_to_pt":
        translated, official = await translate_field_source(getattr(obj, field_en))
        target = "pt"
    elif direction == "pt_to_en" and bidirectional:
        translated, official = await translate_field_source(getattr(obj, field_pt), reverse=True)
        target = "en"
    else:
        return None, False
    if is_empty(translated):
        return None, False
    setattr(obj, field_pt if target == "pt" else field_en, translated)
    return target, official


def require_english(obj: object, required: tuple[str, ...]) -> None:
    """
    Campos ingleses OBRIGATORIOS (nome/titulo) que continuaram vazios depois da tentativa de traducao: erro 422 claro. Nao inventa e nao
    copia o portugues pro campo ingles ("portugues no campo ingles" e' erro de dados, ver CONTEXTO_PARA_IA regra 5).
    """
    if any(is_empty(getattr(obj, f, None)) for f in required):
        raise HTTPException(status_code=422, detail=MSG_TRADUCAO_OBRIGATORIA)


MSG_TRADUCAO_OBRIGATORIA = (
    "Could not translate the name/title automatically right now; please write it in English too. "
    "(Nao foi possivel traduzir o nome/titulo automaticamente agora; escreva tambem em ingles.)"
)


async def retranslate_fields(obj: object, field_pairs: list[tuple[str, str]], required: tuple[str, ...] = ()) -> None:
    """
    Como fill_missing_translations, mas SOBRESCREVE a traducao existente (botao "Retraduzir" do painel): com o EN escrito refaz o PT; com
    o EN vazio e o PT escrito gera o EN (nunca apaga nada). So' troca o campo quando a traducao realmente veio (sem chave/cota ou com falha,
    o valor atual e' preservado).
    """
    for field_en, field_pt in field_pairs:
        if not is_empty(getattr(obj, field_en)):
            translated = await translate_field(getattr(obj, field_en))
            if translated:
                setattr(obj, field_pt, translated)
        else:
            await fill_pair(obj, field_en, field_pt)
    require_english(obj, required)


async def fill_missing_translations(
    obj: object, field_pairs: list[tuple[str, str]], required: tuple[str, ...] = (), bidirectional: bool = True,
) -> None:
    """
    Versao GENERICA usada pelos endpoints de conteudo. `obj` e' qualquer objeto ORM e `field_pairs` a lista de (campo_en, campo_pt).
    Regra: so' preenche o lado vazio de cada par (EN -> PT ou PT -> EN, ver decide_direction); nunca sobrescreve texto ja' escrito.
    `required` = campos ingleses que nao podem ficar vazios (levanta 422 amigavel). bidirectional=False so' faz EN -> PT (bot).
    """
    for field_en, field_pt in field_pairs:
        await fill_pair(obj, field_en, field_pt, bidirectional)
    require_english(obj, required)
