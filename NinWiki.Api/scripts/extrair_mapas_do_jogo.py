"""
Extrai os MAPAS do cliente do jogo (Nin Online) para o site: a arte do mapa-mundi e a imagem de cada area do jogo.

O QUE E' CADA ARQUIVO (tudo lido da pasta `data files` do cliente, que nunca e' alterada):
  - worldmap cache/world_2.wmw : as imagens das areas que o jogo cola para formar o mapa-mundi (ver `montar_mundo`).
  - worldmap cache/<id>_<versao>_2_1.wmr : a imagem pronta de UMA area. Cabecalho de 16 bytes ("WMR1", largura, altura, tamanho)
    e depois um bloco LZ4 com os pixels RGBA (largura x altura x 4 bytes).
  - mapscache/<id>/map<id>.map : dados da area; o NOME dela vem logo depois do marcador "PAMN" (texto com tamanho de 4 bytes na frente).
Tambem grava o fundo do mapa-mundi (o mesmo terreno/neblina que o Atlas usa: baixado do Atlas -> world-bg.webp; a ilustracao do jogo, 1.znin, NAO e' mais usada), os mapas em PERGAMINHO das vilas (graphics/worldmap/<id da area>.znin
-> scroll-<id>.webp; so' Sand 51 e Mist 100 tem) `areas-info.json` (dados enxutos do Atlas por area: zona, lugares, saidas, NPCs, mobs, recursos), `world-atlas.json` (marcadores agrupados, ligacoes, rotas, regioes e faixa de nivel, usados pelo mapa-mundi em canvas) e `area-pins.json` (pinos DENTRO de cada area: lugares, predios, portas, mobs, NPCs e recursos).
Grava, na pasta de destino, um .webp sem perdas por area (<id>.webp), o mundo (world-map.webp + world.json) e o indice `maps.json`
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
import urllib.request
from pathlib import Path

from PIL import Image

from scripts.decodificar_znin import decodificar, lz4_bloco
from scripts.sincronizar_imagens_atlas import carregar_atlas

CLIENTE_PADRAO = r"E:\SteamLibrary\steamapps\common\Nin Online"
DESTINO_PADRAO = Path(__file__).resolve().parents[2] / "NinWiki.Web" / "public" / "game-maps"
FUNDO_URL = "https://nin-atlas.vercel.app/img/world.png"
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
    Grava `world-map.webp` (recortado na area usada) e `world.json` ({width, height, ox, oy, mw, mh, maps: [{id, x, y, w, h, v}], villages: [{id, name, namePt}],
    places: [{kind, name, namePt, x, y}]}); posicoes em blocos do MUNDO inteiro (como no Atlas; `ox`/`oy` dizem onde o recorte da imagem comeca). `v` = id da vila dona da area (0 = nenhuma). Os lugares
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
    vilas = [{"id": r["village"], "name": r["name"], "namePt": traducoes.get(r["name"], r["name"])} for r in atlas["regions"]]
    # Coordenadas em BLOCOS DO MUNDO INTEIRO (as mesmas do Atlas); `ox`/`oy` = onde o recorte do mosaico (world-map.webp, `mw` x `mh`) comeca.
    (destino / "world.json").write_text(
        json.dumps({"width": atlas["world"]["w"], "height": atlas["world"]["h"], "ox": esq, "oy": topo, "mw": dir_ - esq, "mh": base - topo,
                    "maps": colocadas, "villages": vilas, "places": lugares}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Mapa-mundi: {len(colocadas)} areas colocadas, {len(lugares)} lugares, {len(vilas)} vilas, {len(puladas)} sem posicao no Atlas {puladas}")


def gravar_arte_do_jogo(dados: Path, destino: Path, scrolls: list[int]) -> None:
    """Baixa o fundo do mundo e decodifica os pergaminhos das vilas (<id>.znin) para webp. Falta de arquivo so' avisa."""
    pasta = dados / "graphics" / "worldmap"

    def abrir(nome: str) -> Image.Image | None:
        arq = pasta / f"{nome}.znin"
        if not arq.is_file():
            print(f"AVISO: {arq} nao encontrado")
            return None
        return Image.open(io.BytesIO(decodificar(arq.read_bytes())))

    # Fundo do mundo: o terreno com neblina que o Atlas mostra atras das areas (img/world.png, metade do tamanho do mundo). A ilustracao do jogo (1.znin) estava errada.
    try:
        req = urllib.request.Request(FUNDO_URL, headers={"User-Agent": "NinWiki"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            Image.open(io.BytesIO(resp.read())).convert("RGB").save(destino / "world-bg.webp", quality=80, method=6)
    except OSError as exc:
        print(f"AVISO: fundo do mundo nao baixado ({exc}); ficou o arquivo anterior")
    for mapa_id in scrolls:
        img = abrir(str(mapa_id))
        if img:
            img.save(destino / f"scroll-{mapa_id}.webp", lossless=True, method=6)


def gravar_info_das_areas(atlas: dict, destino: Path, traducoes: dict[str, str]) -> None:
    """Grava `areas-info.json`: por area do Atlas, so' o que o painel do site usa (carregado sob demanda no navegador).

    {names: {id: [en, pt]} (alvos das saidas), areas: {id: {z zona, v vila, h casas, p [[tipo, nome, pt, x, y]] lugares, e [[id destino, direcao]] saidas,
    r [[nome, pt, x, y]] predios/salas, n [[nome, pt]] NPCs, m [[nome, pt, nivel]] mobs, res [[nome, pt, qtd]] recursos}}}.
    """
    pt = lambda n: traducoes.get(n, n)  # noqa: E731
    npcs, recursos = atlas["npcs"], atlas["resources"]
    areas = {}
    for k, m in atlas["maps"].items():
        gente, mobs, vistos = [], [], set()
        for i in m.get("npcs", []):
            n = npcs.get(str(i))
            if not n or n["name"] in vistos:
                continue
            vistos.add(n["name"])
            if n.get("fight"):
                mobs.append([n["name"], pt(n["name"]), n.get("level", 0)])
            else:
                gente.append([n["name"], pt(n["name"])])
        cont: dict[str, int] = {}
        for _, _, rid in m.get("tiles", {}).get("resource", []):
            nome = recursos.get(str(rid), {}).get("name")
            if nome:
                cont[nome] = cont.get(nome, 0) + 1
        areas[k] = {
            "z": m.get("zone", ""), "v": m.get("village", 0), "h": m.get("houses", 0),
            "p": [[p["kind"], p["name"], pt(p["name"]), p["x"], p["y"]] for p in m.get("places", []) if p["kind"] != "leaderboards"],
            "e": [[e["to"], e["dir"]] for e in m.get("exits", [])],
            "r": [[r["name"], pt(r["name"]), r["x"], r["y"]] for r in m.get("rooms", [])],
            "n": gente, "m": mobs, "res": [[n, pt(n), c] for n, c in sorted(cont.items(), key=lambda kv: -kv[1])],
        }
    nomes = {k: [m["name"], pt(m["name"])] for k, m in atlas["maps"].items()}
    (destino / "areas-info.json").write_text(json.dumps({"names": nomes, "areas": areas}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"areas-info.json: {len(areas)} areas ({(destino / 'areas-info.json').stat().st_size / 1e3:.0f} KB)")

# Ordem de importancia dos tipos de marcador (igual ao Atlas): o predio mostra o servico mais importante que tem dentro.
ORDEM_MARCADORES = ["hospital", "bounty", "missions", "boss", "dungeon", "travel", "shop", "mailbox", "notice", "barber", "headbands",
                    "polling", "leaderboards", "wedding", "checkpoint", "capture"]


def _centro(pts: list) -> tuple[float, float]:
    """Media das posicoes [x, y, ...]."""
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def gravar_atlas_do_mundo(atlas: dict, destino: Path, traducoes: dict[str, str]) -> None:
    """Grava `world-atlas.json` (tudo que o mapa-mundi em canvas desenha por cima das areas) e `area-pins.json` (pinos dentro de cada area).

    world-atlas.json: {maps: [{id, x, y, w, h, z zona, v vila, hs casas, lv [min, max] dos mobs de caca ou null}],
    marks: [[tipo, x, y (mundo), id da area, [[tipo, nome, pt, nivel?]...] entradas, [titulo, pt] ou null (predio), id de destino ou 0 (viagem)]],
    routes/edges/soft/regions como no Atlas (routes e regions ganham `pt`)}. Marcadores seguem o cliente: mesmo tipo a ate' 3 blocos
    ou qualquer tipo a ate' 1,5 bloco viram um so'; tudo dentro de um predio vira UM marcador na porta dele.
    area-pins.json: {npcs: [[nome, pt, nivel, chefe]], res: [[nome, pt]], areas: {id: {p lugares [tipo, nome, pt, x, y], r predios [nome, pt, x, y],
    d portas para outras areas do mundo [x, y, id destino], m [x, y, idx de npcs] mobs, n [x, y, idx] NPCs, c [x, y, idx de res, qtd] recursos colhiveis}}}.
    """
    pt = lambda n: traducoes.get(n, n)  # noqa: E731
    mapas, salas, npcs = atlas["maps"], atlas["interiors"], atlas["npcs"]
    marks: list[dict] = []

    def adicionar(m: dict, x: float, y: float, entrada: list) -> None:
        for g in marks:
            lim = 3 if g["k"] == entrada[0] else 1.5
            if g["m"] == m["id"] and not g["t"] and abs(g["x"] - x) <= lim and abs(g["y"] - y) <= lim:
                g["e"].append(entrada)
                return
        marks.append({"k": entrada[0], "x": x, "y": y, "m": m["id"], "e": [entrada], "t": None, "to": 0})

    for m in mapas.values():
        for p in m["places"]:
            adicionar(m, p["x"] + 0.5, p["y"] + 0.5, [p["kind"], p["name"], pt(p["name"])])
        if m["tiles"].get("capture"):
            cx, cy = _centro(m["tiles"]["capture"])
            adicionar(m, cx + 0.5, cy + 0.5, ["capture", "Capture Point", pt("Capture Point")])
        spawns: dict[int, list] = {}
        for x, y, slot in m["tiles"].get("npc", []):
            if m["slots"][slot]:
                spawns.setdefault(m["slots"][slot], []).append([x, y])
        for i in m["npcs"]:
            n = npcs.get(str(i))
            if n and n.get("boss") and n.get("fight"):
                cx, cy = _centro(spawns[i]) if i in spawns else (m["w"] / 2, m["h"] / 2)
                marks.append({"k": "boss", "x": cx + 0.5, "y": cy + 0.5, "m": m["id"], "e": [["boss", n["name"], pt(n["name"]), n.get("level", 0)]], "t": None, "to": 0})
    # Predios: sobe pelos "pais" ate' achar a area do mundo; todos os servicos de dentro viram um marcador na porta de fora.
    por_predio: dict[int, dict] = {}
    for sala in salas.values():
        chefes = [i for i in sala["npcs"] if npcs.get(str(i), {}).get("boss") and npcs[str(i)].get("fight")]
        if not sala["places"] and not chefes:
            continue
        topo = sala
        while topo and str(topo["parent"]) not in mapas:
            topo = salas.get(str(topo["parent"]))
        if not topo or not topo.get("door"):
            continue
        g = por_predio.get(topo["id"])
        if not g:
            g = por_predio[topo["id"]] = {"k": "shop", "x": topo["door"][0] + 0.5, "y": topo["door"][1] + 0.5, "m": topo["parent"], "e": [],
                                          "t": [topo["name"], pt(topo["name"])], "to": 0}
            marks.append(g)
        g["e"] += [[p["kind"], p["name"], pt(p["name"])] for p in sala["places"]]
        g["e"] += [["boss", npcs[str(i)]["name"], pt(npcs[str(i)]["name"]), npcs[str(i)].get("level", 0)] for i in chefes]
    for g in por_predio.values():
        g["k"] = next((k for k in ORDEM_MARCADORES if any(e[0] == k for e in g["e"])), g["k"])
    rotas = []
    for r in atlas["routes"]:
        rotas.append({**r, "pt": pt(r["label"])})
        marks.append({"k": "travel", "x": r["fx"] + 0.5, "y": r["fy"] + 0.5, "m": r["from"], "e": [["travel", r["label"], pt(r["label"])]], "t": None, "to": r["to"]})

    def faixa(m: dict):
        niveis = [npcs[str(i)]["level"] for i in m["npcs"] if str(i) in npcs and npcs[str(i)].get("hunt") and not npcs[str(i)].get("boss")]
        return [min(niveis), max(niveis)] if niveis else None

    lista = [{"id": m["id"], "x": m["x"], "y": m["y"], "w": m["w"], "h": m["h"], "z": m["zone"], "v": m["village"], "hs": m["houses"], "lv": faixa(m)}
             for m in mapas.values() if "x" in m]
    saida = {
        "maps": lista,
        "marks": [[g["k"], g["x"] + mapas[str(g["m"])]["x"], g["y"] + mapas[str(g["m"])]["y"], g["m"], g["e"], g["t"], g["to"]] for g in marks],
        "routes": rotas, "edges": atlas["edges"], "soft": atlas["soft"],
        "regions": [{**r, "pt": pt(r["name"])} for r in atlas["regions"]],
    }
    (destino / "world-atlas.json").write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Pinos dentro de cada area.
    nomes_npc: dict[str, int] = {}
    lista_npc: list = []
    nomes_rec: dict[str, int] = {}
    lista_rec: list = []
    areas: dict[str, dict] = {}
    for k, m in mapas.items():
        if "x" not in m:
            continue
        mobs, gente, cont = [], [], {}
        for x, y, slot in m["tiles"].get("npc", []):
            i = m["slots"][slot]
            n = npcs.get(str(i))
            if not n:
                continue
            idx = nomes_npc.get(str(i))
            if idx is None:
                idx = nomes_npc[str(i)] = len(lista_npc)
                lista_npc.append([n["name"], pt(n["name"]), n.get("level", 0), 1 if n.get("boss") else 0])
            (mobs if n.get("fight") else gente).append([x, y, idx])
        for x, y, rid in m["tiles"].get("resource", []):
            r = atlas["resources"].get(str(rid))
            if not r or not r["loot"]:
                continue   # arvore/arbusto de enfeite: nao rende nada
            idx = nomes_rec.get(r["name"])
            if idx is None:
                idx = nomes_rec[r["name"]] = len(lista_rec)
                lista_rec.append([r["name"], pt(r["name"])])
            cont.setdefault((idx, x // 16, y // 16), [x, y, idx, 0])[3] += 1   # junta recursos iguais da mesma quadra de 16x16
        areas[k] = {
            "p": [[p["kind"], p["name"], pt(p["name"]), p["x"], p["y"]] for p in m["places"] if p["kind"] != "leaderboards"],
            "r": [[r["name"], pt(r["name"]), r["x"], r["y"]] for r in m.get("rooms", [])],
            "d": [[d[0], d[1], d[3]] for d in m.get("doors", []) if str(d[3]) in mapas],
            "m": mobs, "n": gente, "c": list(cont.values()),
        }
    (destino / "area-pins.json").write_text(json.dumps({"npcs": lista_npc, "res": lista_rec, "areas": areas}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"world-atlas.json: {len(marks)} marcadores; area-pins.json: {len(areas)} areas")


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

    # Pergaminhos: so' as vilas que o jogo desenhou (arquivo <id da area>.znin; os ids 1 e 2 sao outros desenhos).
    pergaminhos = [51, 100]
    gravar_arte_do_jogo(dados, destino, pergaminhos)
    try:
        atlas = carregar_atlas(None)
        gravar_info_das_areas(atlas, destino, traducoes)
        gravar_atlas_do_mundo(atlas, destino, traducoes)
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
