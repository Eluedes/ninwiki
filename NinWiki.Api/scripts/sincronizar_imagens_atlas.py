"""
Arruma o banco de imagens usando a lista de itens do Nin Atlas (https://nin-atlas.vercel.app) e as imagens do proprio cliente do jogo.

O QUE FAZ (nesta ordem):
  1. CATEGORIZA as imagens `N_item` / `N_fundo` (o N e' o ID do item no jogo, igual ao do Atlas) que ainda estao SEM categoria:
       item do Atlas  -> categoria pelo tipo (Weapon=weapon, roupas e acessorios=gear, Ring=ring, Consumable e Cast=consumable, Currency=material (so' Ryo/Token/Coin/Coupon = currency),
                         Manual/Scroll=scroll, Furniture=furniture, Cast/Pack/Rod/Recipe/Authority/outros=other)
       NAO esta' no Atlas -> `closed` (so' S.Adm ve)
     Imagem que ja tem categoria NUNCA e' mexida (o trabalho manual fica), e nomes fora do padrao (Fire, Earth...) tambem nao.
  2. COMPLETA o que falta: item do Atlas que nao tem imagem no banco e tem `{id}.znin` na pasta do cliente vira `N_item` + `N_fundo`
     (o arquivo do jogo e' um PNG com 12 bytes de cabecalho, com o icone sem fundo na metade esquerda e com fundo na direita - igual ao fatiar.py).

SEGURANCA: por padrao e' SIMULACAO (so' conta e mostra exemplos). So' grava com --aplicar. Faca um backup antes de rodar na producao.
Recusa banco que nao seja local, a menos que voce passe --permitir-remoto (de proposito, depois de um backup novo).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/sincronizar_imagens_atlas.py                              # simulacao
    python scripts/sincronizar_imagens_atlas.py --aplicar                    # grava no banco local
    python scripts/sincronizar_imagens_atlas.py --aplicar --permitir-remoto  # grava no banco do DATABASE_URL (producao)
Opcoes: --atlas arquivo.js (usa uma copia local em vez de baixar), --cliente "E:\\Nin Online - Wiki\\data files\\graphics\\items".
"""
import argparse
import asyncio
import io
import json
import re
import secrets
import sys
import urllib.request
from collections import Counter
from pathlib import Path

from PIL import Image
from sqlalchemy import select

from app.api.uploads import UPLOAD_DIR
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.media import MediaImage
from scripts._guarda_banco import exigir_banco_local

ATLAS_URL = "https://nin-atlas.vercel.app/data/atlas.js"
CLIENTE_PADRAO = r"E:\Nin Online - Wiki\data files\graphics\items"
USUARIO = "Atlas"   # aparece em "enviado por" nas imagens que este script cria
NOME_IMAGEM = re.compile(r"^(\d+)_(item|fundo)$")

# Tipo do Atlas (itemTypes) -> categoria do banco de imagens. O que nao esta' aqui vira `other`.
CATEGORIA_POR_TIPO = {
    "Weapon": "weapon",
    "Shirt": "gear", "Hat": "gear", "Mask": "gear", "Pants": "gear", "Shoes": "gear", "Vest": "gear", "Accessory": "gear",
    "Ring": "ring", "Consumable": "consumable", "Cast": "consumable",   # Cast = shuriken, kunai, pilulas, dango (gastam ao usar)
    "Manual": "scroll", "Scroll": "scroll", "Furniture": "furniture",
    "Currency": "material",   # no Atlas "Currency" e' quase tudo loot de mob (Scorpion Tail, Tiger Fur...): so' o que parece moeda vira `currency` (abaixo)
}
MOEDA_DE_VERDADE = re.compile(r"^(Ryo|.*(Token|Coin|Coupon)s?)$", re.I)


def carregar_atlas(origem: str | None) -> dict:
    """Le o atlas.js (baixado, ou de um arquivo local) e devolve o objeto ATLAS como dicionario."""
    if origem:
        texto = Path(origem).read_text(encoding="utf-8")
    else:
        with urllib.request.urlopen(urllib.request.Request(ATLAS_URL, headers={"User-Agent": "NinWiki"}), timeout=60) as resp:
            texto = resp.read().decode("utf-8")
    corpo = texto.strip()
    corpo = corpo[corpo.index("=") + 1:].rstrip().rstrip(";")
    return json.loads(corpo)


def categoria_do_item(atlas: dict, item_id: str) -> str:
    """Categoria de um item do Atlas pelo tipo; `closed` se o ID nao existe no Atlas."""
    item = atlas["items"].get(item_id)
    if item is None:
        return "closed"
    tipo = atlas["itemTypes"].get(str(item["type"]), "")
    if tipo == "Currency" and MOEDA_DE_VERDADE.match(item.get("name", "")):
        return "currency"
    return CATEGORIA_POR_TIPO.get(tipo, "other")


