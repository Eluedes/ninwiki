"""
Script de seed: le NinWiki.Api/seed_data.json (gerado a partir do
codigo real do front - ver NinWiki.Web/scripts/export-seed-data.ts) e
popula as tabelas do banco com esse conteudo.

Como gerar o seed_data.json de novo (sempre que o conteudo do front mudar):
    cd NinWiki.Web
    npx tsx scripts/export-seed-data.ts

Como rodar este seed:
    cd NinWiki.Api
    python -m app.seed

O script e' seguro de rodar mais de uma vez: ele APAGA o conteudo
"de catalogo" das tabelas (nao mexe em users/audit_log/posts, que sao
dados reais de uso, nao mock) antes de inserir de novo - assim nunca
duplica linha.
"""
import asyncio
import json
from pathlib import Path

from sqlalchemy import delete

from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem, ContentItemAttribute, ContentItemDrop
from app.models.enums import ContentCategory, ItemType, MasteryType, MobType, ProfessionGroup, Rarity
from app.models.guide import NinjaRank, Profession, StoryArc, Summon
from app.models.masteries import Attribute, Jutsu, Mastery, MasteryAttribute, MasteryPath, MasteryPathAttribute
from app.models.villages import Clan, Organization, OrganizationVillage, Village

SEED_FILE = Path(__file__).resolve().parent.parent / "seed_data.json"


async def clear_catalog_tables(session):
    """
    Apaga so' o conteudo de CATALOGO (o que este seed recria), na ordem
    certa pra nao violar foreign key (tabelas filhas antes das pais).
    NAO mexe em users/audit_log/posts - esses sao dados de uso real,
    nao mock, e o seed nao tem nada a ver com eles.
    """
    for model in [
        ContentItemDrop,
        ContentItemAttribute,
        ContentItem,
        Jutsu,
        MasteryAttribute,
        MasteryPathAttribute,
        MasteryPath,
        Mastery,
        Attribute,
        OrganizationVillage,
        Clan,
        Organization,
        Village,
        Profession,
        NinjaRank,
        StoryArc,
        Summon,
    ]:
        await session.execute(delete(model))


async def seed_attributes(session, data: list[dict]) -> None:
    """Insere os atributos (Strength, Agility...)."""
    for a in data:
        # name/englishName no JSON (nomes historicos, nunca mudam - o
        # export ainda usa o par antigo) mapeiam AO CONTRARIO pro
        # banco agora: englishName vira name (campo principal em
        # ingles), name (portugues no JSON) vira name_pt.
        session.add(Attribute(id=a["id"], name=a["englishName"], name_pt=a["name"],
                               description=a["description"], icon=a["icon"]))


async def seed_masteries(session, data: list[dict]) -> None:
    """Insere as masteries e seus caminhos."""
    # Duas passadas, com um flush entre elas: a primeira grava
    # Mastery e MasteryPath (as "tabelas pai"); so' depois disso o
    # Postgres tem as linhas que as associacoes N:N (MasteryAttribute,
    # MasteryPathAttribute) precisam referenciar. Sem o flush, o
    # SQLAlchemy pode tentar inserir a associacao antes da linha pai
    # existir de verdade no banco, e' o mesmo padrao usado em
    # seed_organizations() mais abaixo.
    for m in data:
        session.add(Mastery(
            id=m["id"], name=m["englishName"], name_pt=m["name"],
            type=MasteryType(m["type"]), element=m["element"],
            description=m["description"], long_description=m["longDescription"],
            icon=m["icon"], color=m["color"], image=m.get("image"),
        ))
        for p in m.get("paths", []):
            session.add(MasteryPath(
                id=p["id"], mastery_id=m["id"], label=p["label"],
                description=p["description"], requirement=p.get("requirement"),
            ))
    await session.flush()

    for m in data:
        for attr_id in m.get("attributes", []):
            session.add(MasteryAttribute(mastery_id=m["id"], attribute_id=attr_id))
        for p in m.get("paths", []):
            for attr_id in p.get("attributes", []):
                session.add(MasteryPathAttribute(path_id=p["id"], attribute_id=attr_id))


async def seed_jutsus(session, data: list[dict]) -> None:
    """Insere os jutsus."""
    for j in data:
        session.add(Jutsu(
            id=j["id"], name=j["englishName"], name_pt=j["name"],
            mastery_id=j["masteryId"], path_id=j.get("pathId"),
            tier=j["tier"], chakra_cost=j["chakraCost"],
            description=j["description"], long_description=j["longDescription"],
            effect=j["effect"], range=j["range"], cast_time=j["castTime"],
            cooldown=j["cooldown"], icon=j["icon"], gif=j.get("gif"),
        ))


async def seed_villages(session, data: list[dict]) -> None:
    """Insere as vilas."""
    for v in data:
        session.add(Village(
            id=v["id"], name=v["englishName"], name_pt=v["name"],
            element=v["element"], motto=v["motto"], description=v["description"],
            long_description=v["longDescription"], emblem=v["emblem"], image=v.get("image"),
            accent_color=v["accentColor"], climate=v["climate"], leader=v["leader"],
        ))


