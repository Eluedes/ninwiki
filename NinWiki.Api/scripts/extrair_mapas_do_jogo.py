"""
Extrai os MAPAS do cliente do jogo (Nin Online) para o site: a arte do mapa-mundi e a imagem de cada area do jogo.

O QUE E' CADA ARQUIVO (tudo lido da pasta `data files` do cliente, que nunca e' alterada):
  - worldmap cache/world_2.wmw : as imagens das areas que o jogo cola para formar o mapa-mundi (ver `montar_mundo`).
  - worldmap cache/<id>_<versao>_2_1.wmr : a imagem pronta de UMA area. Cabecalho de 16 bytes ("WMR1", largura, altura, tamanho)
    e depois um bloco LZ4 com os pixels RGBA (largura x altura x 4 bytes).
  - mapscache/<id>/map<id>.map : dados da area; o NOME dela vem logo depois do marcador "PAMN" (texto com tamanho de 4 bytes na frente).
Grava, na pasta de destino, um .webp sem perdas por area (<id>.webp), o mundo (world-map.webp + world.json) e o indice `maps.json`
([{id, name, namePt, width, height}], ordenado por nome; o nome em portugues vem do arquivo de idioma do jogo) que o site le. Nenhum arquivo e' enviado para a internet.

Uso (pasta NinWiki.Api):
    py scripts/extrair_mapas_do_jogo.py                 # grava em ../NinWiki.Web/public/game-maps
    py scripts/extrair_mapas_do_jogo.py --cliente "E:\\SteamLibrary\\steamapps\\common\\Nin Online" --destino C:\\saida
"""
import argparse
import json
import re
import struct
import sys
from pathlib import Path

from PIL import Image

from scripts.decodificar_znin import lz4_bloco
from scripts.sincronizar_imagens_atlas import carregar_atlas

CLIENTE_PADRAO = r"E:\SteamLibrary\steamapps\common\Nin Online"
DESTINO_PADRAO = Path(__file__).resolve().parents[2] / "NinWiki.Web" / "public" / "game-maps"
WMR = re.compile(r"^(\d+)_\d+_2_1\.wmr$")


def nome_do_mapa(arquivo: Path) -> str | None:
    """Le o nome da area no .map (texto logo depois de "PAMN" + versao). None se o arquivo nao tiver o formato esperado."""
    if not arquivo.is_file():
        return None
    dados = arquivo.read_bytes()[:512]
    pos = dados.find(b"PAMN")
    if pos < 0 or pos + 12 > len(dados):
        return None
    tamanho = struct.unpack("<I", dados[pos + 8:pos + 12])[0]
    texto = dados[pos + 12:pos + 12 + tamanho]
    if not 0 < tamanho < 100 or len(texto) != tamanho:
        return None
    return texto.decode("utf-8", "replace").strip() or None


def ler_wmr(arquivo: Path) -> Image.Image:
    """Decodifica um .wmr em imagem RGBA; levanta ValueError se o tamanho nao bater com largura x altura."""
    dados = arquivo.read_bytes()
    if dados[:4] != b"WMR1":
        raise ValueError("assinatura desconhecida")
    largura, altura = struct.unpack("<2I", dados[4:12])
    pixels = lz4_bloco(dados[16:])
    if len(pixels) != largura * altura * 4:
        raise ValueError(f"{len(pixels)} bytes != {largura}x{altura}x4")
    return Image.frombytes("RGBA", (largura, altura), pixels)


