"""
Preenche os campos em portugues (`_pt`) que estao VAZIOS usando o dicionario OFICIAL do jogo (app/data/game_pt.json, gerado por
scripts/extrair_dicionario_jogo.py). De graca, sem DeepL.

Regras de seguranca:
  - NUNCA sobrescreve um `_pt` que ja' tem texto (traducao da equipe ou automatica anterior);
  - so' preenche quando o texto em ingles INTEIRO (ou TODOS os paragrafos da descricao) existe no dicionario - nada de traducao pela metade;
  - nomes por `translate_plain`, descricoes (Tiptap JSON) por `translate_doc`, mantendo a estrutura do documento;
  - texto maior que a coluna e' ignorado (nao corta); o selo 'traducao automatica' dos itens nao e' mexido (o texto novo e' oficial);
  - SIMULACAO por padrao (resumo por tabela/campo + 5 exemplos); grava so' com --aplicar. IDEMPOTENTE: a 2a rodada nao muda nada;
  - UMA linha no log de auditoria por tabela (source=script).
  - Recusa banco que nao seja local, a menos que use --permitir-remoto (so' preenche vazios, mas faca backup antes).

Os pares (campo, campo_pt) vem dos proprios models: toda coluna de texto `X_pt` que tem a irma `X`, nas tabelas listadas em TABELAS.

Uso (pasta NinWiki.Api, `$env:PYTHONPATH="."`):
    py scripts/traduzir_com_jogo.py                      # simulacao
    py scripts/traduzir_com_jogo.py --aplicar
    py scripts/traduzir_com_jogo.py --aplicar --permitir-remoto   # producao (DATABASE_URL de producao no .env; backup antes!)
"""
import argparse
import asyncio
import json
import logging
from collections import defaultdict

from sqlalchemy import String, Text, select

from app.core import game_dictionary as gd
from app.core.audit import log_action
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.content import ContentItem
from app.models.guide import GuideArticle, NinjaRank, Profession, StoryArc, Summon
from app.models.masteries import Attribute, Jutsu, Mastery, MasteryPath
from app.models.posts import Post, Tag
from app.models.villages import Clan, Organization, Village
from scripts._guarda_banco import exigir_banco_local

# Tabelas com pares EN/_pt. (Aviso do site e comunicado ficam de fora: la' o `_pt` vazio tem significado proprio.)
TABELAS = [ContentItem, Jutsu, Mastery, MasteryPath, Attribute, Village, Clan, Organization, Profession, NinjaRank, Summon, StoryArc,
           GuideArticle, Post, Tag]


def pares(modelo: type) -> list[tuple[str, str, int | None]]:
    """(campo EN, campo PT, tamanho maximo) de cada coluna de texto `X_pt` com irma `X` de texto."""
    colunas = modelo.__table__.c
    achados = []
    for nome, col in colunas.items():
        base = nome[:-3]
        if nome.endswith("_pt") and base in colunas and isinstance(col.type, (String, Text)) and isinstance(colunas[base].type, (String, Text)):
            achados.append((base, nome, getattr(col.type, "length", None)))
    return achados


def traduzir(valor: str | None) -> str | None:
    """Documento Tiptap -> translate_doc; texto simples -> translate_plain (translate_doc ja' trata os dois)."""
    return gd.translate_doc(valor)


def resumo_texto(texto: str | None, limite: int = 90) -> str:
    """Versao curta e legivel de um campo (para os exemplos): se for Tiptap, so' o texto."""
    if not texto:
        return "(vazio)"
    try:
        doc = json.loads(texto)
        partes: list[str] = []

        def andar(no: object) -> None:
            """Junta os textos do documento."""
            if isinstance(no, dict):
                if isinstance(no.get("text"), str):
                    partes.append(no["text"])
                for f in no.get("content") or []:
                    andar(f)

        andar(doc)
        texto = " ".join(partes)
    except ValueError:
        pass
    texto = " ".join(texto.split())
    return texto if len(texto) <= limite else texto[: limite - 1] + "…"


async def main() -> None:
    """Calcula (e com --aplicar grava) os campos `_pt` vazios que o dicionario do jogo cobre."""
    ap = argparse.ArgumentParser(description="Preenche campos _pt vazios com o dicionario oficial do jogo.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    logging.disable(logging.INFO)   # o motor do banco imprime cada SELECT; aqui so' interessa o resumo
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    if not gd._dados():
        raise SystemExit("Dicionario do jogo vazio/ausente (app/data/game_pt.json). Rode scripts/extrair_dicionario_jogo.py antes.")

    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'} | dicionario: {len(gd._dados())} pares")
    exemplos: list[str] = []
    total = 0
    async with AsyncSessionLocal() as db:
        for modelo in TABELAS:
            tabela = modelo.__tablename__
            campos = pares(modelo)
            candidatos: dict[str, int] = defaultdict(int)   # campo_pt -> vazios com texto EN
            feitos: dict[str, list[str]] = defaultdict(list)  # campo_pt -> ids preenchidos
            for obj in (await db.execute(select(modelo))).scalars().all():
                ident = str(getattr(obj, "id", None) or getattr(obj, "slug", ""))
                for en, pt, limite in campos:
                    origem = getattr(obj, en)
                    if not isinstance(origem, str) or not origem.strip() or (getattr(obj, pt) or "").strip():
                        continue   # sem original, ou o portugues ja' existe (nunca sobrescreve)
                    candidatos[pt] += 1
                    novo = traduzir(origem)
                    if novo is None or (limite is not None and len(novo) > limite):
                        continue
                    feitos[pt].append(ident)
                    if len(exemplos) < 5 and (pt == "name_pt" or not any(e.startswith(f"{tabela}.{pt}") for e in exemplos)):
                        exemplos.append(f"{tabela}.{pt} [{ident}]: {resumo_texto(origem)}  ->  {resumo_texto(novo)}")
                    if args.aplicar:
                        setattr(obj, pt, novo)
            if not candidatos:
                continue
            for pt, qtd in sorted(candidatos.items()):
                n = len(feitos[pt])
                print(f"{tabela:<14} {pt:<22} preenchidos {n:>5} de {qtd:>5} vazios | restam {qtd - n:>5} ({(qtd - n) / qtd:.0%})")
                total += n
            if args.aplicar and any(feitos.values()):
                await log_action(db, action="bulk-translate", entity_type=tabela, entity_id=f"{sum(len(v) for v in feitos.values())} campos",
                                 diff={"fonte": "dicionario do jogo", "campos": {pt: len(v) for pt, v in feitos.items() if v},
                                       "ids_amostra": {pt: v[:20] for pt, v in feitos.items() if v}}, source="script")
        if args.aplicar:
            await db.commit()
    print("\nExemplos (antes -> depois):")
    for e in exemplos:
        print("  " + e)
    print(f"\nTotal de campos {'preenchidos' if args.aplicar else 'que seriam preenchidos'}: {total}")


if __name__ == "__main__":
    asyncio.run(main())
