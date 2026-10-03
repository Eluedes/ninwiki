"""
Analisa arquivos de formato desconhecido (ex.: .znin e .wmr) e imprime so' a ESTRUTURA - tamanho, primeiros/ultimos bytes, entropia, assinaturas conhecidas,
palpite de XOR - para descobrir COMO o arquivo foi gerado. NAO decifra nada e NAO imprime o conteudo (so' 48 bytes do inicio e do fim), entao e' seguro
colar a saida no chat.

Roda no SEU computador (so' Python 3, sem instalar nada):
    python analisar_arquivo_cifrado.py  .                      (a pasta onde voce esta: procura .znin e .wmr nela e em TODAS as subpastas)
    python analisar_arquivo_cifrado.py  exemplo.znin exemplo.wmr   (ou arquivos especificos)
    python analisar_arquivo_cifrado.py  . --max 5 --ext .znin      (ate' 5 arquivos por extensao; so' .znin)
    python analisar_arquivo_cifrado.py  . > resultado.txt          (salva a saida num arquivo para colar no chat)
Se "python" nao funcionar no Windows, tente "py" no lugar. Em pastas grandes o script NAO analisa tudo: pega por extensao o menor, o maior e alguns do meio
(padrao --max 3).

Mande a saida inteira. Dicas: use 2 ou 3 arquivos de cada tipo (um pequeno e um grande), e, se puder, o MESMO conteudo salvo duas vezes
(ajuda a ver se ha' IV/sal aleatorio).
"""
import math
import sys
from collections import Counter
from pathlib import Path

MAGICS = {
    b"PK\x03\x04": "ZIP", b"\x1f\x8b": "GZIP", b"\x78\x01": "zlib (sem compressao)", b"\x78\x9c": "zlib (padrao)", b"\x78\xda": "zlib (maxima)",
    b"\x89PNG": "PNG", b"GIF8": "GIF", b"\xff\xd8\xff": "JPEG", b"RIFF": "RIFF (wav/webp/avi)", b"OggS": "OGG", b"7z\xbc\xaf": "7-Zip",
    b"Rar!": "RAR", b"BZh": "BZIP2", b"\xfd7zXZ": "XZ", b"SQLite format 3": "SQLite", b"{": "JSON (comeca com {)", b"[": "JSON/INI (comeca com [)",
    b"<?xml": "XML", b"<": "XML/HTML (comeca com <)", b"MZ": "executavel Windows", b"\x7fELF": "ELF", b"BM": "BMP", b"ID3": "MP3", b"%PDF": "PDF",
}


def entropy(data: bytes) -> float:
    """Entropia de Shannon em bits por byte (0 = tudo igual, 8 = aleatorio/comprimido/cifrado)."""
    if not data:
        return 0.0
    n = len(data)
    return -sum(c / n * math.log2(c / n) for c in Counter(data).values())


def hexline(b: bytes) -> str:
    """Bytes em hexadecimal, 16 por linha, com o texto ASCII ao lado."""
    out = []
    for i in range(0, len(b), 16):
        chunk = b[i:i + 16]
        out.append(f"  {i:04x}  {' '.join(f'{x:02x}' for x in chunk):<47}  {''.join(chr(x) if 32 <= x < 127 else '.' for x in chunk)}")
    return "\n".join(out)


def find_magic(data: bytes, limit: int = 64) -> list[str]:
    """Assinaturas conhecidas nos primeiros `limit` bytes (e onde)."""
    found = []
    for magic, name in MAGICS.items():
        pos = data.find(magic, 0, limit)
        if pos != -1 and len(magic) >= 2:
            found.append(f"{name} no byte {pos}")
    return found


def xor_single_guess(data: bytes) -> list[str]:
    """Para cada chave de 1 byte (0-255), ve se o inicio vira uma assinatura conhecida."""
    hits = []
    head = data[:16]
    for key in range(256):
        dec = bytes(b ^ key for b in head)
        for magic, name in MAGICS.items():
            if (len(magic) >= 3 or name.startswith(("zlib", "GZIP"))) and dec.startswith(magic):
                hits.append(f"XOR 0x{key:02x} -> {name}")
    return hits