def montar_mundo(wmw: Path, destino: Path, traducoes: dict[str, str]) -> None:
    """Remonta o mapa-mundi do jogo: o `world_2.wmw` guarda a imagem de cada area (1 pixel por bloco do mapa) e o jogo as cola lado a lado.

    Formato do .wmw: 16 bytes de cabecalho ("WMW1", 8 bytes de verificacao, quantidade de areas) e, para cada area, id + tamanho bruto + tamanho
    comprimido (3 inteiros de 4 bytes) seguidos do bloco LZ4 com os pixels RGBA. O arquivo NAO traz a posicao de cada area (ela vem do servidor
    do jogo); as posicoes (x, y em blocos) e os tamanhos vem do Nin Atlas, e cada imagem so' e' usada se o tamanho bater com o do arquivo.
    Grava `world-map.webp` (recortado na area usada) e `world.json` ({width, height, maps: [{id, x, y, w, h, v}], villages: [{id, name, namePt}],
    places: [{kind, name, namePt, x, y}]}); posicoes ja' relativas ao recorte. `v` = id da vila dona da area (0 = nenhuma). Os lugares
    (lojas, calabouços, caixa de correio, mural, padre) vem do Atlas, em blocos dentro da area, e aqui ja' sao somados a' posicao da area.
    Missoes e bounty nao aparecem no Atlas como lugares fixos, entao ficam de fora.
    """
    atlas = carregar_atlas(None)
    dados = wmw.read_bytes()
    total = struct.unpack("<I", dados[12:16])[0]
    tela = Image.new("RGBA", (atlas["world"]["w"], atlas["world"]["h"]), (0, 0, 0, 0))
    colocadas, puladas, lugares = [], [], []
    pos = 16
    for _ in range(total):
        mapa_id, bruto, comprimido = struct.unpack("<3I", dados[pos:pos + 12])
        pixels = lz4_bloco(dados[pos + 12:pos + 12 + comprimido])
        pos += 12 + comprimido
        m = atlas["maps"].get(str(mapa_id))
        if not m or "x" not in m or m["w"] * m["h"] * 4 != bruto:
            puladas.append(mapa_id)
            continue
        tela.alpha_composite(Image.frombytes("RGBA", (m["w"], m["h"]), pixels), (m["x"], m["y"]))
        colocadas.append({"id": mapa_id, "x": m["x"], "y": m["y"], "w": m["w"], "h": m["h"], "v": m.get("village", 0)})
        # "leaderboards" fica no mesmo ponto do mural (notice): so' um marcador para os dois.
        for lugar in m.get("places", []):
            if lugar["kind"] != "leaderboards":
                lugares.append({"kind": lugar["kind"], "name": lugar["name"], "namePt": traducoes.get(lugar["name"], lugar["name"]),
                                "x": m["x"] + lugar["x"], "y": m["y"] + lugar["y"]})
    esq, topo, dir_, base = tela.getbbox()
    tela.crop((esq, topo, dir_, base)).save(destino / "world-map.webp", lossless=True, method=6)
    for m in colocadas:
        m["x"] -= esq
        m["y"] -= topo
    for lugar in lugares:
        lugar["x"] -= esq
        lugar["y"] -= topo
    vilas = [{"id": r["village"], "name": r["name"], "namePt": traducoes.get(r["name"], r["name"])} for r in atlas["regions"]]
    (destino / "world.json").write_text(
        json.dumps({"width": dir_ - esq, "height": base - topo, "maps": colocadas, "villages": vilas, "places": lugares}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Mapa-mundi: {len(colocadas)} areas colocadas, {len(lugares)} lugares, {len(vilas)} vilas, {len(puladas)} sem posicao no Atlas {puladas}")


def main() -> None:
    """Converte o mundo e todas as areas, grava o indice e imprime o resumo."""
    ap = argparse.ArgumentParser(description="Extrai os mapas do cliente do jogo para o site.")
    ap.add_argument("--cliente", default=CLIENTE_PADRAO, help="pasta do jogo; padrao: %(default)s")
    ap.add_argument("--destino", default=str(DESTINO_PADRAO), help="pasta de saida; padrao: %(default)s")
    args = ap.parse_args()

    dados = Path(args.cliente) / "data files"
    destino = Path(args.destino)
    if not (dados / "worldmap cache").is_dir():
        sys.exit(f"Pasta do jogo nao encontrada: {dados}")
    destino.mkdir(parents=True, exist_ok=True)

    # Nomes em portugues: o arquivo de idioma do jogo mapeia "texto em ingles" -> "texto em portugues" (campo Entries).
    arquivo_pt = dados / "locales" / "Brazilian Portuguese.json"
    traducoes = json.loads(arquivo_pt.read_text(encoding="utf-8")).get("Entries", {}) if arquivo_pt.is_file() else {}

    try:
        montar_mundo(dados / "worldmap cache" / "world_2.wmw", destino, traducoes)
    except OSError as exc:   # sem internet nao da' para pegar as posicoes; as areas ainda sao extraidas
        print(f"AVISO: mapa-mundi nao montado ({exc})")

    indice, sem_nome, falhas = [], [], []
    for wmr in sorted((dados / "worldmap cache").glob("*.wmr")):
        achou = WMR.match(wmr.name)
        if not achou:
            continue
        mapa_id = int(achou.group(1))
        try:
            imagem = ler_wmr(wmr)
        except ValueError as exc:
            falhas.append((wmr.name, str(exc)))
            continue
        nome = nome_do_mapa(dados / "mapscache" / str(mapa_id) / f"map{mapa_id}.map")
        if nome is None:
            sem_nome.append(mapa_id)
            nome = f"Map {mapa_id}"
        imagem.save(destino / f"{mapa_id}.webp", lossless=True, method=6)
        indice.append({"id": mapa_id, "name": nome, "namePt": traducoes.get(nome, nome), "width": imagem.width, "height": imagem.height})

    indice.sort(key=lambda m: (m["name"].lower(), m["id"]))
    (destino / "maps.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    tamanho = sum(f.stat().st_size for f in destino.glob("*.webp")) / 1e6
    print(f"{len(indice)} areas + mundo gravados em {destino} ({tamanho:.1f} MB de imagens)")
    if sem_nome:
        print(f"Sem nome no .map (ficaram 'Map <id>'): {sem_nome}")
    for nome, motivo in falhas:
        print(f"FALHOU {nome}: {motivo}")


if __name__ == "__main__":
    main()