async def seed_clans(session, data: list[dict]) -> None:
    """Insere os cla's das vilas."""
    for c in data:
        session.add(Clan(
            id=c["id"], name=c["name"], village_id=c["villageId"],
            description=c["description"], image=c.get("image"),
        ))


async def seed_organizations(session, data: list[dict]) -> None:
    """Insere as organizacoes e a ligacao com as vilas."""
    for o in data:
        session.add(Organization(id=o["id"], name=o["name"], description=o["description"]))
    await session.flush()
    for o in data:
        for village_id in o.get("villageIds", []):
            session.add(OrganizationVillage(organization_id=o["id"], village_id=village_id))


async def seed_professions(session, data: list[dict]) -> None:
    """Insere as profissoes."""
    for p in data:
        session.add(Profession(
            id=p["id"], name=p["englishName"], name_pt=p["name"],
            group=ProfessionGroup(p["group"]), description=p["description"], icon=p["icon"],
        ))


async def seed_ninja_ranks(session, data: list[dict]) -> None:
    """Insere os ranks ninja."""
    for r in data:
        session.add(NinjaRank(
            id=r["id"], name=r["englishName"], name_pt=r["name"],
            order=r["order"], description=r["description"],
        ))


async def seed_story_arcs(session, data: list[dict]) -> None:
    """Insere os arcos de historia."""
    for a in data:
        session.add(StoryArc(id=a["id"], name=a["name"], level_range=a["levelRange"],
                              description=a["description"]))


async def seed_summons(session, data: list[dict]) -> None:
    """Insere os summons."""
    for s in data:
        stages = s["stages"]  # [Jovem, Adolescente, Adulta]
        session.add(Summon(
            id=s["id"], name=s["englishName"], name_pt=s["name"], village=s["village"],
            stage_young=stages[0], stage_teen=stages[1], stage_adult=stages[2],
        ))


async def seed_content_items(session, data: list[dict]) -> None:
    """Insere as entries do catalogo (mobs, itens, armas, missoes, guias)."""
    for e in data:
        item = ContentItem(
            slug=e["id"], category=ContentCategory(e["category"]), name=e["name"],
            level=e["level"], icon=e["icon"], image=e.get("image") or None,
            rarity=Rarity(e["rarity"]), description=e["description"],
            lore=e.get("lore"), synergy=e.get("synergy"),
            mob_type=MobType(e["mobType"]) if e.get("mobType") else None,
            item_type=ItemType(e["itemType"]) if e.get("itemType") else None,
        )
        for i, attr in enumerate(e.get("attributes", [])):
            item.attributes.append(ContentItemAttribute(label=attr["label"], value=str(attr["value"]), sort_order=i))
        for drop in e.get("drops", []):
            item.drops.append(ContentItemDrop(
                item_name=drop["name"], rarity=Rarity(drop["rarity"]), chance=drop["chance"],
                min_qty=drop.get("minQty"), max_qty=drop.get("maxQty"),
            ))
        session.add(item)


async def main() -> None:
    """Le o seed_data.json, APAGA o catalogo atual e recarrega tudo (nunca rode em banco com conteudo real)."""
    if not SEED_FILE.exists():
        raise SystemExit(
            f"Nao achei {SEED_FILE}. Gere ele primeiro com:\n"
            "  cd NinWiki.Web && npx tsx scripts/export-seed-data.ts"
        )

    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))

    async with AsyncSessionLocal() as session:
        await clear_catalog_tables(session)
        # Ordem importa: pais antes de filhos (FKs).
        # Ordem importa: pais antes de filhos (FKs). Um flush() apos
        # cada etapa garante que a etapa seguinte, se referenciar a
        # anterior por FK, sempre encontra a linha ja gravada no banco -
        # sem isso, o SQLAlchemy pode tentar inserir tudo numa ordem
        # que nao respeita as dependencias entre tabelas.
        await seed_attributes(session, data["attributes"])
        await session.flush()
        await seed_masteries(session, data["masteries"])
        await session.flush()
        await seed_jutsus(session, data["jutsus"])
        await session.flush()
        await seed_villages(session, data["villages"])
        await session.flush()
        await seed_clans(session, data["clans"])
        await session.flush()
        await seed_organizations(session, data["organizations"])
        await session.flush()
        await seed_professions(session, data["professions"])
        await seed_ninja_ranks(session, data["ninjaRanks"])
        await seed_story_arcs(session, data["storyArcs"])
        await seed_summons(session, data["summons"])
        await session.flush()
        await seed_content_items(session, data["entries"])

        await session.commit()

    print("Seed concluido com sucesso:")
    print(f"  {len(data['attributes'])} atributos")
    print(f"  {len(data['masteries'])} masteries")
    print(f"  {len(data['jutsus'])} jutsus")
    print(f"  {len(data['villages'])} vilas")
    print(f"  {len(data['clans'])} clas")
    print(f"  {len(data['organizations'])} organizacoes")
    print(f"  {len(data['professions'])} profissoes")
    print(f"  {len(data['ninjaRanks'])} ranks ninja")
    print(f"  {len(data['storyArcs'])} story arcs")
    print(f"  {len(data['summons'])} summons")
    print(f"  {len(data['entries'])} entries de catalogo (mobs/itens/armas/missoes/guias)")


if __name__ == "__main__":
    asyncio.run(main())