def key_length_guess(data: bytes, max_len: int = 64) -> list[tuple[int, float]]:
    """Palpite do tamanho de uma chave XOR repetida (indice de coincidencia medio por coluna; quanto maior, mais provavel)."""
    sample = data[:20000]
    scores = []
    for k in range(1, max_len + 1):
        total, cols = 0.0, 0
        for c in range(k):
            col = sample[c::k]
            n = len(col)
            if n < 20:
                continue
            total += sum(v * (v - 1) for v in Counter(col).values()) / (n * (n - 1))
            cols += 1
        if cols:
            scores.append((k, total / cols))
    return sorted(scores, key=lambda t: -t[1])[:4]


def analyze(path: Path) -> bytes:
    """Imprime a analise de UM arquivo e devolve os primeiros bytes (para comparar cabecalhos)."""
    data = path.read_bytes()
    print("=" * 70)
    print(f"{path.name}  ({len(data)} bytes)")
    print(f"entropia total: {entropy(data):.3f} bits/byte | primeiros 4 KB: {entropy(data[:4096]):.3f} | ultimos 4 KB: {entropy(data[-4096:]):.3f}")
    print("primeiros bytes:\n" + hexline(data[:48]))
    print("ultimos bytes:\n" + hexline(data[-48:]))
    print("assinaturas no inicio (arquivo como esta'):", ", ".join(find_magic(data)) or "nenhuma (nao e' um formato conhecido em texto claro)")
    hits = xor_single_guess(data)
    print("XOR de 1 byte revela algo?", "; ".join(hits) if hits else "nao")
    print("palpite de tamanho de chave XOR repetida (tamanho: pontuacao):", ", ".join(f"{k}: {s:.4f}" for k, s in key_length_guess(data)))
    h = entropy(data[:4096])
    if h > 7.8:
        print("leitura: entropia ~8 -> cifra forte (AES etc.) ou dado comprimido; XOR simples e' improvavel.")
    elif h > 6.5:
        print("leitura: entropia alta mas nao maxima -> pode ser compressao, ou cifra fraca/XOR sobre dado com padrao.")
    else:
        print("leitura: entropia baixa -> provavelmente texto/estrutura pouco ofuscada ou XOR com chave curta/constante.")
    return data[:48]


def main() -> None:
    """Analisa os arquivos (ou a pasta) indicados na linha de comando."""
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    args = sys.argv[1:]
    max_per_ext, exts = 3, {".znin", ".wmr"}
    if "--max" in args:
        i = args.index("--max")
        max_per_ext = max(1, int(args[i + 1]))
        del args[i:i + 2]
    custom = set()
    while "--ext" in args:
        i = args.index("--ext")
        custom.add(args[i + 1].lower() if args[i + 1].startswith(".") else "." + args[i + 1].lower())
        del args[i:i + 2]
    exts = custom or exts
    files: list[Path] = []
    for arg in args:
        p = Path(arg)
        if p.is_dir():
            found = [f for f in p.rglob("*") if f.is_file() and f.suffix.lower() in exts]   # recursivo: entra nas subpastas
            by_ext: dict[str, list[Path]] = {}
            for f in found:
                by_ext.setdefault(f.suffix.lower(), []).append(f)
            for ext, group in by_ext.items():
                group.sort(key=lambda f: f.stat().st_size)
                step = max(1, len(group) // max_per_ext)
                pick = {group[0], group[-1], *group[::step][:max_per_ext]}   # menor, maior e alguns do meio
                chosen = sorted(pick, key=lambda f: f.stat().st_size)[:max_per_ext + 1]
                print(f"{ext}: {len(group)} arquivo(s) em {p}; analisando {len(chosen)}")
                files += chosen
            if not found:
                print(f"! nenhum arquivo {', '.join(sorted(exts))} encontrado em {p} (nem nas subpastas)")
        else:
            files.append(p)
    heads: dict[str, list[bytes]] = {}
    for f in files:
        if f.is_file():
            heads.setdefault(f.suffix.lower(), []).append(analyze(f))
        else:
            print(f"! nao encontrei {f}")
    for ext, hs in heads.items():
        if len(hs) > 1:
            n = 0
            while n < min(len(h) for h in hs) and len({h[n] for h in hs}) == 1:
                n += 1
            print("=" * 70)
            print(f"{ext}: {len(hs)} arquivos; os primeiros {n} byte(s) sao IGUAIS em todos (cabecalho/assinatura fixa?)" + (f": {hs[0][:n].hex(' ')}" if n else ""))


if __name__ == "__main__":
    main()
