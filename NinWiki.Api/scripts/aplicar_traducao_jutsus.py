"""
Aplica a traducao PT-BR (feita a mao, sem DeepL) das descricoes de Jutsus que estavam sem `description_pt` / `long_description_pt`.
Os textos moram em app/data/jutsus_pt.json, chaveados pelo `id` (slug) do jutsu - o mesmo id existe na producao.
  - o texto longo (Tiptap JSON) tem so' os nos de texto traduzidos, a estrutura e' a do original;
  - numeros, datas e nomes de tecnicas citadas ficam iguais ao original;
  - SO' preenche campo VAZIO (nunca sobrescreve traducao da equipe); jutsu que nao existe no banco e' ignorado;
  - SIMULACAO por padrao; grava so' com --aplicar. IDEMPOTENTE: a 2a rodada nao muda nada;
  - UMA linha no log de auditoria (source=script);
  - recusa banco que nao seja local, a menos que use --permitir-remoto (producao: faca backup antes!).

Uso (pasta NinWiki.Api, `$env:PYTHONPATH="."`):
    py scripts/aplicar_traducao_jutsus.py                              # simulacao
    py scripts/aplicar_traducao_jutsus.py --aplicar
    py scripts/aplicar_traducao_jutsus.py --permitir-remoto            # simulacao na producao
    py scripts/aplicar_traducao_jutsus.py --aplicar --permitir-remoto  # grava na producao (depois do Deploy API, com backup)
"""
import argparse
import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select

from app.core.audit import log_action
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.masteries import Jutsu
from scripts._guarda_banco import exigir_banco_local

ARQUIVO = Path(__file__).resolve().parent.parent / "app" / "data" / "jutsus_pt.json"
CAMPOS = ("description_pt", "long_description_pt")


async def main() -> None:
    """Preenche os campos `_pt` vazios dos jutsus com o conteudo do arquivo de dados."""
    ap = argparse.ArgumentParser(description="Aplica a traducao PT-BR das descricoes de jutsus (so' campos vazios).")
    ap.add_argument("--aplicar", action="store_true", help="grava no banco (sem isso e' so' simulacao)")
    ap.add_argument("--permitir-remoto", action="store_true", help="deixa rodar contra um banco que nao e' local (producao)")
    args = ap.parse_args()
    logging.disable(logging.INFO)   # o motor do banco imprime cada SELECT; aqui so' interessa o resumo
    if not args.permitir_remoto:
        exigir_banco_local(settings.database_url)
    dados: dict[str, dict[str, str]] = json.loads(ARQUIVO.read_text(encoding="utf-8"))

    preenchidos = {c: [] for c in CAMPOS}
    ja_tinham = {c: 0 for c in CAMPOS}
    ausentes: list[str] = []
    async with AsyncSessionLocal() as db:
        jutsus = {j.id: j for j in (await db.execute(select(Jutsu).where(Jutsu.id.in_(list(dados))))).scalars().all()}
        for ident, campos in dados.items():
            jutsu = jutsus.get(ident)
            if jutsu is None:
                ausentes.append(ident)
                continue
            for campo in CAMPOS:
                if campo not in campos:
                    continue
                if (getattr(jutsu, campo) or "").strip():
                    ja_tinham[campo] += 1   # ja' tem texto: nunca sobrescreve
                    continue
                preenchidos[campo].append(ident)
                if args.aplicar:
                    setattr(jutsu, campo, campos[campo])
        if args.aplicar and any(preenchidos.values()):
            await log_action(db, action="bulk-translate", entity_type="jutsus", entity_id=f"{sum(map(len, preenchidos.values()))} campos",
                             diff={"fonte": "traducao manual (app/data/jutsus_pt.json)", "campos": {c: len(v) for c, v in preenchidos.items() if v},
                                   "ids_amostra": {c: v[:20] for c, v in preenchidos.items() if v}}, source="script")
        if args.aplicar:
            await db.commit()

    print(f"Modo: {'GRAVAR' if args.aplicar else 'simulacao (nada e gravado)'} | jutsus no arquivo: {len(dados)}")
    for campo in CAMPOS:
        print(f"{campo:<22} {'preenchidos' if args.aplicar else 'seriam preenchidos'} {len(preenchidos[campo]):>4} | ja' tinham texto {ja_tinham[campo]:>4}")
    if ausentes:
        print(f"Jutsus do arquivo que nao existem neste banco (ignorados): {len(ausentes)} (ex.: {', '.join(ausentes[:5])})")


if __name__ == "__main__":
    asyncio.run(main())
