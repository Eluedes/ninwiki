"""
Liga cada item do Nin Atlas ao ICONE dele no cliente do jogo, comparando as imagens pixel a pixel.

POR QUE EXISTE: o ID de um item no Atlas NAO e' o numero do icone no cliente (ex.: o item "Green Pants" e' o #13 no Atlas e o icone #35 no cliente). Usar o ID do Atlas
como numero de icone (como as primeiras versoes dos importadores faziam) liga a imagem errada. O Atlas guarda um icone 32x32 por item (`img/items/{id}.png`) que e' EXATAMENTE
a metade esquerda (sem fundo) do icone duplo 64x32 do cliente; comparando os pixels descobrimos qual icone do cliente e' de qual item.

As imagens do Atlas sao baixadas so' para comparar: NAO sao guardadas nem usadas no wiki (o wiki usa os icones do proprio cliente). O que fica em cache e' so' a
tabela de numeros em `backups/atlas_icones.json` (pasta que nao vai para o Git nem para a producao). Roda de novo so' para itens novos do Atlas.

Resultado: `mapa_icones(atlas, pasta_cliente)` -> {id do item no Atlas: [ids de icone no cliente]} (mais de um icone quando o cliente tem a mesma arte repetida).
Uso direto (resumo): python scripts/atlas_icones.py [--atualizar]
"""
import argparse
import hashlib
import io
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
from PIL import Image

from scripts.decodificar_znin import decodificar
from scripts.migrar_banco import ROOT

CLIENTE_PADRAO = r"E:\Nin Online - Wiki\data files\graphics\items"
ICONE_URL = "https://nin-atlas.vercel.app/img/items/{id}.png"
CACHE = ROOT / "backups" / "atlas_icones.json"


def _hash(img: Image.Image) -> str:
    """Assinatura dos pixels (RGBA) de uma imagem: duas imagens iguais pixel a pixel tem o mesmo valor."""
    return hashlib.md5(img.convert("RGBA").tobytes()).hexdigest()


def _indice_cliente(pasta: Path) -> dict[str, list[str]]:
    """{assinatura da metade esquerda (item sem fundo): [ids de icone do cliente]} para todos os `{id}.znin` da pasta."""
    indice: dict[str, list[str]] = {}
    for arquivo in sorted((p for p in pasta.glob("*.znin") if p.stem.isdigit()), key=lambda p: int(p.stem)):   # ignora as folhas animadas (1-animated.znin)
        try:
            img = Image.open(io.BytesIO(decodificar(arquivo.read_bytes()))).convert("RGBA")
        except (ValueError, OSError):
            continue
        indice.setdefault(_hash(img.crop((0, 0, img.width // 2, img.height))), []).append(arquivo.stem)
    return indice


def _assinatura_atlas(item_id: str) -> str | None:
    """Baixa o icone do Atlas desse item e devolve a assinatura dos pixels (None se nao baixar)."""
    for _ in range(3):
        try:
            resp = httpx.get(ICONE_URL.format(id=item_id), timeout=30, headers={"User-Agent": "NinWiki-icon-matching"})
            if resp.status_code == 200:
                return _hash(Image.open(io.BytesIO(resp.content)))
            if resp.status_code == 404:
                return None
        except (httpx.HTTPError, OSError):
            pass
        time.sleep(1)
    return None


def mapa_icones(atlas: dict, pasta_cliente: Path, atualizar: bool = False) -> dict[str, list[str]]:
    """{id do item no Atlas: [ids de icone do cliente]}. Usa o cache e so' compara os itens que ainda nao estao nele."""
    cache = {"mapa": {}, "sem_igual": []}
    if CACHE.is_file() and not atualizar:
        cache = json.loads(CACHE.read_text(encoding="utf-8"))
    pendentes = [i for i in atlas["items"] if i not in cache["mapa"] and i not in cache["sem_igual"]]
    if pendentes:
        print(f"Ligando {len(pendentes)} itens do Atlas aos icones do cliente (baixa os icones do Atlas so' para comparar)...")
        indice = _indice_cliente(Path(pasta_cliente))
        with ThreadPoolExecutor(6) as pool:
            for item_id, assinatura in zip(pendentes, pool.map(_assinatura_atlas, pendentes)):
                icones = indice.get(assinatura) if assinatura else None
                if icones:
                    cache["mapa"][item_id] = icones
                else:
                    cache["sem_igual"].append(item_id)
        CACHE.parent.mkdir(exist_ok=True)
        CACHE.write_text(json.dumps(cache), encoding="utf-8")
    return {i: cache["mapa"][i] for i in atlas["items"] if i in cache["mapa"]}


def itens_por_icone(mapa: dict[str, list[str]]) -> dict[str, list[str]]:
    """Inverso: {id de icone do cliente: [ids de item do Atlas que usam esse icone]} (varios itens podem dividir um icone, ex.: todos os "Manual")."""
    inverso: dict[str, list[str]] = {}
    for item_id, icones in mapa.items():
        for icone in icones:
            inverso.setdefault(icone, []).append(item_id)
    return inverso


def main() -> None:
    """Mostra o resumo da ligacao Atlas <-> icones do cliente (e atualiza o cache)."""
    from scripts.sincronizar_imagens_atlas import carregar_atlas
    ap = argparse.ArgumentParser(description="Liga os itens do Atlas aos icones do cliente (comparando pixels).")
    ap.add_argument("--atualizar", action="store_true", help="ignora o cache e compara tudo de novo")
    ap.add_argument("--cliente", default=CLIENTE_PADRAO, help="pasta graphics/items do cliente; padrao: %(default)s")
    args = ap.parse_args()
    atlas = carregar_atlas(None)
    mapa = mapa_icones(atlas, Path(args.cliente), args.atualizar)
    inverso = itens_por_icone(mapa)
    compartilhados = {i: v for i, v in inverso.items() if len(v) > 1}
    print(f"Itens do Atlas: {len(atlas['items'])} | ligados a um icone do cliente: {len(mapa)} | sem icone igual: {len(atlas['items']) - len(mapa)}")
    print(f"Icones do cliente usados por mais de um item: {len(compartilhados)}")
    sem = [atlas["items"][i]["name"] for i in atlas["items"] if i not in mapa]
    if sem:
        print("Sem icone igual no cliente:", ", ".join(sem[:10]))


if __name__ == "__main__":
    main()
