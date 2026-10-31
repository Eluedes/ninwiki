"""
Ajustes finais de dados antes de colocar o banco local como base da producao (30/10/2026). Quatro coisas, todas IDEMPOTENTES (rodar de novo = 0 mudancas):

  a) PUBLICA os 17 guias novos criados por scripts/criar_guias_do_jogo.py (os 14 rascunhos mais antigos NAO sao tocados) e grava UMA linha no log de
     auditoria ("bulk-status" em guide_article), como as outras publicacoes em lote;
  b) RENOMEIA os itens publicados Green Jacket/Pants/Shorts para Dark Green ... (nome do cliente 6.0.2.4, nome PT oficial do Brazilian Portuguese.json).
     O SLUG antigo e' mantido para nao quebrar links. Nenhum outro "Green ..." e' mexido;
  c) LIGA o icone dos baloes de chat identificados com confianca: 2508 (balao branco liso) -> Classic Chat Bubble e 2509 (azul-noite com dourado) -> Cosmic
     Chat Bubble, usando as imagens `N_item` que o criar_itens_do_jogo.py ja' pos no banco de imagens. Chakra/Cyber/Ink NAO sao ligados (ambiguos: so' listados);
  d) padroniza o cast_type dos jutsus Big Flame Bullet Technique e Dragon Fire Technique para "Walk cast" (valor da edicao da equipe, igual a 3 jutsus publicados).

SIMULACAO por padrao (mostra antes -> depois e nao grava); grava com --aplicar. So' roda em banco LOCAL (ou em um banco temporario local via --banco).

Uso (pasta NinWiki.Api, `$env:PYTHONPATH="."`):
    py scripts/ajustes_finais_dados.py                       # simulacao no banco do .env
    py scripts/ajustes_finais_dados.py --aplicar
    py scripts/ajustes_finais_dados.py --aplicar --banco ninwiki_merged   # no temporario (host/usuario/senha do .env, so' troca o nome do banco)
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.audit import log_action
from app.core.config import settings
from app.core.media_refs import media_url
from app.models.content import ContentItem
from app.models.enums import ContentStatus
from app.models.guide import GuideArticle
from app.models.masteries import Jutsu
from app.models.media import MediaImage
from scripts._guarda_banco import exigir_banco_local

# Os 17 guias novos (mesmos ids de criar_guias_do_jogo.py).
GUIAS_NOVOS = ["welcome", "academy", "villages", "mission-assignment-desk", "mission-log", "friends-ignore", "fame", "health-regeneration", "masteries",
               "ninja-ranks", "jutsu-ranks", "summons", "professions", "clans", "chunin-exams", "event-coupons", "gold-silver-ninja"]
# nome antigo -> (nome novo, nome PT oficial do Brazilian Portuguese.json do cliente 6.0.2.4)
RENOMES = {"Green Jacket": ("Dark Green Jacket", "Jaqueta Verde Escura"), "Green Pants": ("Dark Green Pants", "Calças Verde Escuras"),
           "Green Shorts": ("Dark Green Shorts", "Shorts Verde Escuros")}
BALOES = {"Classic Chat Bubble": 2508, "Cosmic Chat Bubble": 2509}          # nome do item -> icone do cliente (confianca razoavel)
BALOES_AMBIGUOS = ["Chakra Chat Bubble", "Cyber Chat Bubble", "Ink Chat Bubble"]   # icones 2512-2518 sem prova de qual e' qual: nao ligar
CAST = {"big-flame-bullet": "Walk cast", "dragon-fire-technique": "Walk cast"}   # id do jutsu -> cast_type
CLIENTE = Path(r"E:\SteamLibrary\steamapps\common\Nin Online\data files\locales")


def conferir_cliente() -> None:
    """Se o cliente do jogo estiver neste PC, confirma que 'Dark Green ...' existe e o PT oficial bate com o que vamos gravar (senao so' avisa)."""
    try:
        en = json.loads((CLIENTE / "English.json").read_text(encoding="utf-8-sig"))["ItemKeys"]
        pt = json.loads((CLIENTE / "Brazilian Portuguese.json").read_text(encoding="utf-8-sig")).get("Entries", {})
    except OSError:
        print("AVISO: cliente do jogo nao encontrado neste PC; usando os nomes ja' conferidos no 6.0.2.4.")
        return
    for novo, pt_novo in RENOMES.values():
        if novo not in en or pt.get(novo) != pt_novo:
            sys.exit(f"O cliente nao confirma '{novo}' / '{pt_novo}' (PT oficial: {pt.get(novo)!r}). Nada foi feito.")
    print("Cliente 6.0.2.4 confirma os 3 nomes Dark Green e o PT oficial.")


async def main() -> None:
    """Roda os quatro ajustes (simulacao ou gravando)."""
    ap = argparse.ArgumentParser(description="Ajustes finais de dados (guias, Dark Green, baloes, cast_type).")
    ap.add_argument("--aplicar", action="store_true", help="grava (sem isso: simulacao)")
    ap.add_argument("--banco", help="nome de OUTRO banco local (ex.: ninwiki_merged); padrao: o do .env")
    a = ap.parse_args()
    exigir_banco_local(settings.database_url)
    url = settings.database_url if not a.banco else re.sub(r"/[^/?]+$", "/" + a.banco, settings.database_url)
    exigir_banco_local(url)
    conferir_cliente()
    engine = create_async_engine(url)
    mudancas = 0
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        # a) guias
        guias = (await db.execute(select(GuideArticle).where(GuideArticle.id.in_(GUIAS_NOVOS)))).scalars().all()
        faltam = set(GUIAS_NOVOS) - {g.id for g in guias}
        if faltam:
            sys.exit(f"Guias que nao existem no banco: {sorted(faltam)}")
        pend = [g for g in guias if g.status != ContentStatus.PUBLISHED]
        for g in pend:
            print(f"guia {g.id:<26} {g.status.value} -> PUBLISHED")
            g.status = ContentStatus.PUBLISHED
        if pend:
            await log_action(db, action="bulk-status", entity_type="guide_article", entity_id=f"{len(pend)} artigos",
                             diff={"status": "PUBLISHED", "ids": [g.id for g in pend]}, source="script")
        mudancas += len(pend)
        # b) Dark Green
        for antigo, (novo, pt_novo) in RENOMES.items():
            it = (await db.execute(select(ContentItem).where(ContentItem.name == antigo, ContentItem.status == ContentStatus.PUBLISHED))).scalars().first()
            if it is None:
                print(f"item '{antigo}': ja' renomeado (ou nao publicado) - nada a fazer")
                continue
            print(f"item {it.slug}: nome '{it.name}' -> '{novo}' | name_pt '{it.name_pt}' -> '{pt_novo}' (slug mantido)")
            antes = {"name": it.name, "name_pt": it.name_pt}
            it.name, it.name_pt = novo, pt_novo
            await log_action(db, action="update", entity_type="content_item", entity_id=str(it.id),
                             diff={"before": antes, "after": {"name": novo, "name_pt": pt_novo}}, source="script")
            mudancas += 1
        # c) baloes
        for nome, icone in BALOES.items():
            it = (await db.execute(select(ContentItem).where(ContentItem.name == nome))).scalars().first()
            arq = (await db.execute(select(MediaImage.filename).where(MediaImage.name == f"{icone}_item"))).scalar()
            if it is None or arq is None:
                sys.exit(f"Nao achei o item '{nome}' ou a imagem {icone}_item.")
            if it.image:
                print(f"balao {nome}: ja' tem imagem - nada a fazer")
                continue
            print(f"balao {nome}: imagem vazia -> {icone}_item ({arq})")
            it.image = media_url(arq)
            await log_action(db, action="update", entity_type="content_item", entity_id=str(it.id),
                             diff={"before": {"image": None}, "after": {"image": it.image}}, source="script")
            mudancas += 1
        for nome in BALOES_AMBIGUOS:
            img = (await db.execute(select(ContentItem.image).where(ContentItem.name == nome))).scalar()
            print(f"balao {nome}: NAO ligado (icone ambiguo); imagem atual: {'sim' if img else 'vazia'}")
        # d) cast_type
        for jid, valor in CAST.items():
            j = await db.get(Jutsu, jid)
            if j is None:
                sys.exit(f"Jutsu '{jid}' nao existe.")
            if j.cast_type == valor:
                print(f"jutsu {jid}: ja' '{valor}'")
                continue
            print(f"jutsu {jid}: cast_type {j.cast_type!r} -> {valor!r}")
            await log_action(db, action="update", entity_type="jutsu", entity_id=jid,
                             diff={"before": {"cast_type": j.cast_type}, "after": {"cast_type": valor}}, source="script")
            j.cast_type = valor
            mudancas += 1
        if a.aplicar:
            await db.commit()
        else:
            await db.rollback()
    await engine.dispose()
    print(f"\nMudancas: {mudancas}. " + ("GRAVADO." if a.aplicar else "Simulacao: nada foi gravado (use --aplicar)."))


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
