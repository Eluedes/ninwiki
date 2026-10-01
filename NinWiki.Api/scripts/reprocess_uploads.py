"""
Reprocessa TODAS as imagens que ja' estao na pasta uploads/, aplicando
o mesmo redimensionamento (max 512px no lado maior, sem esticar) que
o endpoint POST /uploads/image ja' aplica em uploads NOVOS desde a
correcao do redimensionamento automatico.

Existe porque essa correcao so' vale pra uploads NOVOS - imagens que
ja' estavam na pasta antes continuam do tamanho original (borradas,
se a origem era grande demais) ate' rodar isso aqui uma vez.

NAO mexe no banco de dados nem precisa - o nome do arquivo nao muda,
so' o conteudo (os bytes) - toda entry que ja' aponta pra uma dessas
imagens continua apontando pro mesmo arquivo, agora redimensionado.

Uso (dentro de NinWiki.Api, com o venv ativado):
    python scripts/reprocess_uploads.py
"""
import sys
from pathlib import Path

# Deixa "app.api.uploads" importavel rodando este script direto da
# pasta scripts/ (sem isso, o Python nao acha o pacote "app").
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.api.uploads import _resize_image, MAX_IMAGE_DIMENSION  # noqa: E402

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"

EXT_TO_KEY = {".png": ".png", ".jpg": ".jpg", ".jpeg": ".jpg", ".gif": ".gif", ".webp": ".webp"}


def main() -> None:
    """Redimensiona as imagens que ja' estavam em uploads/ (nao mexe no banco; o nome do arquivo nao muda)."""
    if not UPLOAD_DIR.exists():
        print(f"Pasta {UPLOAD_DIR} não existe - nada pra fazer.")
        return

    files = [f for f in UPLOAD_DIR.iterdir() if f.is_file()]
    if not files:
        print("Nenhum arquivo em uploads/ - nada pra fazer.")
        return

    reprocessed = 0
    skipped_gif = 0
    skipped_already_ok = 0
    failed = 0

    for filepath in files:
        ext = EXT_TO_KEY.get(filepath.suffix.lower())
        if ext is None:
            print(f"  ignorado (extensão desconhecida): {filepath.name}")
            continue

        original_bytes = filepath.read_bytes()
        try:
            resized_bytes = _resize_image(original_bytes, ext)
        except Exception as e:
            print(f"  FALHOU: {filepath.name} ({e})")
            failed += 1
            continue

        if ext == ".gif":
            skipped_gif += 1
            continue
        if resized_bytes == original_bytes:
            skipped_already_ok += 1
            continue

        filepath.write_bytes(resized_bytes)
        reprocessed += 1
        print(f"  redimensionado: {filepath.name} ({len(original_bytes)} -> {len(resized_bytes)} bytes)")

    print()
    print(f"Total: {len(files)} arquivos")
    print(f"  Redimensionados agora: {reprocessed}")
    print(f"  Já estavam dentro do limite ({MAX_IMAGE_DIMENSION}px): {skipped_already_ok}")
    print(f"  GIFs (não mexidos, preserva animação): {skipped_gif}")
    print(f"  Falharam: {failed}")


if __name__ == "__main__":
    main()