def ler_znin(caminho: Path) -> Image.Image | None:
    """Abre um .znin do cliente (cabecalho curto + PNG normal). None se nao achar um PNG valido."""
    dados = caminho.read_bytes()
    inicio = dados.find(b"\x89PNG\r\n\x1a\n")
    if inicio < 0:
        return None
    try:
        img = Image.open(io.BytesIO(dados[inicio:]))
        img.load()
        return img
    except Exception:
        return None


def metades(img: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Divide o icone duplo: (esquerda = item sem fundo, direita = item com fundo), como o fatiar.py."""
    meio = img.width // 2
    return img.crop((0, 0, meio, img.height)), img.crop((meio, 0, img.width, img.height))


def salvar_png(img: Image.Image) -> tuple[str, int, int, int]:
    """Grava o PNG em uploads/ com nome aleatorio (nunca o nome original). Devolve (arquivo, largura, altura, bytes)."""
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    dados = buf.getvalue()
    nome = f"{secrets.token_hex(16)}.png"
    (UPLOAD_DIR / nome).write_bytes(dados)
    return nome, img.width, img.height, len(dados)


async def main() -> None:
    """Simula (ou grava com --aplicar) a categorizacao e o complemento de imagens."""
    ap = argparse.ArgumentParser(description="Categoriza e completa o banco de imagens com base no Nin Atlas.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--corrigir-divergentes", action="store_true",
                    help="tambem corrige as que JA tem categoria mas contradizem o tipo do Atlas (ex.: anel em furniture); `closed` nunca e' mexida")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    ap.add_argument("--cliente", default=CLIENTE_PADRAO, help="pasta graphics/items do cliente do jogo")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    print(f"Atlas: {len(atlas['items'])} itens. Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        imagens = (await db.execute(select(MediaImage))).scalars().all()

        # 1) categorizar o que esta' sem categoria
        por_categoria: Counter = Counter()
        corrigidas: Counter = Counter()
        ignoradas = com_categoria = 0
        for m in imagens:
            achou = NOME_IMAGEM.match(m.name or "")
            if not achou:
                ignoradas += 1
                continue
            if m.category:
                esperado = categoria_do_item(atlas, achou.group(1))
                # categoria do usuario que contradiz o tipo do Atlas (so' com --corrigir-divergentes; `closed` e fora-do-Atlas ficam)
                if args.corrigir_divergentes and m.category != "closed" and esperado != "closed" and m.category != esperado:
                    corrigidas[f"{m.category} -> {esperado}"] += 1
                    if args.aplicar:
                        m.category = esperado
                else:
                    com_categoria += 1
                continue
            cat = categoria_do_item(atlas, achou.group(1))
            por_categoria[cat] += 1
            if args.aplicar:
                m.category = cat
        print(f"\n1) Categorizar: {sum(por_categoria.values())} imagens sem categoria "
              f"({com_categoria} ja tinham categoria e ficam como estao; {ignoradas} com nome fora do padrao ficam quietas)")
        for cat, n in por_categoria.most_common():
            print(f"     {cat:<11} {n}")
        if args.corrigir_divergentes:
            print(f"   Corrigir divergentes: {sum(corrigidas.values())} imagens (categoria atual contradiz o tipo do Atlas)")
            for troca, n in corrigidas.most_common():
                print(f"     {troca:<24} {n}")

        # 2) completar o que falta
        existentes = {m.name for m in imagens}
        faltando = sorted((i for i in atlas["items"] if f"{i}_item" not in existentes), key=int)
        pasta = Path(args.cliente)
        criar: list[tuple[str, str, Image.Image, Image.Image]] = []
        sem_arquivo = []
        for item_id in faltando:
            img = ler_znin(pasta / f"{item_id}.znin") if (pasta / f"{item_id}.znin").is_file() else None
            if img is None:
                sem_arquivo.append(item_id)
                continue
            esquerda, direita = metades(img)
            criar.append((item_id, categoria_do_item(atlas, item_id), esquerda, direita))
        print(f"\n2) Completar: {len(faltando)} itens do Atlas sem imagem no banco -> {len(criar)} com arquivo no cliente "
              f"({len(sem_arquivo)} sem arquivo em '{pasta}')")
        if criar:
            print("     exemplos:", ", ".join(f"{i}[{c}]" for i, c, _, _ in criar[:8]))
        if args.aplicar:
            gravados: list[str] = []   # PNGs criados agora: se o banco recusar, sao apagados (sem arquivo orfao)
            try:
                for item_id, cat, esquerda, direita in criar:
                    for sufixo, parte in (("item", esquerda), ("fundo", direita)):
                        arquivo, w, h, tam = salvar_png(parte)
                        gravados.append(arquivo)
                        db.add(MediaImage(filename=arquivo, name=f"{item_id}_{sufixo}", category=cat, width=w, height=h, bytes=tam, uploaded_by=USUARIO))
                await db.commit()
            except Exception:
                await db.rollback()
                for arquivo in gravados:
                    (UPLOAD_DIR / arquivo).unlink(missing_ok=True)
                raise
            print("\nGravado.")
        else:
            print("\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
