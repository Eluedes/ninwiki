"""
Tira a MARCACAO DO CLIENTE DO JOGO que vazou para o texto do wiki: `<color=yellow>Hand Weapon</color>` vira `Hand Weapon` (tambem <b>, <i>, <u>, <size=..>,
<sprite..>, <link..>...; <br> vira quebra de linha). Aparecia crua no site e no bot do Discord (ex.: "Dark Steel Kunai Dagger").

COMO LIMPA (mesma funcao de app/core/text.py usada na gravacao, no dicionario do jogo e no bot):
  - texto simples: so' as tags saem; o texto de dentro e todo o resto ficam como estao (o rotulo "Hand Weapon" continua no fim da descricao);
  - campo rico (documento Tiptap em JSON): estrutura e marcas ficam; so' os NOS DE TEXTO sao limpos. Decisao: NAO vira negrito/cor no lugar da tag
    (o editor so' guarda cor em hex e o texto do jogo usa nomes como "pink"; manter simples evita inventar formatacao);
  - cobre a versao em ingles e a `_pt`; um "<" de comparacao ("HP < 50") nao e' tocado (so' tags conhecidas casam).
Mexe SO' em colunas de texto das tabelas de conteudo (lista em app/models/base.py::_TABELAS_DE_CONTEUDO) e SO' nas linhas que tem marcacao.
E' idempotente: rodar de novo nao acha mais nada. Nao cria migracao (so' dados).

Por padrao e' SIMULACAO (mostra antes -> depois e a contagem por tabela.coluna). Grava com --aplicar. Recusa banco que nao seja local, a menos que use
--permitir-remoto (faca um backup antes: pg_dump -Fc).

Uso (pasta NinWiki.Api, venv ativado, `$env:PYTHONPATH="."`):
    python scripts/limpar_marcacoes_do_jogo.py                 # simulacao
    python scripts/limpar_marcacoes_do_jogo.py --aplicar       # grava no banco local
    python scripts/limpar_marcacoes_do_jogo.py --permitir-remoto            # simulacao na producao
    python scripts/limpar_marcacoes_do_jogo.py --aplicar --permitir-remoto  # grava na producao (com backup, depois do Deploy API)
"""
import argparse
import asyncio
from collections import Counter

from sqlalchemy import Enum, String, Text, select, update

import app.models  # noqa: F401  (registra todas as tabelas em Base.metadata)
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.text import limpar_marcacao_campo
from app.models.base import _TABELAS_DE_CONTEUDO, Base
from scripts._guarda_banco import exigir_banco_local


async def main() -> None:
    """Simula (ou grava com --aplicar) a limpeza de marcacao do jogo em todas as colunas de texto de conteudo."""
    ap = argparse.ArgumentParser(description="Tira <color=..>, <b>, <size=..> etc. do cliente do jogo dos textos do wiki.")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'}")

    por_coluna: Counter[str] = Counter()
    exemplos: list[str] = []
    async with AsyncSessionLocal() as db:
        for nome in sorted(_TABELAS_DE_CONTEUDO):
            tabela = Base.metadata.tables.get(nome)
            if tabela is None:
                continue
            colunas = [c for c in tabela.columns if isinstance(c.type, (String, Text)) and not isinstance(c.type, Enum) and not c.primary_key]
            chaves = list(tabela.primary_key.columns)
            for col in colunas:
                linhas = (await db.execute(select(*chaves, col).where(col.like("%<%")))).all()
                for linha in linhas:
                    antes = linha[-1]
                    depois = limpar_marcacao_campo(antes)
                    if depois == antes:
                        continue
                    por_coluna[f"{nome}.{col.name}"] += 1
                    if len(exemplos) < 8:   # trecho em volta da 1a tag (o campo inteiro pode ser um documento JSON grande)
                        i = max(antes.find("<") - 50, 0)
                        exemplos.append(f"  {nome}.{col.name}: ...{antes[i:i + 110]!r}\n      -> ...{depois[i:i + 96]!r}")
                    if args.aplicar:
                        await db.execute(update(tabela).where(*[k == v for k, v in zip(chaves, linha[:-1])]).values({col.name: depois}))
        if args.aplicar:
            await db.commit()
    print("\n".join(exemplos))
    for chave, n in sorted(por_coluna.items()):
        print(f"  {chave}: {n}")
    print(f"Total de campos {'limpos' if args.aplicar else 'a limpar'}: {sum(por_coluna.values())}")


if __name__ == "__main__":
    asyncio.run(main())
