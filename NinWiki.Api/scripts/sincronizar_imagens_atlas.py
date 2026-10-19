"""
Arruma o banco de imagens usando a lista de itens do Nin Atlas (https://nin-atlas.vercel.app) e as imagens do proprio cliente do jogo.

O QUE FAZ (nesta ordem):
  1. CATEGORIZA as imagens `N_item` / `N_fundo` (o N e' o numero do ICONE no cliente do jogo; NAO e' o ID do item no Atlas: a ligacao e' feita comparando as imagens,
     ver scripts/atlas_icones.py) que ainda estao SEM categoria:
       icone de item do Atlas  -> categoria pelo tipo do item (Weapon=weapon, roupas e acessorios=gear, Ring=ring, Consumable e Cast=consumable, Currency=material (so' Ryo/Token/Coin/Coupon = currency),
                         Manual/Scroll=scroll, Furniture=furniture, Cast/Pack/Rod/Recipe/Authority/outros=other)
       icone que nenhum item do Atlas usa -> `closed` (so' S.Adm ve)
     Imagem que ja tem categoria NUNCA e' mexida (o trabalho manual fica), e nomes fora do padrao (Fire, Earth...) tambem nao.
  2. COMPLETA o que falta: icone de item do Atlas que nao tem imagem no banco e tem `{icone}.znin` na pasta do cliente vira `N_item` + `N_fundo`
     (o arquivo do jogo e' um PNG comprimido com LZ4 (scripts/decodificar_znin.py), com o icone sem fundo na metade esquerda e com fundo na direita - igual ao fatiar.py).

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
from scripts.atlas_icones import CLIENTE_PADRAO, arquivo_do_icone, identificar_imagens, itens_por_icone, mapa_icones
from scripts.decodificar_znin import decodificar

ATLAS_URL = "https://nin-atlas.vercel.app/data/atlas.js"
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


def categoria_do_icone(atlas: dict, por_icone: dict[str, list[str]], icone: str) -> str:
    """Categoria de um icone do cliente pelo(s) item(ns) do Atlas que o usam (varios itens podem dividir um icone: vale a categoria mais comum). `closed` se nenhum item usa."""
    itens = por_icone.get(icone)
    if not itens:
        return "closed"
    return Counter(categoria_do_item(atlas, i) for i in itens).most_common(1)[0][0]


def ler_znin(caminho: Path) -> Image.Image | None:
    """Abre um .znin do cliente (PNG comprimido com LZ4; ver scripts/decodificar_znin.py). None se o arquivo estiver corrompido."""
    try:
        img = Image.open(io.BytesIO(decodificar(caminho.read_bytes())))
        img.load()
        return img
    except (ValueError, OSError):
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
    ap.add_argument("--cliente", default=CLIENTE_PADRAO, help="pasta graphics/items do cliente do jogo (padrao: %(default)s)")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    mapa = mapa_icones(atlas, Path(args.cliente))
    por_icone = itens_por_icone(mapa)
    print(f"Atlas: {len(atlas['items'])} itens ({len(mapa)} ligados a um icone do cliente). Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        imagens = (await db.execute(select(MediaImage))).scalars().all()
        identificadas = identificar_imagens(imagens, UPLOAD_DIR, Path(args.cliente))   # (icone, item|fundo) pelo CONTEUDO: vale mesmo se a imagem foi renomeada

        # 1) categorizar o que esta' sem categoria
        por_categoria: Counter = Counter()
        corrigidas: Counter = Counter()
        ignoradas = com_categoria = 0
        for m in imagens:
            achou = NOME_IMAGEM.match(m.name or "")
            icone = identificadas[m.id][0] if m.id in identificadas else (achou.group(1) if achou else None)
            if icone is None:
                ignoradas += 1
                continue
            if m.category:
                esperado = categoria_do_icone(atlas, por_icone, icone)
                # categoria do usuario que contradiz o tipo do Atlas (so' com --corrigir-divergentes; `closed` e fora-do-Atlas ficam)
                if args.corrigir_divergentes and m.category != "closed" and esperado != "closed" and m.category != esperado:
                    corrigidas[f"{m.category} -> {esperado}"] += 1
                    if args.aplicar:
                        m.category = esperado
                else:
                    com_categoria += 1
                continue
            cat = categoria_do_icone(atlas, por_icone, icone)
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
        cobertos = set(arquivo_do_icone(imagens, identificadas))   # icones que ja tem imagem no banco (pelo conteudo ou pelo nome N_item)
        icones_do_atlas = sorted({icones[0] for icones in mapa.values()}, key=int)   # 1 icone por item (o primeiro, quando a arte se repete no cliente)
        faltando = [i for i in icones_do_atlas if i not in cobertos]
        pasta = Path(args.cliente)
        criar: list[tuple[str, str, Image.Image, Image.Image]] = []
        sem_arquivo = []
        for item_id in faltando:
            img = ler_znin(pasta / f"{item_id}.znin") if (pasta / f"{item_id}.znin").is_file() else None
            if img is None:
                sem_arquivo.append(item_id)
                continue
            esquerda, direita = metades(img)
            criar.append((item_id, categoria_do_icone(atlas, por_icone, item_id), esquerda, direita))
        print(f"\n2) Completar: {len(faltando)} icones de itens do Atlas sem imagem no banco -> {len(criar)} com arquivo no cliente "
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
