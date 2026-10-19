"""
Importa os LUGARES onde cada monstro aparece (o "Found in" do Nin Atlas) para o campo "Onde encontrar" do wiki.

O QUE FAZ: para cada monstro que luta no Atlas, junta os mapas em que ele esta' (cada mapa do Atlas lista os monstros que moram nele) e grava em `spawn_locations`
da pagina do mob de mesmo nome (sem diferenciar maiusculas): um lugar por linha, com a zona (Safe Zone, Danger Zone, War Zone...). O nome em portugues vem do arquivo oficial
do jogo (Brazilian Portuguese.json, o mesmo do importador de traducoes): `Larva Road` -> `Estrada das Larvas`.
  - So' preenche mob que AINDA NAO tem lista de lugares; lista que voce montou nunca e' trocada.
  - O texto livre antigo (`spawn_location`) nao e' apagado: a ficha usa a lista quando ela existe e o texto quando nao existe.
  - Mob sem pagina no wiki, ou que nao mora em nenhum mapa do Atlas, e' pulado (e contado no resumo).
Nada e' publicado nem despublicado. Por padrao e' SIMULACAO; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/importar_locais_atlas.py                 # simulacao
    python scripts/importar_locais_atlas.py --aplicar       # grava no banco local
Opcoes: --atlas arquivo.js, --traducao "E:\\Nin Online - Wiki\\data files\\locales\\Brazilian Portuguese.json".
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.enums import ContentCategory
from scripts._guarda_banco import exigir_banco_local
from scripts.sincronizar_imagens_atlas import carregar_atlas

TRADUCAO_PADRAO = r"E:\Nin Online - Wiki\data files\locales\Brazilian Portuguese.json"
ZONAS = {"Safe Zone": "safe", "Danger Zone": "danger", "War Zone": "war", "Arena Zone": "arena", "Parkour Zone": "parkour", "No Zone": "none"}


def carregar_traducoes(caminho: str) -> dict[str, str]:
    """{texto em ingles: texto em portugues} do arquivo oficial do jogo (vazio se o arquivo nao existir)."""
    arquivo = Path(caminho)
    if not arquivo.is_file():
        print(f"Aviso: arquivo de traducao nao encontrado ({arquivo}); os nomes ficam so' em ingles.")
        return {}
    return json.loads(arquivo.read_text(encoding="utf-8-sig")).get("Entries", {})


def lugares_por_mob(atlas: dict, pt: dict[str, str]) -> dict[str, list[dict]]:
    """{nome do mob (minusculo): [{name, name_pt, zone}]} juntando os mapas do Atlas em que cada monstro que luta aparece (sem repetir lugar)."""
    ids_por_nome: dict[str, list[str]] = {}
    for npc_id, npc in atlas["npcs"].items():
        if npc.get("fight"):
            ids_por_nome.setdefault(npc["name"].lower(), []).append(npc_id)
    resultado: dict[str, list[dict]] = {}
    for nome, ids in ids_por_nome.items():
        vistos: set[str] = set()
        lugares: list[dict] = []
        for mapa in sorted(atlas["maps"].values(), key=lambda m: m["id"]):
            if any(int(i) in (mapa.get("npcs") or []) for i in ids) and mapa["name"] not in vistos:
                vistos.add(mapa["name"])
                traduzido = pt.get(mapa["name"])
                lugares.append({"name": mapa["name"], "name_pt": traduzido if traduzido and traduzido != mapa["name"] else None,
                                "zone": ZONAS.get(mapa.get("zone", ""), "none")})
        if lugares:
            resultado[nome] = lugares
    return resultado


async def main() -> None:
    """Simula (ou grava com --aplicar) a importacao dos lugares dos monstros."""
    ap = argparse.ArgumentParser(description="Importa os lugares onde cada monstro aparece (Found in do Nin Atlas).")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    ap.add_argument("--traducao", default=TRADUCAO_PADRAO, help="arquivo oficial de traducao em portugues (padrao: %(default)s)")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    por_mob = lugares_por_mob(atlas, carregar_traducoes(args.traducao))
    print(f"Atlas: {len(por_mob)} monstros que lutam aparecem em pelo menos um mapa. Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        mobs = (await db.execute(select(ContentItem).where(ContentItem.category == ContentCategory.MOBS))).scalars().all()
        por_nome = {m.name.lower(): m for m in mobs}
        preenchidos = ja_tinham = sem_pagina = com_pt = total_lugares = 0
        exemplos: list[str] = []
        for nome, lugares in sorted(por_mob.items()):
            mob = por_nome.get(nome)
            if mob is None:
                sem_pagina += 1
                continue
            if mob.spawn_locations:
                ja_tinham += 1
                continue
            preenchidos += 1
            total_lugares += len(lugares)
            com_pt += sum(1 for l in lugares if l["name_pt"])
            if len(exemplos) < 4:
                exemplos.append(f"{mob.name}: " + ", ".join(f"{l['name']} [{l['zone']}]" for l in lugares[:4]) + (" ..." if len(lugares) > 4 else ""))
            if args.aplicar:
                mob.spawn_locations = lugares
        if args.aplicar:
            await db.commit()

    print(f"\nMobs que recebem a lista de lugares: {preenchidos} ({total_lugares} lugares, {com_pt} com nome em portugues)")
    print(f"Mobs que ja tinham lista (nao mexidos): {ja_tinham} | monstros do Atlas sem pagina no wiki: {sem_pagina}")
    for e in exemplos:
        print("  ", e)
    print("\nGravado." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
