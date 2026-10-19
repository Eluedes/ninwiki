"""
Converte as imagens `.znin` do cliente do jogo (Nin Online) em PNG normal.

O QUE E' UM .znin: nao e' criptografia, e' um PNG COMPRIMIDO com LZ4 (formato de bloco). O arquivo e':
    4 bytes  assinatura fixa (9d ae 4f 8a)
    4 bytes  tamanho do PNG original (inteiro de 32 bits, little-endian)
    resto    o PNG, em bloco LZ4 (sequencias "token + literais + deslocamento", sem moldura)
Por isso o PNG sai IDENTICO ao original (nenhuma recompressao, nada se perde). Cada arquivo e' conferido: o tamanho tem que bater com o do cabecalho, a assinatura
PNG tem que estar la' e a imagem tem que abrir. O que falhar e' listado no fim (e nada e' gravado para ele).

NAO mexe no cliente do jogo: so' LE a pasta de origem e grava na de destino, com as mesmas subpastas (ex.: items/1.znin -> items/1.png).

Uso (pasta NinWiki.Api, venv ativado):
    python scripts/decodificar_znin.py                       # tudo de graphics/ para a pasta padrao de destino
    python scripts/decodificar_znin.py --origem "E:\\Nin Online - Wiki\\data files\\graphics\\items" --destino C:\\saida\\items
    python scripts/decodificar_znin.py --forcar              # regrava os que ja existem (padrao: pula)
"""
import argparse
import io
import struct
import sys
import time
from pathlib import Path

from PIL import Image

ORIGEM_PADRAO = r"E:\Nin Online - Wiki\data files\graphics"
DESTINO_PADRAO = r"C:\Users\User\Desktop\Wiki-Image\graphics_png"
ASSINATURA = bytes.fromhex("9dae4f8a")
PNG = b"\x89PNG\r\n\x1a\n"


def lz4_bloco(src: bytes) -> bytes:
    """Descomprime um bloco LZ4 (sem moldura). Levanta ValueError se o bloco estiver truncado ou corrompido."""
    out = bytearray()
    i, n = 0, len(src)
    try:
        while i < n:
            token = src[i]
            i += 1
            literais = token >> 4
            if literais == 15:   # tamanho estendido: soma bytes ate' vir um menor que 255
                while True:
                    b = src[i]
                    i += 1
                    literais += b
                    if b != 255:
                        break
            out += src[i:i + literais]
            i += literais
            if i >= n:   # o ultimo bloco so' tem literais
                break
            deslocamento = src[i] | (src[i + 1] << 8)
            i += 2
            copia = token & 15
            if copia == 15:
                while True:
                    b = src[i]
                    i += 1
                    copia += b
                    if b != 255:
                        break
            copia += 4
            inicio = len(out) - deslocamento
            if deslocamento == 0 or inicio < 0:
                raise ValueError("deslocamento invalido")
            if deslocamento >= copia:
                out += out[inicio:inicio + copia]
            else:   # copia que se sobrepoe (repete um trecho curto): byte a byte
                for k in range(copia):
                    out.append(out[inicio + k])
    except IndexError as exc:
        raise ValueError("bloco truncado") from exc
    return bytes(out)


def decodificar(dados: bytes) -> bytes:
    """Devolve o PNG de dentro de um .znin (e confere tamanho, assinatura PNG e se a imagem abre)."""
    if dados[:4] != ASSINATURA:
        raise ValueError("assinatura desconhecida")
    esperado = struct.unpack("<I", dados[4:8])[0]
    png = lz4_bloco(dados[8:])
    if len(png) != esperado:
        raise ValueError(f"tamanho {len(png)} != {esperado} do cabecalho")
    if not png.startswith(PNG):
        raise ValueError("nao e' um PNG")
    with Image.open(io.BytesIO(png)) as img:
        img.load()   # abre de verdade (pega dado corrompido)
    return png


def main() -> None:
    """Percorre a origem, converte cada .znin e imprime o resumo."""
    ap = argparse.ArgumentParser(description="Converte os .znin do cliente do jogo em PNG.")
    ap.add_argument("--origem", default=ORIGEM_PADRAO, help="pasta (ou arquivo) de origem; padrao: %(default)s")
    ap.add_argument("--destino", default=DESTINO_PADRAO, help="pasta de destino; padrao: %(default)s")
    ap.add_argument("--forcar", action="store_true", help="regrava os PNG que ja existem")
    args = ap.parse_args()

    origem, destino = Path(args.origem), Path(args.destino)
    if not origem.exists():
        sys.exit(f"Origem nao encontrada: {origem}")
    arquivos = [origem] if origem.is_file() else sorted(origem.rglob("*.znin"))
    raiz = origem.parent if origem.is_file() else origem
    print(f"{len(arquivos)} arquivos .znin em {origem}\nDestino: {destino}")

    ok = pulados = 0
    falhas: list[tuple[str, str]] = []
    pastas: dict[str, int] = {}
    inicio = time.time()
    for n, caminho in enumerate(arquivos, 1):
        relativo = caminho.relative_to(raiz).with_suffix(".png")
        saida = destino / relativo
        if saida.exists() and not args.forcar:
            pulados += 1
            continue
        try:
            png = decodificar(caminho.read_bytes())
        except (ValueError, OSError) as exc:
            falhas.append((str(caminho.relative_to(raiz)), str(exc)))
            continue
        saida.parent.mkdir(parents=True, exist_ok=True)
        saida.write_bytes(png)
        ok += 1
        pasta = relativo.parts[0] if len(relativo.parts) > 1 else "."
        pastas[pasta] = pastas.get(pasta, 0) + 1
        if n % 1000 == 0:
            print(f"  {n}/{len(arquivos)}...")

    print(f"\nConvertidos: {ok} | ja existiam (pulados): {pulados} | falharam: {len(falhas)} | {time.time() - inicio:.0f}s")
    for pasta, qtd in sorted(pastas.items(), key=lambda kv: -kv[1])[:12]:
        print(f"  {pasta:<22} {qtd}")
    if falhas:
        print("\nFalharam (nada foi gravado para estes):")
        for nome, motivo in falhas[:20]:
            print(f"  {nome}: {motivo}")
        if len(falhas) > 20:
            print(f"  ... e mais {len(falhas) - 20}")


if __name__ == "__main__":
    main()
