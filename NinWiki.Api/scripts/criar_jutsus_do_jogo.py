"""
Cria, como RASCUNHO, os jutsus que existem no jogo e ainda nao tem pagina no wiki - so' o NOME (ingles e portugues). O resto da ficha (mastery, nivel, dano,
descricao...) fica vazio para a equipe preencher no painel; como rascunho, nada disso aparece no site ate publicar.

DE ONDE VEM: a lista `JutsuKeys` do idioma do jogo (English.json) - nomes de jutsu e tambem alguns textos soltos, que sao filtrados. O nome em portugues vem
do `Entries` do Brazilian Portuguese.json. O jogo nao traz descricao ligada ao jutsu, entao ela nao e' criada.
Nome com "(NPC)" vira Jutsu NPC (is_npc) com id terminado em -npc. Quem ja existe no wiki (mesmo nome, ignorando "(NPC)", Technique/Jutsu) e' pulado.

Por padrao e' SIMULACAO; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto (faca um backup antes).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/criar_jutsus_do_jogo.py                 # simulacao
    python scripts/criar_jutsus_do_jogo.py --aplicar       # grava no banco local
"""
import argparse
import asyncio
import json
import re
import sys
import unicodedata
from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.enums import ContentStatus
from app.models.masteries import Jutsu
from scripts._guarda_banco import exigir_banco_local

PASTA_IDIOMAS = Path(r"E:\Nin Online - Wiki\data files\locales")
ICONE_PADRAO = "sparkles"
ABREVIACOES = {"AGI", "FORT", "CHK", "INT", "STR", "ALL", "DEX", "VIT", "LUK", "CHAKRA"}
SUFIXO_NPC = re.compile(r"\s*\(\s*NPC\s*\)\s*$", re.IGNORECASE)


def carregar(arquivo: str) -> dict:
    """JSON de idioma do jogo."""
    return json.loads((PASTA_IDIOMAS / arquivo).read_text(encoding="utf-8-sig"))


def parece_nome_de_jutsu(texto: str) -> bool:
    """True se o texto da lista parece o NOME de um jutsu (e nao um titulo de secao, um efeito ou uma frase)."""
    t = texto.strip()
    if len(t) < 3 or len(t) > 60:
        return False
    if t.upper() in ABREVIACOES or t[0].isdigit() or t[0] in "-+:&(":
        return False
    if any(c in t for c in "+:&%/[]{}<>=") or t.endswith((".", "!", "?")):
        return False
    if len(t.split()) > 5 or t.split()[0].lower() in {"a", "an", "the", "this", "that", "your", "you", "when", "if"}:
        return False
    if "effects" in t.lower() or "test" in t.lower() or "event" in t.lower():
        return False
    return True


def normalizar(nome: str) -> str:
    """Chave para comparar nomes: sem (NPC), sem acento, minuscula e sem as palavras Technique/Jutsu."""
    n = SUFIXO_NPC.sub("", nome)
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode().lower()
    n = re.sub(r"\b(technique|techinique|jutsu)\b", " ", n)
    return re.sub(r"[^a-z0-9]+", " ", n).strip()


def slug(nome: str) -> str:
    """Id do jutsu: o nome em minusculo e com hifens."""
    return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower()).strip("-")[:70]


async def main() -> None:
    """Simula (ou grava com --aplicar) a criacao dos jutsus em rascunho."""
    ap = argparse.ArgumentParser(description="Cria como rascunho os jutsus do jogo que ainda nao tem pagina no wiki.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)

    nomes = carregar("English.json")["JutsuKeys"]
    pt = carregar("Brazilian Portuguese.json").get("Entries", {})
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    async with AsyncSessionLocal() as db:
        existentes = (await db.execute(select(Jutsu))).scalars().all()
        ids = {j.id for j in existentes}
        chaves = {(normalizar(j.name), j.is_npc) for j in existentes}
        criar: list[Jutsu] = []
        pulados = 0
        for bruto in sorted(set(nomes)):
            if not parece_nome_de_jutsu(bruto):
                continue
            npc = bool(SUFIXO_NPC.search(bruto))
            nome = SUFIXO_NPC.sub("", bruto).strip()
            chave = (normalizar(nome), npc)
            if not chave[0] or chave in chaves:
                pulados += 1
                continue
            chaves.add(chave)
            base = slug(nome) + ("-npc" if npc else "")
            novo_id, n = base, 2
            while novo_id in ids:
                novo_id, n = f"{base}-{n}", n + 1
            ids.add(novo_id)
            traduzido = SUFIXO_NPC.sub("", pt.get(bruto, pt.get(nome, ""))).strip()
            criar.append(Jutsu(id=novo_id, name=nome, name_pt=traduzido if traduzido and traduzido != nome else None, mastery_id=None, path_id=None,
                               tier=1, chakra_cost=0, description="", long_description="", effect="", range="", cast_time="", cooldown="",
                               icon=ICONE_PADRAO, is_npc=npc, status=ContentStatus.DRAFT))
        print(f"Jutsus novos (rascunho): {len(criar)}  ({sum(j.is_npc for j in criar)} de NPC)  |  ja existiam no wiki: {pulados}")
        for j in criar[:12]:
            print(f"   {j.id:<40} {j.name}  /  {j.name_pt or '-'}")
        if args.aplicar:
            db.add_all(criar)
            await db.commit()
    print("Gravado." if args.aplicar else "Simulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
