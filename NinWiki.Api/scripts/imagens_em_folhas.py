"""
Ajuda a identificar e nomear milhares de icones SEM pagar API: monta "folhas de contato" numeradas para voce mandar ao Claude (no chat) e
renomeia os arquivos com as respostas.

Roda no SEU computador, com a pasta das imagens originais, ANTES de enviar ao painel (nada disso vai para a SquareCloud).

PASSO A PASSO
  1) Gerar as folhas (imagens iguais pixel a pixel contam uma vez so'):
       python scripts/imagens_em_folhas.py folhas  C:\\imagens  C:\\folhas  --por-folha 100
     Cria C:\\folhas\\folha_001.png ... (cada icone ampliado, com um numero) e C:\\folhas\\indice.csv (numero -> arquivo).
  2) Mande as folhas para o Claude no chat (algumas por mensagem) pedindo: "responda em CSV: numero,tipo,nome".
     Tipos sugeridos: weapon, clothing, consumable, currency, material, ring, other.
  3) Salve a resposta como C:\\folhas\\respostas.csv e confira com o ensaio (nao muda nada):
       python scripts/imagens_em_folhas.py renomear  C:\\imagens  C:\\folhas  C:\\folhas\\respostas.csv
     Estando certo, rode de novo com --aplicar: os arquivos viram  tipo-nome-numero.png  (duplicadas recebem o mesmo nome).
  3) Envie a pasta pelo painel (Admin > Images): o nome do arquivo vira o nome da imagem na biblioteca, e voce acha tudo pela busca.
Limite honesto: o Claude reconhece a FORMA do icone (espada, pocao, moeda...), nao o nome oficial no jogo; revise o que parecer estranho.
"""
import argparse
import csv
import hashlib
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
CELL = 112      # tamanho de cada icone na folha (ampliado)
LABEL_H = 18    # faixa do numero embaixo do icone
PAD = 6


def _images(folder: Path) -> list[Path]:
    """Imagens da pasta (so' o nivel de cima), em ordem de nome."""
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in EXTS)


def _pixel_hash(path: Path) -> str | None:
    """Impressao digital do desenho (tamanho + pixels RGBA); None se o arquivo nao abre como imagem."""
    try:
        with Image.open(path) as img:
            rgba = img.convert("RGBA")
            return hashlib.sha1(f"{rgba.size}".encode() + rgba.tobytes()).hexdigest()
    except Exception:
        return None


