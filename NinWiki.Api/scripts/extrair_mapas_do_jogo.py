"""
Extrai os MAPAS do cliente do jogo (Nin Online) para o site: a arte do mapa-mundi e a imagem de cada area do jogo.

O QUE E' CADA ARQUIVO (tudo lido da pasta `data files` do cliente, que nunca e' alterada):
  - graphics/worldmap/1.znin : a arte do mapa-mundi (PNG comprimido em LZ4; mesmo formato do decodificar_znin.py).
  - worldmap cache/<id>_<versao>_2_1.wmr : a imagem pronta de UMA area. Cabecalho de 16 bytes ("WMR1", largura, altura, tamanho)
    e depois um bloco LZ4 com os pixels RGBA (largura x altura x 4 bytes).
  - mapscache/<id>/map<id>.map : dados da area; o NOME dela vem logo depois do marcador "PAMN" (texto com tamanho de 4 bytes na frente).
Grava, na pasta de destino, um .webp sem perdas por area (<id>.webp), o mundo (world.webp) e o indice `maps.json`
([{id, name, namePt, width, height}], ordenado por nome; o nome em portugues vem do arquivo de idioma do jogo) que o site le. Nenhum arquivo e' enviado para a internet.

Uso (pasta NinWiki.Api):
    py scripts/extrair_mapas_do_jogo.py                 # grava em ../NinWiki.Web/public/game-maps
    py scripts/extrair_mapas_do_jogo.py --cliente "E:\\SteamLibrary\\steamapps\\common\\Nin Online" --destino C:\\saida
"""
import argparse
import io
import json
import re
import struct
import sys
from pathlib import Path

from PIL import Image

from scripts.decodificar_znin import decodificar, lz4_bloco

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

    # Mapa-mundi (arte desenhada do jogo).
    with Image.open(io.BytesIO(decodificar((dados / "graphics" / "worldmap" / "1.znin").read_bytes()))) as mundo:
        mundo.convert("RGB").save(destino / "world.webp", quality=90, method=6)

    # Nomes em portugues: o arquivo de idioma do jogo mapeia "texto em ingles" -> "texto em portugues" (campo Entries).
    arquivo_pt = dados / "locales" / "Brazilian Portuguese.json"
    traducoes = json.loads(arquivo_pt.read_text(encoding="utf-8")).get("Entries", {}) if arquivo_pt.is_file() else {}

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
