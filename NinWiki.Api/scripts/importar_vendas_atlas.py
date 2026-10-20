"""
Importa as LOJAS DE NPC do Nin Atlas (https://nin-atlas.vercel.app): em que loja cada item/arma e' vendido, onde a loja fica e quanto custa.

ATENCAO ao que isto e': e' o preco que o JOGADOR PAGA ao NPC (compra). O valor que o NPC paga quando o jogador VENDE um item nao existe no Atlas nem no cliente do jogo.

O QUE FAZ: para cada linha de loja do Atlas `[item, quantidade, item usado como moeda, preco]`, grava em `sold_at` da pagina de item/arma de mesmo nome (sem diferenciar
maiusculas) uma linha por loja: nome da loja, lugares onde ela fica (os mapas/predios onde o NPC esta'), quantas unidades por esse preco, o preco e a moeda
(Ryo, Halloween Token, Sealable Scroll... - o nome do item usado como moeda).
  - So' preenche pagina que AINDA NAO tem lista de vendas; o que voce montou nunca e' trocado.
  - Item sem pagina no wiki e' pulado (e contado no resumo).
Nada e' publicado nem despublicado. Por padrao e' SIMULACAO; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/importar_vendas_atlas.py                 # simulacao
    python scripts/importar_vendas_atlas.py --aplicar       # grava no banco local
"""
import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.enums import ContentCategory
from scripts._guarda_banco import exigir_banco_local
from scripts.sincronizar_imagens_atlas import carregar_atlas


def lugares_das_lojas(atlas: dict) -> dict[str, list[str]]:
    """{id da loja: [nomes dos mapas/predios onde o NPC dessa loja esta']}, sem repetir e na ordem do Atlas."""
    lugares: dict[str, list[str]] = {}
    for grupo in (atlas["maps"], atlas["interiors"]):
        for entrada in grupo.values():
            for ponto in entrada.get("places") or []:
                loja = ponto.get("data")
                if ponto.get("kind") == "shop" and loja is not None and str(loja) in atlas["shops"]:
                    nomes = lugares.setdefault(str(loja), [])
                    if entrada["name"] not in nomes:
                        nomes.append(entrada["name"])
    return lugares


def vendas_por_item(atlas: dict) -> dict[str, list[dict]]:
    """{nome do item (minusculo): [{shop, places, qty, price, currency}]} - uma linha por loja/preco, ordenadas do mais barato ao mais caro."""
    onde = lugares_das_lojas(atlas)
    resultado: dict[str, list[dict]] = {}
    for loja_id, loja in atlas["shops"].items():
        for linha in loja["sells"]:
            item_id, qtd, moeda_id, preco = linha[0], linha[1], linha[2], linha[3]
            item = atlas["items"].get(str(item_id))
            if item is None:
                continue
            moeda = atlas["items"].get(str(moeda_id), {}).get("name", "Ryo")
            venda = {"shop": loja["name"], "places": onde.get(loja_id, [])[:30], "qty": int(qtd or 1), "price": int(preco or 0), "currency": moeda}
            lista = resultado.setdefault(item["name"].lower(), [])
            if not any((v["shop"], v["qty"], v["price"], v["currency"]) == (venda["shop"], venda["qty"], venda["price"], venda["currency"]) for v in lista):
                lista.append(venda)
    for lista in resultado.values():
        lista.sort(key=lambda v: (v["currency"] != "Ryo", v["price"], v["shop"]))
    return resultado


async def main() -> None:
    """Simula (ou grava com --aplicar) a importacao das vendas."""
    ap = argparse.ArgumentParser(description="Importa onde cada item e' vendido por NPCs e o preco (lojas do Nin Atlas).")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    por_item = vendas_por_item(atlas)
    print(f"Atlas: {len(atlas['shops'])} lojas, {len(por_item)} itens diferentes a venda. Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        paginas = (await db.execute(select(ContentItem).where(ContentItem.category.in_([ContentCategory.ITEMS, ContentCategory.WEAPONS])))).scalars().all()
        por_nome = {}
        for p in paginas:
            por_nome.setdefault(p.name.lower(), p)
        preenchidas = ja_tinham = sem_pagina = linhas = 0
        exemplos: list[str] = []
        for nome, vendas in sorted(por_item.items()):
            pagina = por_nome.get(nome)
            if pagina is None:
                sem_pagina += 1
                continue
            if pagina.sold_at:
                ja_tinham += 1
                continue
            preenchidas += 1
            linhas += len(vendas)
            if len(exemplos) < 5:
                v = vendas[0]
                exemplos.append(f"{pagina.name}: {len(vendas)} loja(s), a partir de {v['price']} {v['currency']} em {v['shop']}")
            if args.aplicar:
                pagina.sold_at = vendas
        if args.aplicar:
            await db.commit()

    print(f"\nPaginas que recebem 'Vendido em': {preenchidas} ({linhas} linhas de loja)")
    print(f"Paginas que ja tinham lista (nao mexidas): {ja_tinham} | itens a venda sem pagina no wiki: {sem_pagina}")
    for e in exemplos:
        print("  ", e)
    print("\nGravado." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
