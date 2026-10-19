"""
Importa para cada PROFISSAO do Guia a informacao completa que o jogo tem dela (dados do Nin Atlas), para a pagina da profissao (/profession/[id]).

O QUE GRAVA em `professions.details` (JSON):
  - resources: o que a profissao coleta e o que cai de cada coisa (arvores -> Corte de Madeira; depositos de minerio -> Mineracao; ervas e arbustos -> Forrageamento).
  - recipes:   as receitas de criacao da profissao (Forja): resultado, nivel, ingredientes, se precisa de bancada e qual item ensina a receita.
  - tools:     ferramentas da profissao (Pesca: as varas de pescar, com o nivel de cada uma).
Cada item citado leva o nome, o nome em portugues e o `slug` da pagina dele no wiki (para virar link) quando a pagina existe e esta' PUBLICADA.

So' preenche profissao que AINDA NAO tem detalhes (use --forcar para refazer). O texto da descricao nao e' mexido.
Por padrao e' SIMULACAO; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/importar_profissoes_atlas.py                 # simulacao
    python scripts/importar_profissoes_atlas.py --aplicar       # grava no banco local
"""
import argparse
import asyncio
import sys

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.enums import ContentCategory, ContentStatus
from app.models.guide import Profession
from scripts._guarda_banco import exigir_banco_local
from scripts.sincronizar_imagens_atlas import carregar_atlas

TIPO_DE_RECURSO = {"woodcutting": 1, "mining": 3, "foraging": 2}   # tipo do recurso no Atlas: 1 = arvores, 3 = depositos de minerio, 2 = ervas/arbustos
HABILIDADE_DA_RECEITA = {"forging": "forging"}                      # profissao do wiki -> `skill` das receitas no Atlas
TIPO_DE_FERRAMENTA = {"fishing": "Rod"}                             # profissao do wiki -> tipo de item que e' a ferramenta (vara de pescar)


def montar_detalhes(atlas: dict, paginas: dict[str, ContentItem]) -> dict[str, dict]:
    """{id da profissao: details} a partir dos dados do Atlas; `paginas` = paginas de item/arma do wiki por nome (minusculo)."""

    def ref(item_id) -> dict:
        """Referencia a um item: nome, nome em portugues e slug da pagina (so' se estiver publicada)."""
        item = atlas["items"].get(str(item_id), {})
        nome = item.get("name", f"#{item_id}")
        pagina = paginas.get(nome.lower())
        return {"name": nome, "namePt": pagina.name_pt if pagina is not None and pagina.name_pt else None,
                "slug": pagina.slug if pagina is not None and pagina.status == ContentStatus.PUBLISHED else None}

    detalhes: dict[str, dict] = {}
    for profissao, tipo in TIPO_DE_RECURSO.items():
        recursos = []
        for r in sorted(atlas["resources"].values(), key=lambda x: x["name"]):
            if r.get("type") == tipo and r.get("loot"):
                recursos.append({"name": r["name"], "loot": [{**ref(l[0]), "min": l[1] if len(l) > 1 else 1, "max": l[2] if len(l) > 2 else (l[1] if len(l) > 1 else 1)} for l in r["loot"]]})
        if recursos:
            detalhes.setdefault(profissao, {})["resources"] = recursos
    for profissao, habilidade in HABILIDADE_DA_RECEITA.items():
        receitas = []
        for r in atlas["recipes"].values():
            if r.get("skill") == habilidade:
                receitas.append({"result": ref(r["item"]), "level": r.get("level", 0), "workbench": bool(r.get("workbench")),
                                 "needs": [{**ref(i), "qty": q} for i, q in r.get("needs", [])], "learnedFrom": ref(r["learn"]) if r.get("learn") else None})
        receitas.sort(key=lambda x: (x["level"], x["result"]["name"]))
        if receitas:
            detalhes.setdefault(profissao, {})["recipes"] = receitas
    for profissao, tipo_item in TIPO_DE_FERRAMENTA.items():
        ferramentas = []
        for item_id, item in atlas["items"].items():
            if atlas["itemTypes"].get(str(item["type"])) == tipo_item:
                ferramentas.append({**ref(item_id), "level": item.get("lvl")})
        ferramentas.sort(key=lambda x: (x["level"] or 0, x["name"]))
        if ferramentas:
            detalhes.setdefault(profissao, {})["tools"] = ferramentas
    return detalhes


async def main() -> None:
    """Simula (ou grava com --aplicar) a importacao dos detalhes das profissoes."""
    ap = argparse.ArgumentParser(description="Importa os detalhes de cada profissao (recursos, receitas, ferramentas) do Nin Atlas.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--forcar", action="store_true", help="refaz tambem as profissoes que ja tem detalhes")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        paginas: dict[str, ContentItem] = {}
        for p in (await db.execute(select(ContentItem).where(ContentItem.category.in_([ContentCategory.ITEMS, ContentCategory.WEAPONS])))).scalars().all():
            paginas.setdefault(p.name.lower(), p)
        detalhes = montar_detalhes(atlas, paginas)
        gravadas = 0
        for prof in (await db.execute(select(Profession).order_by(Profession.id))).scalars().all():
            d = detalhes.get(prof.id)
            if not d:
                print(f"  {prof.id:<12} sem dados no Atlas (fica so' com a descricao)")
                continue
            if prof.details and not args.forcar:
                print(f"  {prof.id:<12} ja tem detalhes (nao mexida)")
                continue
            resumo = ", ".join(f"{len(v)} {k}" for k, v in d.items())
            print(f"  {prof.id:<12} {resumo}")
            gravadas += 1
            if args.aplicar:
                prof.details = d
        if args.aplicar:
            await db.commit()
    print(f"\nProfissoes que recebem detalhes: {gravadas}")
    print("Gravado." if args.aplicar else "Simulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
