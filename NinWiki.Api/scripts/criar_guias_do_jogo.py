"""
Cria artigos do Guia a partir do "livro de guias" que vem DENTRO do cliente do jogo (pasta `data files/guide/*.json`: titulo, dificuldade e texto
escritos pela propria equipe do Nin Online). E' a fonte mais confiavel que existe - nada aqui e' inventado: o texto e' o do jogo, so' reformatado em
paragrafos/listas. Guias que o wiki ja' tem (mesmo id) e paginas do jogo que sao so' "Work in progress" sao puladas.

Entram em INGLES (campo sem sufixo); a traducao PT sai depois pelo botao de traducao do painel. Por padrao como RASCUNHO (so' a equipe ve): revise
em Admin > Artigos do Guia e publique. Simulacao por padrao; grava com --aplicar. Recusa banco que nao seja local, a menos que use --permitir-remoto.

Uso (pasta NinWiki.Api, python do venv, `$env:PYTHONPATH="."`):
    python scripts/criar_guias_do_jogo.py                 # simulacao
    python scripts/criar_guias_do_jogo.py --aplicar       # grava no banco local (rascunho)
    python scripts/criar_guias_do_jogo.py --pasta "E:/.../data files/guide"
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
from app.models.enums import ContentStatus
from app.models.guide import GuideArticle
from scripts._guarda_banco import exigir_banco_local

PASTA_PADRAO = r"E:\SteamLibrary\steamapps\common\Nin Online\data files\guide"

# (id do artigo, arquivo do jogo, secao, posicao, icone, resumo em ingles - ate' 300 letras, so' com o que o proprio texto diz)
ARTIGOS = [
    ("welcome", "1-1-Welcome", "new-player", 0, "book-open", "What the in-game guide book covers, and which guides to read first."),
    ("academy", "1-2-Academy", "new-player", 1, "book-open", "The tutorial that teaches the basic controls and promotes you to Genin."),
    ("villages", "1-91-Villages", "new-player", 2, "shield", "Your village decides your missions, storyline, summons and clans - and who you can fight."),
    ("mission-assignment-desk", "1-3-DailyMissions", "new-player", 3, "scroll-text", "Where to take daily missions: up to 4 a day, one at a time."),
    ("mission-log", "1-4-MissionLog", "interface", 3, "scroll-text", "The Mission Log (M) and the on-screen tracker that points to your objective."),
    ("friends-ignore", "2-7-FriendsIgnore", "interface", 4, "users", "Add friends, see when they are online, and ignore players you do not want to hear."),
    ("fame", "2-5-Fame", "interface", 5, "award", "The reputation score you can raise or lower on other players."),
    ("health-regeneration", "1-5-HealthRegeneration", "combat", 8, "heart-pulse", "Why your HP does not come back during a fight, and the ways to enter the Rested state."),
    ("masteries", "1-31-Masteries", "progression", 6, "sparkles", "Masteries are the game's classes: when you get the first one and why the choice is permanent."),
    ("ninja-ranks", "2-2-Ranks", "progression", 7, "award", "The ranks of a hidden village, from Academy Student to Kami."),
    ("jutsu-ranks", "2-6-JutsuRanks", "progression", 8, "trending-up", "How a jutsu improves the more you land it."),
    ("summons", "3-3-Summons", "progression", 9, "sparkles", "From level 30 you can sign a contract with an animal familiar."),
    ("professions", "2-10-Professions", "progression", 10, "hammer", "Optional life skills like Fishing and Woodcutting, found in the Proficiencies tab."),
    ("clans", "1-9-Clans", "progression", 11, "users", "Clans are closer to a second class than to a guild: what they do today."),
    ("chunin-exams", "3-1-ChuninExams", "progression", 12, "swords", "The bi-monthly event that promotes players to Chunin, Specialized Jonin or Jonin."),
    ("event-coupons", "2-4-EventCoupons", "economy", 2, "coins", "Coupons earned at events, traded for prizes in Takumi Village."),
    ("gold-silver-ninja", "2-8-GoldSilverNinja", "economy", 3, "sparkles", "The one-time donation perks, and what Silver Ninja is."),
]


def doc_do_texto(texto: str, titulo: str) -> str:
    """Documento Tiptap (JSON em texto) a partir do texto do jogo: paragrafos, listas com '-' e listas numeradas ('1. ...')."""
    texto = texto.replace("\\n", "\n").replace("%%", "%")   # o jogo guarda '\n' como texto e escapa '%'
    blocos: list[dict] = []
    lista: list[str] = []
    tipo_lista = ""

    def no_texto(t: str) -> dict:
        return {"type": "text", "text": t}

    def fechar() -> None:
        nonlocal lista, tipo_lista
        if lista:
            blocos.append({"type": tipo_lista, "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [no_texto(i)]}]} for i in lista]})
        lista, tipo_lista = [], ""

    for bruta in texto.split("\n"):
        linha = bruta.strip()
        if not linha:
            fechar()
            continue
        m_b = re.match(r"^-\s+(.*)$", linha)
        m_n = re.match(r"^\d+\.\s+(.*)$", linha)
        if m_b or m_n:
            novo = "bulletList" if m_b else "orderedList"
            if tipo_lista and tipo_lista != novo:
                fechar()
            tipo_lista = novo
            lista.append((m_b or m_n).group(1))
            continue
        fechar()
        blocos.append({"type": "paragraph", "content": [no_texto(linha)]})
    fechar()
    # Fonte no fim, para o revisor saber de onde veio.
    blocos.append({"type": "paragraph", "content": [{"type": "text", "marks": [{"type": "italic"}], "text": f'Source: the in-game guide book, "{titulo}".'}]})
    return json.dumps({"type": "doc", "content": blocos}, ensure_ascii=False)


async def main() -> None:
    """Simula (ou grava com --aplicar) a criacao dos artigos."""
    ap = argparse.ArgumentParser(description="Cria artigos do Guia a partir do livro de guias do cliente do jogo.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--publicar", action="store_true", help="cria ja' publicados (padrao: rascunho, para revisar antes)")
    ap.add_argument("--pasta", default=PASTA_PADRAO, help="pasta data files/guide do cliente do jogo")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    pasta = Path(args.pasta)
    if not pasta.is_dir():
        sys.exit(f"Pasta do guia do jogo nao encontrada: {pasta}")
    situacao = ContentStatus.PUBLISHED if args.publicar else ContentStatus.DRAFT
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'} | situacao: {situacao.value}")

    async with AsyncSessionLocal() as db:
        existentes = set((await db.execute(select(GuideArticle.id))).scalars().all())
        novos = 0
        for id_, arquivo, secao, posicao, icone, resumo in ARTIGOS:
            if id_ in existentes:
                print(f"  {id_:<26} ja existe (nao mexido)")
                continue
            dados = json.loads((pasta / f"{arquivo}.json").read_text(encoding="utf-8-sig"), strict=False)
            if len(resumo) > 300:
                sys.exit(f"Resumo longo demais em {id_}")
            print(f"  {id_:<26} {secao:<12} {dados['Title']}  [{dados.get('Difficulty')}]")
            novos += 1
            if args.aplicar:
                db.add(GuideArticle(id=id_, section=secao, position=posicao, icon=icone, title=dados["Title"][:150], summary=resumo,
                                    body=doc_do_texto(dados["Content"], dados["Title"]), status=situacao))
        if args.aplicar:
            await db.commit()
    print(f"\nArtigos novos: {novos}")
    print("Gravado." if args.aplicar else "Simulacao: nada foi gravado. Rode de novo com --aplicar para gravar.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
