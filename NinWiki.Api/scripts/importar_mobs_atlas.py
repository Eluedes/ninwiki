"""
Importa os MONSTROS (os que lutam: `fight`) do Nin Atlas (https://nin-atlas.vercel.app) para o wiki, como RASCUNHO, com dados, drops e retrato.

O QUE FAZ, por monstro do Atlas:
  - Se o wiki JA tem um mob com esse nome (sem diferenciar maiusculas): so' PREENCHE o que esta' vazio (nivel, dano, XP, respawn, alcance, imagem e drops).
    O que ja tem valor NUNCA e' trocado (a vida que voce digitou, por exemplo, fica). O tipo so' muda de NPC para Monster/Boss em rascunhos.
  - Se NAO tem: cria um mob em RASCUNHO (status draft), em ingles. O portugues vem depois pelo importador das traducoes oficiais (/admin/translations).
  - Tipo: boss do Atlas -> Boss; senao Monster. NPCs que nao lutam (lojistas etc.) NAO entram.
  - Drops: ligados ao item do wiki pelo NOME (acha o item e a raridade dele); sem item no wiki ainda, fica so' o nome e a raridade do Atlas. A chance vira
    "Over N%" / "Below N%", como o proprio jogo mostra. A vida nao existe no Atlas: fica vazia.
  - Retrato: o 1o quadro da folha de sprites (`{sprite}.png`, 16 colunas x 4 linhas), recortado nas bordas e ampliado 4x sem borrar, vai para o banco de imagens
    (categoria `monster`, nome `mob_{sprite}`; monstros que dividem o mesmo sprite dividem a imagem).

NADA e' publicado: tudo entra como rascunho para voce revisar. Por padrao e' SIMULACAO (so' conta); grava com --aplicar. Recusa banco que nao seja local,
a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/importar_mobs_atlas.py                 # simulacao
    python scripts/importar_mobs_atlas.py --aplicar       # grava no banco local
    python scripts/importar_mobs_atlas.py --aplicar --permitir-remoto
Opcoes: --atlas arquivo.js, --personagens "C:\\Users\\User\\Desktop\\Wiki-Image\\Characters" (PNGs das folhas de sprite).
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.content_items import _DEFAULT_ICON_BY_CATEGORY, _slugify
from app.api.uploads import UPLOAD_DIR
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.media_refs import media_url
from app.models.content import ContentItem, ContentItemDrop
from app.models.enums import ContentCategory, ContentStatus, DropChanceQualifier, MobType, Rarity
from app.models.media import MediaImage
from scripts._guarda_banco import exigir_banco_local
from scripts.sincronizar_imagens_atlas import carregar_atlas, salvar_png

PERSONAGENS_PADRAO = r"C:\Users\User\Desktop\Wiki-Image\Characters"
USUARIO = "Atlas"
FAIXA = re.compile(r"^(Over|Below)\s+(\d+(?:\.\d+)?)\s*%$", re.I)
# Raridade do Atlas -> raridade do wiki (usada so' quando o item do drop ainda nao existe no wiki).
RARIDADE_ATLAS = {"0": Rarity.COMMON, "1": Rarity.UNCOMMON, "2": Rarity.ENCHANTED, "3": Rarity.RARE, "4": Rarity.UNIQUE,
                  "5": Rarity.LEGENDARY, "6": Rarity.EPIC, "7": Rarity.EVENT, "8": Rarity.ENCHANTED}


def retrato(folha: Path) -> Image.Image | None:
    """1o quadro (cima/esquerda) da folha de 16x4 quadros, recortado no conteudo e ampliado 4x (pixel art, sem borrar). None se a folha nao abre ou o quadro e' vazio."""
    try:
        with Image.open(folha) as img:
            img = img.convert("RGBA")
    except Exception:
        return None
    quadro = img.crop((0, 0, img.width // 16, img.height // 4))
    caixa = quadro.getchannel("A").getbbox()
    if caixa is None:
        return None
    esq, topo, dir_, base = caixa
    quadro = quadro.crop((max(0, esq - 2), max(0, topo - 2), min(quadro.width, dir_ + 2), min(quadro.height, base + 2)))
    fator = 4 if max(quadro.size) * 4 <= 256 else max(1, 256 // max(quadro.size))
    return quadro.resize((quadro.width * fator, quadro.height * fator), Image.NEAREST)


def texto_numero(valor) -> str | None:
    """Numero do Atlas como texto ('6'); None se faltar."""
    return None if valor is None else str(valor)


async def main() -> None:
    """Simula (ou grava com --aplicar) a importacao dos monstros do Atlas."""
    ap = argparse.ArgumentParser(description="Importa os monstros do Nin Atlas como rascunho.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    ap.add_argument("--personagens", default=PERSONAGENS_PADRAO, help="pasta com os PNGs das folhas de sprite ({sprite}.png)")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    lutadores = [n for n in atlas["npcs"].values() if n.get("fight")]
    print(f"Atlas: {len(lutadores)} monstros que lutam. Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    gravados: list[str] = []
    async with AsyncSessionLocal() as db:
        todos = (await db.execute(select(ContentItem).options(selectinload(ContentItem.drops)))).scalars().all()
        mobs = {c.name.lower(): c for c in todos if c.category == ContentCategory.MOBS}
        itens = {c.name.lower(): c for c in todos if c.category != ContentCategory.MOBS}
        slugs = {c.slug for c in todos}
        midia = {m.name: m for m in (await db.execute(select(MediaImage).where(MediaImage.name.like("mob\\_%", escape="\\")))).scalars().all()}
        pasta = Path(args.personagens)

        novos = atualizados = campos = drops_novos = drops_ligados = imagens_novas = sem_folha = 0
        sem_item: set[str] = set()
        try:
            for n in lutadores:
                existente = mobs.get(n["name"].lower())
                tipo = MobType.BOSS if n.get("boss") else MobType.MONSTER
                dados = {"level": n.get("level"), "mob_damage": texto_numero(n.get("damage")), "mob_experience": texto_numero(n.get("exp")),
                         "mob_respawn_time": f"{n['respawn']}s" if n.get("respawn") is not None else None, "mob_range": texto_numero(n.get("range"))}

                # retrato (cria a imagem uma vez por sprite)
                nome_img = f"mob_{n.get('sprite')}"
                imagem = midia.get(nome_img)
                if imagem is None and n.get("sprite") is not None:
                    folha = pasta / f"{n['sprite']}.png"
                    img = retrato(folha) if folha.is_file() else None
                    if img is None:
                        sem_folha += 1
                    else:
                        imagens_novas += 1
                        if args.aplicar:
                            arquivo, w, h, tam = salvar_png(img)
                            gravados.append(arquivo)
                            imagem = MediaImage(filename=arquivo, name=nome_img, category="monster", width=w, height=h, bytes=tam, uploaded_by=USUARIO)
                            db.add(imagem)
                            await db.flush()
                            midia[nome_img] = imagem
                url_imagem = media_url(imagem.filename) if imagem is not None and imagem.filename else None

                if existente is None:
                    novos += 1
                    slug = _slugify(n["name"]) or f"mob-{n.get('sprite')}"
                    base, k = slug, 2
                    while slug in slugs:
                        slug, k = f"{base}-{k}", k + 1
                    slugs.add(slug)
                    alvo = ContentItem(slug=slug, category=ContentCategory.MOBS, name=n["name"], icon=_DEFAULT_ICON_BY_CATEGORY.get("mobs", "👹"),
                                       rarity=Rarity.COMMON, description="", status=ContentStatus.DRAFT, mob_type=tipo, level=dados["level"] or 0,
                                       mob_damage=dados["mob_damage"], mob_experience=dados["mob_experience"], mob_respawn_time=dados["mob_respawn_time"],
                                       mob_range=dados["mob_range"], image=url_imagem)
                    if args.aplicar:
                        db.add(alvo)
                        await db.flush()
                    tem_drops = False
                else:
                    atualizados += 1
                    alvo = existente
                    for campo, valor in dados.items():
                        atual = getattr(alvo, campo)
                        if valor is not None and (atual in (None, "") or (campo == "level" and atual == 0)):
                            campos += 1
                            if args.aplicar:
                                setattr(alvo, campo, valor)
                    if alvo.mob_type is None or (alvo.status == ContentStatus.DRAFT and alvo.mob_type == MobType.NPC):
                        campos += 1
                        if args.aplicar:
                            alvo.mob_type = tipo
                    if url_imagem and not alvo.image:
                        campos += 1
                        if args.aplicar:
                            alvo.image = url_imagem
                    tem_drops = bool(alvo.drops)

                # drops (so' se o mob ainda nao tem nenhum)
                if not tem_drops:
                    ja: set[str] = set()
                    for d in n.get("drops") or []:
                        item_atlas = atlas["items"].get(str(d[0]))
                        if item_atlas is None or item_atlas["name"].lower() in ja:
                            continue
                        faixa = FAIXA.match(d[1] or "")
                        if faixa is None:
                            continue
                        ja.add(item_atlas["name"].lower())
                        ligado = itens.get(item_atlas["name"].lower())
                        drops_novos += 1
                        if ligado is not None:
                            drops_ligados += 1
                        else:
                            sem_item.add(item_atlas["name"])
                        if args.aplicar:
                            qtd = d[2] if len(d) > 2 and isinstance(d[2], int) and d[2] > 1 else None
                            db.add(ContentItemDrop(content_item_id=alvo.id, item_name=item_atlas["name"],
                                                   rarity=ligado.rarity if ligado is not None else RARIDADE_ATLAS.get(str(item_atlas.get("rarity")), Rarity.COMMON),
                                                   chance=float(faixa.group(2)),
                                                   chance_qualifier=DropChanceQualifier.OVER if faixa.group(1).lower() == "over" else DropChanceQualifier.BELOW,
                                                   min_qty=qtd, max_qty=qtd, dropped_item_id=ligado.id if ligado is not None else None))
            if args.aplicar:
                await db.commit()
        except Exception:
            await db.rollback()
            for arquivo in gravados:   # sem arquivo orfao se o banco recusar
                (UPLOAD_DIR / arquivo).unlink(missing_ok=True)
            raise

    print(f"\nMonstros novos (rascunho): {novos}")
    print(f"Mobs que o wiki ja tinha e recebem dados nos campos vazios: {atualizados} ({campos} campos preenchidos)")
    print(f"Drops novos: {drops_novos} ({drops_ligados} ligados a um item que ja existe no wiki; {len(sem_item)} itens ainda nao existem como pagina)")
    print(f"Retratos novos no banco de imagens: {imagens_novas} ({sem_folha} sprites sem folha em '{args.personagens}')")
    if sem_item:
        print("  itens de drop ainda sem pagina (exemplos):", ", ".join(sorted(sem_item)[:10]))
    print("\nGravado (tudo como rascunho)." if args.aplicar else "\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
