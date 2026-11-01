"""
Da' NOME as imagens do banco de imagens que ainda estao SEM nome, usando o nome da pagina PUBLICADA que usa a imagem
(item/arma/mob publicado, mastery, clan, vila).

Regras (so' o que da' para ter certeza):
  - so' mexe em imagem com nome VAZIO (nome ja' digitado ou `N_item` do Atlas nao e' tocado);
  - a imagem precisa ser o campo de imagem de paginas PUBLICADAS; se paginas com NOMES DIFERENTES dividem a mesma imagem (ex.: todos os "Manual"), pula (ambiguo);
  - 2o passo: imagem ainda sem nome com os MESMOS PIXELS de uma imagem que ja' tem nome (copia criada por importacao) herda esse nome, como `Nome [id]`
    (precisa dos arquivos em uploads/, entao so' funciona onde eles estao: o computador local);
  - nome ja' em uso por outra imagem vira `Nome [id]`; maximo de 80 caracteres.

Por padrao e' SIMULACAO. Grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes: pg_dump -Fc).
O script liga pelo NOME DO ARQUIVO (nao pelo numero), entao funciona igual na producao.

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/nomear_imagens_publicadas.py                 # simulacao
    python scripts/nomear_imagens_publicadas.py --aplicar       # grava no banco local
    python scripts/nomear_imagens_publicadas.py --aplicar --permitir-remoto
"""
import argparse
import asyncio
import hashlib
import re

from PIL import Image
from sqlalchemy import select

from app.api.uploads import UPLOAD_DIR
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.enums import ContentStatus
from app.models.masteries import Mastery
from app.models.media import MediaImage
from app.models.villages import Clan, Village
from scripts._guarda_banco import exigir_banco_local

LIMITE = 80   # tamanho maximo de media_images.name
ARQUIVO = re.compile(r"/uploads/([0-9a-f]{32}\.\w+)")


def arquivo_de(valor: str | None) -> str | None:
    """Nome do arquivo (`<32 hex>.png`) dentro de um endereco de imagem, ou None."""
    achou = ARQUIVO.search(valor or "")
    return achou.group(1) if achou else None


def impressao(arquivo: str) -> str | None:
    """Impressao digital dos PIXELS do arquivo (None se nao abrir): duas imagens iguais na tela dao a mesma, mesmo com nomes de arquivo diferentes."""
    try:
        with Image.open(UPLOAD_DIR / arquivo) as im:
            im = im.convert("RGBA")
            return hashlib.md5(im.tobytes() + str(im.size).encode()).hexdigest()
    except (OSError, ValueError):
        return None


async def nomes_por_arquivo(db) -> dict[str, set[str]]:
    """{arquivo: {nomes das paginas publicadas que usam como imagem principal}}."""
    usos: dict[str, set[str]] = {}
    fontes = [
        select(ContentItem.image, ContentItem.name).where(ContentItem.status == ContentStatus.PUBLISHED),
        select(Mastery.image, Mastery.name),
        select(Clan.image, Clan.name),
        select(Village.image, Village.name),
    ]
    for consulta in fontes:
        for imagem, nome in (await db.execute(consulta)).all():
            arq = arquivo_de(imagem)
            if arq and nome:
                usos.setdefault(arq, set()).add(nome.strip())
    return usos


async def main() -> None:
    """Simula (ou grava com --aplicar) os nomes das imagens sem nome."""
    ap = argparse.ArgumentParser(description="Da' nome as imagens sem nome pelo nome da pagina publicada que as usa.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        usos = await nomes_por_arquivo(db)
        imagens = (await db.execute(select(MediaImage).order_by(MediaImage.id))).scalars().all()
        ocupados = {m.name for m in imagens if m.name}
        nomeadas = ambiguas = sem_uso = copias = 0
        por_pixels = {}   # impressao -> nome da 1a imagem JA' nomeada com esses pixels
        for m in imagens:
            if m.name:
                por_pixels.setdefault(impressao(m.filename), m.name)
        exemplos: list[str] = []
        for m in imagens:
            if m.name:
                continue
            nomes = usos.get(m.filename)
            if not nomes:
                original = por_pixels.get(impressao(m.filename))
                if original is None:
                    sem_uso += 1
                    continue
                novo = f"{original[:LIMITE - len(f' [{m.id}]')].rstrip()} [{m.id}]"
                ocupados.add(novo)
                copias += 1
                if len(exemplos) < 8:
                    exemplos.append(f"  #{m.id} (copia): {novo}")
                if args.aplicar:
                    m.name = novo
                continue
            if len(nomes) > 1:
                ambiguas += 1
                continue
            base = next(iter(nomes))[:LIMITE].rstrip()
            novo = base if base not in ocupados else f"{base[:LIMITE - len(f' [{m.id}]')].rstrip()} [{m.id}]"
            ocupados.add(novo)
            nomeadas += 1
            if len(exemplos) < 8:
                exemplos.append(f"  #{m.id}: {novo}")
            if args.aplicar:
                m.name = novo
        if args.aplicar:
            await db.commit()
    print(f"Nomeadas pela pagina publicada: {nomeadas} | copias de imagem ja' nomeada: {copias} | ambiguas (puladas): {ambiguas} | sem nome possivel: {sem_uso}")
    print("\n".join(exemplos))


if __name__ == "__main__":
    asyncio.run(main())
