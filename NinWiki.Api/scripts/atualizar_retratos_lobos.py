"""
Atualiza o retrato de 4 lobos com os sprites NOVOS do cliente (patch v6.0.2.4): 608 branco -> Snow Wolf, 610 cinza -> Wolf, 609 marrom -> Enraged Wolf,
607 preto -> Rabid Wolf. Forest Wolf, Alpha Wolf, Werewolf e a montaria Wolf Whistle NAO sao tocados.

Para cada lobo: decodifica o `.znin` do cliente, gera o retrato com a MESMA funcao do importador de mobs (1o quadro da folha 16x4, recortado, ampliado
4x sem borrar), grava um arquivo NOVO em uploads/, cria uma linha NOVA em media_images (categoria `monster`, nome `mob_{sprite}`, uploaded_by `Cliente do jogo`)
e aponta o campo `image` do mob para ela. A imagem antiga NAO e' alterada nem apagada (da' para reverter apontando de volta). Idempotente: se o mob ja
aponta para a imagem `mob_{sprite}`, nao faz nada. Wolf e Rabid Wolf dividiam a mesma imagem; agora cada um tem a sua.

Por padrao e' SIMULACAO. Uso (pasta NinWiki.Api, `$env:PYTHONPATH="."`):
    py scripts/atualizar_retratos_lobos.py                 # simulacao
    py scripts/atualizar_retratos_lobos.py --aplicar       # grava no banco local
    py scripts/atualizar_retratos_lobos.py --aplicar --permitir-remoto   # producao (faca backup antes; as imagens de uploads/ precisam ser enviadas)
"""
import argparse
import asyncio
import io
from pathlib import Path

from PIL import Image
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.media_refs import media_url
from app.models.content import ContentItem
from app.models.enums import ContentCategory
from app.models.media import MediaImage
from scripts._guarda_banco import exigir_banco_local
from scripts.decodificar_znin import decodificar
from scripts.importar_mobs_atlas import retrato
from scripts.sincronizar_imagens_atlas import salvar_png

PASTA_CLIENTE = Path(r"E:\SteamLibrary\steamapps\common\Nin Online\data files\graphics\characters")
USUARIO = "Cliente do jogo"
# nome do mob (no wiki) -> numero do sprite novo no cliente
LOBOS = {"Snow Wolf": 608, "Wolf": 610, "Enraged Wolf": 609, "Rabid Wolf": 607}


async def main() -> None:
    """Simula (ou grava com --aplicar) a troca dos retratos dos lobos."""
    ap = argparse.ArgumentParser(description="Troca o retrato de Wolf, Snow Wolf, Enraged Wolf e Rabid Wolf pelos sprites novos do cliente.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--cliente", default=str(PASTA_CLIENTE), help="pasta graphics/characters do cliente (padrao: %(default)s)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)

    async with AsyncSessionLocal() as db:
        for nome, sprite in LOBOS.items():
            mob = (await db.execute(select(ContentItem).where(ContentItem.category == ContentCategory.MOBS, ContentItem.name == nome))).scalar_one_or_none()
            if mob is None:
                print(f"[{nome}] mob nao encontrado: pulado")
                continue
            nome_img = f"mob_{sprite}"
            imagem = (await db.execute(select(MediaImage).where(MediaImage.name == nome_img, MediaImage.uploaded_by == USUARIO))).scalars().first()
            if imagem is not None:
                novo_url = media_url(imagem.filename)
                if mob.image == novo_url:
                    print(f"[{nome}] ja usa {imagem.filename}: nada a fazer")
                    continue
            else:
                png = decodificar((Path(args.cliente) / f"{sprite}.znin").read_bytes())
                img = retrato_de_bytes(png)
                if args.aplicar:
                    arquivo, w, h, tam = salvar_png(img)
                    imagem = MediaImage(filename=arquivo, name=nome_img, category="monster", width=w, height=h, bytes=tam, uploaded_by=USUARIO)
                    db.add(imagem)
                    await db.flush()
                else:
                    print(f"[{nome}] criaria imagem nova {nome_img} ({img.width}x{img.height}) e apontaria o mob para ela")
                    continue
            mob.image = media_url(imagem.filename)
            print(f"[{nome}] -> {imagem.filename}")
        if args.aplicar:
            await db.commit()
        else:
            print("Simulacao: nada foi gravado. Use --aplicar.")


def retrato_de_bytes(png: bytes) -> Image.Image:
    """Gera o retrato a partir dos bytes do PNG (reaproveita `retrato`, que le de arquivo, via buffer em memoria)."""
    img = retrato(io.BytesIO(png))
    if img is None:
        raise ValueError("folha vazia ou ilegivel")
    return img


if __name__ == "__main__":
    asyncio.run(main())
