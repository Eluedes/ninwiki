"""
Importa os ITENS do Nin Atlas (https://nin-atlas.vercel.app) para o wiki, como RASCUNHO, ligando a imagem do banco de imagens (`N_item`) e os drops soltos dos mobs.

O QUE FAZ, por item do Atlas (a imagem vem do ICONE do cliente que o item usa: o ID do item no Atlas NAO e' o numero do icone; a ligacao e' feita comparando as
imagens, ver scripts/atlas_icones.py; no banco de imagens o icone e' a imagem `N_item`):
  - Se o wiki JA tem um item/arma com esse nome (sem diferenciar maiusculas): so' PREENCHE o que esta' vazio (tipo, nivel, descricao, imagem, stack e,
    nas armas, dano base e requisito de Strength). Raridade so' muda em RASCUNHO que ainda esta' em Common. O que ja tem valor NUNCA e' trocado.
  - Se NAO tem: cria em RASCUNHO, em ingles (o portugues vem pelo importador de traducoes oficiais, /admin/translations).
  - Arma do Atlas vira categoria Weapons (so' em rascunho); o resto fica em Items com o tipo certo (Shirt, Hat, Ring, Consumable, Cast, Currency, Pack, Authority...).
    Tudo que nao tem tipo proprio (Manual, Recipe, Furniture, Rod, Key...) fica `general`.
  - Descricao: o texto do Atlas, trocando {damage}/{itemDamage}/{strengthReq} pelos numeros.
  - Nomes repetidos no Atlas (variantes do mesmo item) viram UMA pagina (a primeira).
  - Depois liga os drops dos mobs que ainda estavam soltos (so' o nome) ao item de mesmo nome (e copia a raridade dele).
NAO importa (fica para voce): bonus de atributo (+Fortitude etc.), vida/chakra/critico, requisitos que nao sao Strength, receitas e lojas.

NADA e' publicado, a menos que use --publicar (publica so' as paginas que o Atlas cobre, nunca os outros rascunhos). Por padrao e' SIMULACAO; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).
Rode ANTES o `sincronizar_imagens_atlas.py` (para existir a imagem de cada item).
--corrigir-imagens: troca a imagem das paginas que foram ligadas pelo ID do Atlas (erro das primeiras versoes deste script) pela imagem do icone certo; imagem que
voce colocou na mao NUNCA e' trocada (so' a que for exatamente a ligada errada).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/importar_itens_atlas.py                 # simulacao
    python scripts/importar_itens_atlas.py --aplicar       # grava no banco local
    python scripts/importar_itens_atlas.py --aplicar --permitir-remoto
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app.api.content_items import _DEFAULT_ICON_BY_CATEGORY
from app.core.slug import slugify as _slugify
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.api.uploads import UPLOAD_DIR
from app.core.media_refs import media_url
from app.models.content import ContentItem, ContentItemDrop
from app.models.enums import ContentCategory, ContentStatus, ItemType, Rarity
from app.models.media import MediaImage
from scripts._guarda_banco import exigir_banco_local
from scripts.importar_mobs_atlas import RARIDADE_ATLAS
from scripts.atlas_icones import CLIENTE_PADRAO, arquivo_do_icone, identificar_imagens, mapa_icones
from scripts.sincronizar_imagens_atlas import carregar_atlas

# Tipo do Atlas -> tipo do item no wiki. O que nao esta' aqui vira `general`. (Weapon vira categoria Weapons, sem item_type.)
TIPO_ITEM = {
    "Shirt": ItemType.SHIRT, "Vest": ItemType.VEST, "Pants": ItemType.PANT, "Hat": ItemType.HAT, "Mask": ItemType.MASK, "Shoes": ItemType.SHOE,
    "Accessory": ItemType.ACCESSORY, "Ring": ItemType.RING, "Consumable": ItemType.CONSUMABLE, "Cast": ItemType.CAST,
    "Currency": ItemType.CURRENCY, "Pack": ItemType.PACK, "Authority": ItemType.AUTHORITY,
}
COM_STACK = {"Currency", "Authority", "Consumable", "Pack"}   # tipos em que o wiki mostra "Can hold max N per Stack"
STRENGTH_ID = 1   # no Atlas o requisito [[1, N]] e' Strength (os outros ids nao estao documentados: ficam de fora)


def texto_do_doc(valor: str | None) -> str:
    """Texto puro de um campo rico (JSON do Tiptap) ou de um texto simples. '' se so' tiver espacos."""
    if not valor or not valor.strip():
        return ""
    try:
        doc = json.loads(valor)
    except ValueError:
        return valor.strip()
    partes: list[str] = []

    def andar(no) -> None:
        if isinstance(no, dict):
            if isinstance(no.get("text"), str):
                partes.append(no["text"])
            for filho in no.get("content") or []:
                andar(filho)
    andar(doc)
    return "".join(partes).strip()