def _slug(text: str, limit: int = 50) -> str:
    """Nome seguro de arquivo: minusculas, sem acento, so' letras/numeros/hifen."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text[:limit].strip("-")


def _unique(folder: Path) -> list[tuple[int, Path, list[Path]]]:
    """[(numero, arquivo representante, [todos os arquivos com o mesmo desenho])], numerados a partir de 1 na ordem de nome."""
    groups: dict[str, list[Path]] = {}
    for p in _images(folder):
        h = _pixel_hash(p)
        if h is not None:
            groups.setdefault(h, []).append(p)
    return [(i, files[0], files) for i, files in enumerate(groups.values(), start=1)]


def cmd_folhas(src: Path, out: Path, per_sheet: int) -> None:
    """Gera as folhas numeradas e o indice.csv."""
    out.mkdir(parents=True, exist_ok=True)
    items = _unique(src)
    if not items:
        sys.exit("Nenhuma imagem encontrada nessa pasta.")
    cols = 10
    cell_w, cell_h = CELL + PAD, CELL + LABEL_H + PAD
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    with open(out / "indice.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["numero", "arquivo_principal", "copias_iguais"])
        for n, rep, files in items:
            w.writerow([n, rep.name, len(files) - 1])
    sheets = 0
    for start in range(0, len(items), per_sheet):
        chunk = items[start:start + per_sheet]
        rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell_w + PAD, rows * cell_h + PAD), (40, 40, 48))
        draw = ImageDraw.Draw(sheet)
        for k, (n, rep, _files) in enumerate(chunk):
            x, y = PAD + (k % cols) * cell_w, PAD + (k // cols) * cell_h
            try:
                with Image.open(rep) as img:
                    icon = img.convert("RGBA")
            except Exception:
                continue
            scale = max(1, min(CELL // max(icon.size), 8)) if max(icon.size) <= CELL else 1
            icon = icon.resize((icon.width * scale, icon.height * scale), Image.NEAREST)
            if max(icon.size) > CELL:
                icon.thumbnail((CELL, CELL))
            draw.rectangle([x, y, x + CELL, y + CELL], fill=(88, 88, 100))
            sheet.paste(icon, (x + (CELL - icon.width) // 2, y + (CELL - icon.height) // 2), icon)
            draw.text((x + CELL // 2 - 14, y + CELL + 1), str(n), fill=(255, 255, 255), font=font)
        sheets += 1
        sheet.save(out / f"folha_{sheets:03d}.png")
    total_files = sum(len(f) for _, _, f in items)
    print(f"{total_files} imagens -> {len(items)} desenhos diferentes -> {sheets} folha(s) em {out}")


def cmd_renomear(src: Path, out: Path, answers: Path, apply: bool) -> None:
    """Renomeia os arquivos segundo respostas.csv (numero,tipo,nome). Sem --aplicar so' mostra o que faria."""
    items = {n: (rep, files) for n, rep, files in _unique(src)}
    index = {}
    with open(out / "indice.csv", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            index[int(row["numero"])] = row["arquivo_principal"]
    plan: list[tuple[Path, Path]] = []
    seen_targets: set[Path] = set()
    with open(answers, encoding="utf-8-sig") as fh:
        rows = [r for r in csv.reader(fh) if r and r[0].strip().isdigit()]
    for r in rows:
        n = int(r[0])
        tipo, nome = _slug(r[1] if len(r) > 1 else "", 20), _slug(r[2] if len(r) > 2 else "")
        if n not in items or not tipo:
            print(f"! ignorado (numero {n} desconhecido ou sem tipo)")
            continue
        if index.get(n) != items[n][0].name:
            sys.exit(f"A pasta mudou desde que as folhas foram feitas (numero {n}). Gere as folhas de novo.")
        for k, path in enumerate(items[n][1]):
            base = "-".join(x for x in (tipo, nome, str(n)) if x) + (f"-copia{k}" if k else "")
            target = path.with_name(base + path.suffix.lower())
            if target in seen_targets or (target.exists() and target != path):
                print(f"! conflito de nome, pulado: {target.name}")
                continue
            seen_targets.add(target)
            if target != path:
                plan.append((path, target))
    for old, new in plan[:15]:
        print(f"{old.name}  ->  {new.name}")
    if len(plan) > 15:
        print(f"... e mais {len(plan) - 15}")
    print(f"{len(plan)} arquivo(s) para renomear de {len(rows)} resposta(s).")
    if not apply:
        print("Ensaio: nada foi alterado. Rode de novo com --aplicar para renomear.")
        return
    for old, new in plan:
        old.rename(new)
    print("Renomeado.")


def main() -> None:
    """Le a linha de comando e chama folhas ou renomear."""
    ap = argparse.ArgumentParser(description="Folhas de contato numeradas e renomeacao em lote (gratis).")
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("folhas", help="gera as folhas numeradas")
    f.add_argument("pasta_imagens", type=Path)
    f.add_argument("pasta_saida", type=Path)
    f.add_argument("--por-folha", type=int, default=100, help="icones por folha (padrao 100)")
    r = sub.add_parser("renomear", help="renomeia os arquivos com as respostas")
    r.add_argument("pasta_imagens", type=Path)
    r.add_argument("pasta_saida", type=Path)
    r.add_argument("respostas", type=Path)
    r.add_argument("--aplicar", action="store_true", help="de fato renomeia (sem isso so' mostra o que faria)")
    a = ap.parse_args()
    if a.cmd == "folhas":
        cmd_folhas(a.pasta_imagens, a.pasta_saida, max(10, a.por_folha))
    else:
        cmd_renomear(a.pasta_imagens, a.pasta_saida, a.respostas, a.aplicar)


if __name__ == "__main__":
    main()
