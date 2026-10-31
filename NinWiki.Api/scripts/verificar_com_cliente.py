"""
Confere com o CLIENTE do jogo (Nin Online) os NOMES do banco e corrige so' o que o cliente prova errado.

O que o cliente tem: nomes e textos (English.json / Brazilian Portuguese.json). Nao tem dano, custo, cooldown nem recompensas (isso e' do servidor).
Correcoes feitas (todas provadas pelo cliente, idempotentes):
  1. Nome de jutsu com erro de digitacao (ex.: "Techinique") -> nome que o jogo usa (e name_pt do jogo).
  2. name_pt vazio de jutsu/item/arma/mob PUBLICADO -> traducao do jogo (so' quando o jogo tem uma e ela difere do ingles).
  3. name_pt de PUBLICADO que e' igual ao ingles mas o jogo tem traducao diferente -> traducao do jogo.
Tudo o mais (descricoes, numeros, jutsus que o cliente nao conhece) so' e' LISTADO, nunca alterado.

Uso (pasta NinWiki.Api, `$env:PYTHONPATH="."`):
    py scripts/verificar_com_cliente.py             # simulacao (imprime antes -> depois)
    py scripts/verificar_com_cliente.py --aplicar   # grava no banco LOCAL (faca backup antes)
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.enums import ContentStatus
from app.models.masteries import Jutsu
from scripts._guarda_banco import exigir_banco_local

PASTA = Path(r"E:\SteamLibrary\steamapps\common\Nin Online\data files\locales")
# Erros de digitacao conhecidos no wiki -> nome oficial do jogo (cada um conferido na lista JutsuKeys do cliente).
NOMES_JUTSU = {"Phoenix Fireball Techinique": "Phoenix Fireball Technique"}


def norm(t: str) -> str:
    """Minusculas, aspas retas e espacos simples (as chaves do cliente nao diferenciam maiusculas)."""
    return re.sub(r"\s+", " ", (t or "").replace("\u2019", "'").strip().lower())


async def main() -> None:
    ap = argparse.ArgumentParser(description="Corrige nomes/name_pt do banco que o cliente do jogo prova errados.")
    ap.add_argument("--aplicar", action="store_true", help="grava (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="aceita banco nao-local (faca backup antes)")
    ap.add_argument("--cliente", default=str(PASTA))
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    pasta = Path(args.cliente)
    en = json.loads((pasta / "English.json").read_text(encoding="utf-8-sig"), strict=False)
    entradas = json.loads((pasta / "Brazilian Portuguese.json").read_text(encoding="utf-8-sig"), strict=False)["Entries"]
    pt = {norm(a): b for a, b in entradas.items()}
    chaves = {k: {norm(x) for x in en[k]} for k in ("JutsuKeys", "ItemKeys", "NpcNameKeys")}
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")
    mudou = 0

    def traducao(nome: str) -> str | None:
        """Traducao do jogo para o nome (None se nao existe ou se e' igual ao ingles)."""
        t = pt.get(norm(nome))
        return t if t and norm(t) != norm(nome) else None

    async with AsyncSessionLocal() as db:
        jutsus = (await db.execute(select(Jutsu))).scalars().all()
        itens = (await db.execute(select(ContentItem))).scalars().all()
        for j in jutsus:
            novo = NOMES_JUTSU.get(j.name)
            if novo and norm(novo) in chaves["JutsuKeys"]:
                print(f"[jutsu {j.id}] nome: {j.name!r} -> {novo!r}")
                j.name, mudou = novo, mudou + 1
            _corrigir_pt(j, "jutsu", chaves["JutsuKeys"], traducao, lambda: None)
        for i in itens:
            if i.status != ContentStatus.PUBLISHED:
                continue
            fonte = chaves["NpcNameKeys"] if i.category.name == "MOBS" else chaves["ItemKeys"]
            _corrigir_pt(i, i.category.name.lower(), fonte, traducao, lambda: None)
        mudou = sum(1 for o in (*jutsus, *itens) if o in db.dirty)
        print(f"Registros alterados: {mudou}")
        if args.aplicar:
            await db.commit()
        else:
            await db.rollback()
    print("Gravado." if args.aplicar else "Simulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


def _corrigir_pt(obj, tipo: str, fonte: set, traducao, _):
    """Preenche/corrige name_pt de um registro PUBLICADO quando o cliente conhece o nome e tem traducao."""
    if getattr(obj, "status", None) != ContentStatus.PUBLISHED or norm(obj.name) not in fonte:
        return
    t = traducao(obj.name)
    atual = obj.name_pt or ""
    if t and (not atual or norm(atual) == norm(obj.name)) and atual != t:
        print(f"[{tipo} {obj.id}] name_pt: {atual!r} -> {t!r}")
        obj.name_pt = t


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