def doc_simples(texto: str) -> str:
    """Campo rico com um paragrafo so' (o mesmo formato que o editor do painel grava)."""
    return json.dumps({"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": texto}]}]}, ensure_ascii=False)


def descricao(item: dict) -> str:
    """Texto do Atlas com os marcadores trocados pelos numeros (dano e Strength)."""
    texto = item.get("desc") or ""
    dano = item.get("dmg")
    if dano is not None:
        texto = texto.replace("{damage}", str(dano)).replace("{itemDamage}", str(dano))
    for estat, valor in item.get("req") or []:
        if estat == STRENGTH_ID:
            texto = texto.replace("{strengthReq}", str(valor))
    return texto


async def main() -> None:
    """Simula (ou grava com --aplicar) a importacao dos itens do Atlas."""
    ap = argparse.ArgumentParser(description="Importa os itens do Nin Atlas como rascunho.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--publicar", action="store_true", help="publica (status published) as paginas de item/arma que o Atlas cobre")
    ap.add_argument("--corrigir-imagens", action="store_true", help="troca as imagens ligadas pelo ID do Atlas (erradas) pela do icone certo")
    ap.add_argument("--cliente", default=CLIENTE_PADRAO, help="pasta graphics/items do cliente do jogo (padrao: %(default)s)")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    mapa = mapa_icones(atlas, Path(args.cliente))   # id do item no Atlas -> icone(s) do cliente
    print(f"Atlas: {len(atlas['items'])} itens. Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        todos = (await db.execute(select(ContentItem))).scalars().all()
        paginas = {c.name.lower(): c for c in todos if c.category in (ContentCategory.ITEMS, ContentCategory.WEAPONS)}
        slugs = {c.slug for c in todos}
        todas_imagens = (await db.execute(select(MediaImage))).scalars().all()
        # imagem de cada icone, reconhecida pelo CONTEUDO (funciona mesmo se voce renomeou a imagem, ex.: "Sukarabe Omo Fan")
        imagem_do_icone = arquivo_do_icone(todas_imagens, identificar_imagens(todas_imagens, UPLOAD_DIR, Path(args.cliente)))

        vistos: set[str] = set()
        novos = atualizados = campos = armas_movidas = sem_imagem = repetidos = publicados = 0
        por_campo: dict[str, int] = {}

        def preencher(alvo: ContentItem, campo: str, valor) -> None:
            """Poe `valor` em `campo` (e conta). So' e' chamado quando o campo esta' vazio."""
            nonlocal campos
            campos += 1
            por_campo[campo] = por_campo.get(campo, 0) + 1
            if args.aplicar:
                setattr(alvo, campo, valor)

        for item_id, it in sorted(atlas["items"].items(), key=lambda kv: int(kv[0])):
            chave = it["name"].lower()
            if chave in vistos:
                repetidos += 1
                continue
            vistos.add(chave)
            tipo = atlas["itemTypes"].get(str(it["type"]), "")
            eh_arma = tipo == "Weapon"
            categoria = ContentCategory.WEAPONS if eh_arma else ContentCategory.ITEMS
            item_type = None if eh_arma else TIPO_ITEM.get(tipo, ItemType.GENERAL)
            raridade = RARIDADE_ATLAS.get(str(it.get("rarity")), Rarity.COMMON)
            texto = descricao(it)
            icone = mapa[item_id][0] if item_id in mapa else None
            arq = imagem_do_icone.get(icone) if icone else None
            arq_errado = imagem_do_icone.get(item_id)   # o que as primeiras versoes ligavam (ID do Atlas usado como numero de icone)
            url = media_url(arq) if arq else None
            if url is None:
                sem_imagem += 1
            req_forca = next((v for e, v in (it.get("req") or []) if e == STRENGTH_ID), None)
            stack = int(it["stack"]) if it.get("stack") and tipo in COM_STACK else None

            alvo = paginas.get(chave)
            if alvo is None:
                novos += 1
                slug = _slugify(it["name"]) or f"item-{item_id}"
                base, k = slug, 2
                while slug in slugs:
                    slug, k = f"{base}-{k}", k + 1
                slugs.add(slug)
                if args.aplicar:
                    db.add(ContentItem(slug=slug, category=categoria, name=it["name"], icon=_DEFAULT_ICON_BY_CATEGORY.get(categoria.value, "❔"),
                                       rarity=raridade, description=doc_simples(texto) if texto else "",
                                       status=ContentStatus.PUBLISHED if args.publicar else ContentStatus.DRAFT,
                                       item_type=item_type, level=it.get("lvl") or 0, image=url, max_stack=stack,
                                       weapon_base_damage=str(it["dmg"]) if eh_arma and it.get("dmg") is not None else None,
                                       weapon_requirement=f"{req_forca} Strength" if eh_arma and req_forca is not None else None))
                continue

            atualizados += 1
            rascunho = alvo.status == ContentStatus.DRAFT
            if eh_arma and rascunho and alvo.category == ContentCategory.ITEMS:
                armas_movidas += 1
                if args.aplicar:
                    alvo.category = ContentCategory.WEAPONS
                    alvo.item_type = None
            if rascunho and alvo.rarity == Rarity.COMMON and raridade != Rarity.COMMON:
                preencher(alvo, "rarity", raridade)
            if not eh_arma and alvo.item_type is None:
                preencher(alvo, "item_type", item_type)
            if it.get("lvl") and not alvo.level:
                preencher(alvo, "level", it["lvl"])
            if texto and not texto_do_doc(alvo.description):
                preencher(alvo, "description", doc_simples(texto))
            if args.corrigir_imagens and alvo.image and arq_errado and alvo.image == media_url(arq_errado) and arq_errado != arq:
                preencher(alvo, "image", url)   # ligada errada: troca pela certa (ou limpa, se o icone certo ainda nao esta' no banco)
            elif url and not alvo.image:
                preencher(alvo, "image", url)
            if stack and alvo.max_stack is None:
                preencher(alvo, "max_stack", stack)
            if eh_arma and it.get("dmg") is not None and not alvo.weapon_base_damage:
                preencher(alvo, "weapon_base_damage", str(it["dmg"]))
            if eh_arma and req_forca is not None and not alvo.weapon_requirement:
                preencher(alvo, "weapon_requirement", f"{req_forca} Strength")
            if args.publicar and alvo.status != ContentStatus.PUBLISHED:
                publicados += 1
                if args.aplicar:
                    alvo.status = ContentStatus.PUBLISHED

        if args.aplicar:
            await db.flush()

        # liga os drops dos mobs que ainda estavam so' com o nome
        por_nome = {c.name.lower(): c for c in (await db.execute(select(ContentItem).where(ContentItem.category.in_([ContentCategory.ITEMS, ContentCategory.WEAPONS])))).scalars().all()}
        soltos = (await db.execute(select(ContentItemDrop).where(ContentItemDrop.dropped_item_id.is_(None)))).scalars().all()
        ligados = 0
        for drop in soltos:
            alvo = por_nome.get(drop.item_name.lower())
            if alvo is not None:
                ligados += 1
                if args.aplicar:
                    drop.dropped_item_id = alvo.id
                    drop.rarity = alvo.rarity
        if args.aplicar:
            await db.commit()

    print(f"\nItens novos (rascunho): {novos}")
    print(f"Itens que o wiki ja tinha, com campos vazios preenchidos: {atualizados} ({campos} campos)")
    print("  por campo:", ", ".join(f"{k}={v}" for k, v in sorted(por_campo.items(), key=lambda kv: -kv[1])))
    print(f"Publicados agora: {publicados} existentes + {novos if args.publicar else 0} novos")
    print(f"Armas que passaram de Items para Weapons (so' rascunhos): {armas_movidas}")
    print(f"Nomes repetidos no Atlas (variantes) juntados: {repetidos} | itens sem imagem no banco: {sem_imagem}")
    print(f"Drops de mobs que estavam soltos e agora ligam a um item: {ligados} de {len(soltos)}")
    print("\nGravado." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
