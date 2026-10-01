"""
Endpoint de upload de imagem - substitui o campo de texto solto
"caminho da imagem" que existia no editor do painel antes.

Rotas:
  POST /uploads/image   recebe um arquivo, valida e devolve a URL completa

VALIDACAO DE VERDADE, NAO SO' A EXTENSAO: o nome do arquivo (".png")
e' so' o que a pessoa digitou - nao prova nada sobre o CONTEUDO real.
Um arquivo malicioso pode se chamar "foto.png" e ser outra coisa por
dentro. Por isso verificamos a assinatura binaria (os primeiros bytes
do arquivo, tambem chamados de "magic numbers") de cada formato aceito,
em vez de confiar no nome ou no Content-Type que o navegador manda
(que tambem pode ser forjado).

ARMAZENAMENTO: local em disco (pasta uploads/), servido pela propria
API via StaticFiles (ver main.py) - funciona bem para desenvolvimento
local e para o volume pequeno de imagens de um wiki de fã. Se um dia o
volume crescer muito, trocar por um serviço de storage (S3/R2) é uma
troca isolada nesta função - o resto do código não precisa mudar.
"""
import secrets
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.auth import require_permission
from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import Permission
from app.models.users import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Assinatura binaria (primeiros bytes) de cada formato de imagem aceito.
# https://en.wikipedia.org/wiki/List_of_file_signatures
MAGIC_NUMBERS: dict[bytes, str] = {
    b"\x89PNG\r\n\x1a\n": ".png",
    b"\xff\xd8\xff": ".jpg",
    b"GIF87a": ".gif",
    b"GIF89a": ".gif",
}
# WEBP e' um caso especial: comeca com "RIFF", depois 4 bytes de tamanho
# (variam por arquivo), depois "WEBP" - nao da' pra' checar como um
# prefixo fixo unico, precisa de uma verificacao propria (ver abaixo).


class UploadResponse(BaseModel):
    url: str


def _detect_extension(header: bytes) -> str | None:
    """Devolve a extensao certa se os bytes batem com um formato aceito, senao None."""
    for magic, ext in MAGIC_NUMBERS.items():
        if header.startswith(magic):
            return ext
    if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return ".webp"
    return None


# Maior dimensao (largura OU altura, o que for maior) que uma imagem
# enviada pode ter depois de processada - imagens de origem MENORES
# que isso nao sao esticadas (so' diminuimos, nunca aumentamos).
# Escolhido pra bater com o tamanho que as imagens de Armas ja usam,
# que o Rafael apontou como referencia (nao ficam borradas nos cards).
MAX_IMAGE_DIMENSION = 512


def _resize_image(content: bytes, extension: str) -> bytes:
    """
    Redimensiona a imagem pra' nunca passar de MAX_IMAGE_DIMENSION num
    dos lados, mantendo a proporcao original (nunca estica/distorce).
    Sem isso, uma foto/print enviado em resolucao bem maior que o card
    onde ela aparece (ex: 64x64 no catalogo) ficava borrada - o
    navegador tinha que reduzir uma imagem enorme na hora, e' o oposto
    do que queremos (queremos ela ja' no tamanho certo, nitida).

    GIF fica de fora de proposito: um GIF animado tem varios "frames"
    dentro do arquivo, e processar so' com Image.open/save do jeito
    simples aqui perderia a animacao, guardando so' o primeiro frame -
    prefere-se manter o GIF original intacto a quebrar uma animacao.
    """
    if extension == ".gif":
        return content

    with Image.open(BytesIO(content)) as img:
        img.load()
        if img.width <= MAX_IMAGE_DIMENSION and img.height <= MAX_IMAGE_DIMENSION:
            return content  # ja' esta' dentro do limite, nada a fazer

        # thumbnail() reduz MANTENDO a proporcao e NUNCA aumenta uma
        # imagem menor que o limite - exatamente o comportamento que
        # queremos, sem precisar calcular a razao de aspecto a mao.
        img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)

        buffer = BytesIO()
        # Formato de saida espelha o formato de entrada (PNG continua
        # PNG, JPG continua JPG) - preserva transparencia de PNG/WEBP,
        # que viraria fundo preto se tudo fosse forcado pra JPG.
        save_format = {".png": "PNG", ".jpg": "JPEG", ".webp": "WEBP"}[extension]
        if save_format == "JPEG" and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")  # JPEG nao suporta canal alfa (transparencia)
        img.save(buffer, format=save_format, quality=90)
        return buffer.getvalue()


@router.post("/image", response_model=UploadResponse)
async def upload_image(
    file: UploadFile,
    staff: User = Depends(require_permission(Permission.UPLOAD_CREATE)),
    db: AsyncSession = Depends(get_db),
):
    max_bytes = settings.max_upload_size_mb * 1024 * 1024

    # le' o arquivo INTEIRO na memoria de uma vez - aceitavel pro limite
    # de 5MB configurado; se o limite fosse maior (video, por exemplo),
    # o certo seria ler em pedacos (chunks) em vez de tudo de uma vez.
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Arquivo maior que {settings.max_upload_size_mb}MB")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    extension = _detect_extension(content[:16])
    if extension is None:
        raise HTTPException(
            status_code=415,
            detail="Formato de arquivo não reconhecido. Aceitos: PNG, JPG, GIF, WEBP.",
        )

    try:
        content = _resize_image(content, extension)
    except Exception:
        # Arquivo passou na checagem de assinatura binaria mas nao e'
        # uma imagem de verdade que o Pillow consegue abrir (corrompido,
        # ou os bytes batem por coincidencia) - falha com uma mensagem
        # clara em vez de um 500 cru, e NAO salva o arquivo original
        # sem processar.
        raise HTTPException(status_code=400, detail="Não foi possível processar essa imagem.")

    # Nome gerado aleatoriamente - NUNCA usar o nome original do arquivo
    # (file.filename): ele vem do cliente e pode conter coisas como
    # "../../app/main.py" (path traversal) ou caracteres que quebram o
    # sistema de arquivos. token_hex so' produz letras/numeros, seguro
    # de usar direto como nome de arquivo.
    filename = f"{secrets.token_hex(16)}{extension}"
    filepath = UPLOAD_DIR / filename
    filepath.write_bytes(content)

    await log_action(db, action="upload", entity_type="upload", entity_id=filename,
                     diff={"bytes": len(content)}, actor=staff)
    await db.commit()

    return UploadResponse(url=f"{settings.api_base_url}/uploads/{filename}")
