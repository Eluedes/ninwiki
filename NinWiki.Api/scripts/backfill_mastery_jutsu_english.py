"""
Traduz PT -> EN as descricoes de TODAS as Masteries e Jutsus que ainda
nao passaram por isso, e troca os dois campos de lugar - depois de
rodar, `description`/`long_description` passam a ser o texto em
INGLES (batendo com a convencao "site em ingles por padrao" que o
resto do sistema ja segue), e `description_pt`/`long_description_pt`
guardam o texto original em portugues que ja existia.

POR QUE ISSO EXISTE (e nao e' so' o `translate_field` normal que ja
roda ao criar/editar): Masteries e Jutsus foram escritos em portugues
ANOS antes da decisao de "conteudo nasce em ingles" existir (diferente
de content_items, que ja nasceu direto na convencao nova) - name/
english_name ja' tinham essa dualidade certa desde sempre, mas
description/long_description nunca tiveram ate' agora. Rodar esse
script UMA VEZ resolve o "buraco" retroativamente pros registros que
ja existiam antes da migracao que criou description_pt/
long_description_pt (ver alembic f5935013feb7).

SEGURO RODAR MAIS DE UMA VEZ: so' mexe em registros onde description_pt
(ou long_description_pt) AINDA esta' vazio - um registro ja'
processado (ou que ja tinha sido preenchido a mao) nunca e' tocado de
novo, entao rodar isso de novo por engano nao faz nada de ruim.

Uso (dentro de NinWiki.Api, com o venv ativado, banco configurado no
.env normal e DEEPL_API_KEY preenchida):
    python scripts/backfill_mastery_jutsu_english.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.translation import translate_field  # noqa: E402
from app.models.masteries import Jutsu, Mastery  # noqa: E402

# (campo_atual_pt, campo_pt_novo) - depois de processado, o campo SEM
# sufixo passa a guardar o texto em ingles, e o "_pt" guarda o texto
# original em portugues que estava la' antes.
_FIELDS = [("description", "description_pt"), ("long_description", "long_description_pt")]


async def _backfill_one(obj, label: str) -> bool:
    """Devolve True se mexeu em algo, False se pulou (ja' processado)."""
    changed = False
    for field, field_pt in _FIELDS:
        if getattr(obj, field_pt):
            continue  # ja' tem "_pt" preenchido - ja foi processado (ou preenchido a mao), pula
        original_pt = getattr(obj, field)
        if not original_pt or not original_pt.strip():
            continue  # nada pra traduzir
        translated_en = await translate_field(original_pt, reverse=True)
        if translated_en is None:
            print(f"  [{label}] {field}: falhou (chave da DeepL configurada? API respondendo?)")
            continue
        setattr(obj, field_pt, original_pt)  # guarda o portugues original
        setattr(obj, field, translated_en)   # campo sem sufixo vira o ingles
        changed = True
        print(f"  [{label}] {field}: traduzido")
    return changed


async def main() -> None:
    """Preenche os nomes em ingles de masteries/jutsus que ficaram vazios (script de correcao unica)."""
    if not settings.deepl_api_key:
        print("DEEPL_API_KEY nao configurada no .env - nada a fazer (o script nao inventa traducao sozinho).")
        return

    async with AsyncSessionLocal() as db:
        masteries = (await db.execute(select(Mastery))).scalars().all()
        jutsus = (await db.execute(select(Jutsu))).scalars().all()

        total_changed = 0
        for m in masteries:
            print(f"Mastery: {m.name}")
            if await _backfill_one(m, m.name):
                total_changed += 1
        for j in jutsus:
            print(f"Jutsu: {j.name}")
            if await _backfill_one(j, j.name):
                total_changed += 1

        await db.commit()
        print()
        print(f"Concluido: {total_changed} registro(s) atualizado(s) de {len(masteries) + len(jutsus)} no total.")


if __name__ == "__main__":
    asyncio.run(main())
