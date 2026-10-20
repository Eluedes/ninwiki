"""
Da' ao banco de imagens o NOME do item (como no Nin Atlas) e remove as COPIAS que os scripts do Atlas criaram sem querer.

O QUE FAZ (nesta ordem):
  1. REMOVE COPIAS: imagem criada pelos scripts do Atlas (enviada por "Atlas") cujos pixels sao IGUAIS aos de uma imagem que ja existia no banco (mesmo que voce a tenha renomeado, ex.:
     `Sukarabe Omo Fan`). As paginas que usavam a copia passam a usar a original; a copia (linha e arquivo) so' e' apagada se nada mais a usa (senao fica e e' avisada).
  2. RENOMEIA as imagens que ainda tem o nome-padrao `N_item` / `N_fundo` (N = numero do icone no cliente) para o nome do item no seu padrao:
         N_item  -> `Nome do item`          N_fundo -> `Nome do item_fundo`
     So' renomeia quando o icone e' de UM item do Atlas (a ligacao e' feita comparando as imagens: scripts/atlas_icones.py). NAO renomeia: icone que varios itens dividem (ex.: todos os "Manual",
     o nome seria ambiguo), icone que nenhum item do Atlas usa, e imagem que voce ja renomeou. Se o nome ja' estiver em uso por outra imagem (itens diferentes com o mesmo nome no jogo), vira `Nome [N]`.
Categoria, arquivo e tudo mais ficam como estao. Os outros scripts reconhecem a imagem pelo CONTEUDO, entao renomear nao os confunde.

Por padrao e' SIMULACAO (so' conta e mostra exemplos); grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/nomear_imagens_atlas.py                 # simulacao
    python scripts/nomear_imagens_atlas.py --aplicar       # grava no banco local
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

from sqlalchemy import select

from app.api.media import _usage
from app.api.uploads import UPLOAD_DIR
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.media import MediaImage
from scripts._guarda_banco import exigir_banco_local
from scripts.atlas_icones import CLIENTE_PADRAO, identificar_imagens, itens_por_icone, mapa_icones
from scripts.sincronizar_imagens_atlas import USUARIO, carregar_atlas

NOME_PADRAO = re.compile(r"^(\d+)_(item|fundo)$")
LIMITE = 80   # tamanho maximo do nome no banco (media_images.name)


def nome_final(base: str, icone: str, ocupados: set[str]) -> tuple[str, str]:
    """(nome do item, nome do fundo) para `base`; se algum dos dois ja' esta' em uso, usa `base [icone]`. Corta o que passar de 80 caracteres."""
    for sufixo in ("", f" [{icone}]"):
        corte = LIMITE - len("_fundo") - len(sufixo)
        item = base[:corte].rstrip() + sufixo
        fundo = item + "_fundo"
        if item not in ocupados and fundo not in ocupados:
            return item, fundo
    return f"{base[:LIMITE - 20].rstrip()} [{icone}]", f"{base[:LIMITE - 20].rstrip()} [{icone}]_fundo"


async def main() -> None:
    """Simula (ou grava com --aplicar) a remocao das copias e a renomeacao das imagens."""
    ap = argparse.ArgumentParser(description="Renomeia as imagens pelo nome do item do Atlas e remove copias criadas pelos scripts do Atlas.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    ap.add_argument("--atlas", help="arquivo atlas.js local, em vez de baixar")
    ap.add_argument("--cliente", default=CLIENTE_PADRAO, help="pasta graphics/items do cliente do jogo (padrao: %(default)s)")
    args = ap.parse_args()

    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    atlas = carregar_atlas(args.atlas)
    por_icone = itens_por_icone(mapa_icones(atlas, Path(args.cliente)))
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    apagar_arquivos: list[str] = []
    async with AsyncSessionLocal() as db:
        imagens = (await db.execute(select(MediaImage).order_by(MediaImage.id))).scalars().all()
        identificadas = identificar_imagens(imagens, UPLOAD_DIR, Path(args.cliente))

        # 1) copias criadas pelos scripts do Atlas de uma imagem que ja' existia
        originais: dict[tuple[str, str], MediaImage] = {}
        for m in imagens:
            if m.uploaded_by != USUARIO and m.id in identificadas:
                originais.setdefault(identificadas[m.id], m)
        copias = [m for m in imagens if m.uploaded_by == USUARIO and m.id in identificadas and identificadas[m.id] in originais]
        removidas = religadas = mantidas = 0
        for c in copias:
            original = originais[identificadas[c.id]]
            paginas = (await db.execute(select(ContentItem).where(ContentItem.image.like(f"%/uploads/{c.filename}%")))).scalars().all()
            religadas += len(paginas)
            print(f"  copia #{c.id} '{c.name}' = #{original.id} '{original.name}' ({len(paginas)} pagina(s) usam a copia)")
            if not args.aplicar:
                removidas += 1
                continue
            for p in paginas:
                p.image = p.image.replace(c.filename, original.filename)
            await db.flush()
            if await _usage(db, c.filename):
                mantidas += 1   # ainda aparece em algum texto/campo: nao apaga
                print(f"     #{c.id} ainda e' usada em outro lugar: mantida")
                continue
            apagar_arquivos.append(c.filename)
            await db.delete(c)
            removidas += 1
        print(f"1) Copias: {len(copias)} encontradas | {'removidas' if args.aplicar else 'seriam removidas'}: {removidas} | paginas religadas para a original: {religadas}" + (f" | mantidas: {mantidas}" if mantidas else ""))

        # 2) renomear as que ainda tem o nome-padrao
        ids_copias = {c.id for c in copias}
        ocupados = {m.name for m in imagens if m.id not in ids_copias and not NOME_PADRAO.match(m.name or "")}
        por_numero: dict[str, dict[str, MediaImage]] = {}
        for m in imagens:
            achou = NOME_PADRAO.match(m.name or "")
            if achou and m.id not in ids_copias:
                por_numero.setdefault(achou.group(1), {})[achou.group(2)] = m
        renomear = compartilhados = sem_item = colisoes = 0
        exemplos: list[str] = []
        for icone in sorted(por_numero, key=int):
            itens = por_icone.get(icone, [])
            if not itens:
                sem_item += len(por_numero[icone])
                continue
            if len(itens) > 1:
                compartilhados += len(por_numero[icone])
                continue
            base = atlas["items"][itens[0]]["name"].strip()
            item, fundo = nome_final(base, icone, ocupados)
            if item != base[:LIMITE - len("_fundo")].rstrip():
                colisoes += 1
            ocupados.update({item, fundo})
            for tipo, novo in (("item", item), ("fundo", fundo)):
                m = por_numero[icone].get(tipo)
                if m is None:
                    continue
                renomear += 1
                if len(exemplos) < 8:
                    exemplos.append(f"#{m.id} {m.name} -> {novo}")
                if args.aplicar:
                    m.name = novo
        print(f"2) Renomear: {renomear} imagens {'renomeadas' if args.aplicar else 'seriam renomeadas'} ({colisoes} icones com nome repetido ganharam [N]) | "
              f"nao renomeadas: {compartilhados} de icone compartilhado, {sem_item} de icone que nenhum item do Atlas usa")
        for e in exemplos:
            print("     ", e)

        if args.aplicar:
            await db.commit()
            for arquivo in apagar_arquivos:
                (UPLOAD_DIR / arquivo).unlink(missing_ok=True)
            print("\nGravado.")
        else:
            print("\nSimulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
