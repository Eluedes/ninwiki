"""
Converte conteudo antigo que esta' em PORTUGUES nos campos principais para o padrao do site:
INGLES no campo principal + PORTUGUES no campo `_pt` (traduzido pela DeepL, direcao PT -> EN).

QUANDO USAR: depois de importar/semear conteudo que foi escrito em portugues (ex: um banco antigo, o
seed de masteries/jutsus). Conteudo novo criado no painel ja' nasce certo (ingles + DeepL EN -> PT).

COMO FUNCIONA, para cada campo de cada tabela listada em ALVOS:
  - so' mexe em linha cujo campo `_pt` esta' VAZIO (nunca sobrescreve traducao existente);
  - so' mexe se o texto PARECE portugues (acentos/palavras comuns) - texto ja' em ingles e' ignorado;
  - guarda o texto antigo (portugues) em `_pt` e poe a traducao da DeepL (ingles) no campo principal;
  - texto rico do editor (JSON Tiptap) e' traduzido sem quebrar a formatacao.
  Se a DeepL falhar para um campo, ele fica como estava (nada se perde).

COMO USAR (na pasta NinWiki.Api, com DEEPL_API_KEY no .env e o banco no ar):
    python scripts/traduzir_para_ingles.py                 # SIMULACAO: so' mostra o que mudaria
    python scripts/traduzir_para_ingles.py --aplicar       # faz de verdade
    python scripts/traduzir_para_ingles.py --aplicar --tabelas villages clans organizations
FACA UM BACKUP ANTES (python scripts/migrar_banco.py exportar). Pode rodar de novo: o que ja' foi
convertido (tem `_pt`) e' pulado.
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.translation import translate_field  # noqa: E402

# tabela -> (coluna de id, [(campo principal em ingles, campo _pt)])
ALVOS: dict[str, tuple[str, list[tuple[str, str]]]] = {
    "villages": ("id", [("motto", "motto_pt"), ("description", "description_pt"), ("long_description", "long_description_pt"), ("climate", "climate_pt")]),
    "clans": ("id", [("name", "name_pt"), ("description", "description_pt")]),
    "organizations": ("id", [("name", "name_pt"), ("description", "description_pt")]),
    "professions": ("id", [("description", "description_pt")]),
    "ninja_ranks": ("id", [("description", "description_pt")]),
    "story_arcs": ("id", [("name", "name_pt"), ("description", "description_pt")]),
    "summons": ("id", [("village", "village_pt"), ("stage_young", "stage_young_pt"), ("stage_teen", "stage_teen_pt"), ("stage_adult", "stage_adult_pt")]),
    "attributes": ("id", [("description", "description_pt")]),
    "masteries": ("id", [("description", "description_pt"), ("long_description", "long_description_pt")]),
    "jutsus": ("id", [("description", "description_pt"), ("long_description", "long_description_pt")]),
    "posts": ("id", [("title", "title_pt"), ("excerpt", "excerpt_pt"), ("content", "content_pt")]),
    "content_items": ("id", [("description", "description_pt"), ("lore", "lore_pt"), ("synergy", "synergy_pt"), ("spawn_location", "spawn_location_pt")]),
}

_PT_WORDS = {"de", "da", "do", "das", "dos", "que", "com", "para", "uma", "um", "não", "são", "em", "na", "no", "nas", "nos", "por", "mais", "seu", "sua", "seus", "suas", "ao", "como", "ou", "pelo", "pela", "é", "à"}
_EN_WORDS = {"the", "of", "and", "to", "in", "is", "with", "for", "that", "this", "on", "are", "by", "as", "an", "it", "from", "its", "their", "at", "be", "or"}


def texto_visivel(valor: str) -> str:
    """O texto que a pessoa le: se for JSON do Tiptap, junta so' os nos de texto; senao devolve o proprio valor."""
    v = valor.strip()
    if v.startswith("{"):
        try:
            return " ".join(re.findall(r'"text"\s*:\s*"((?:[^"\\]|\\.)*)"', v))
        except re.error:
            return v
    return v


def parece_portugues(valor: str) -> bool:
    """Heuristica simples: acentos tipicos do portugues ou mais palavras comuns do portugues que do ingles."""
    t = texto_visivel(valor).lower()
    if not t.strip():
        return False
    palavras = re.findall(r"[a-zà-ÿ]+", t)
    pt = sum(1 for p in palavras if p in _PT_WORDS)
    en = sum(1 for p in palavras if p in _EN_WORDS)
    acentos = len(re.findall(r"[ãõçáéíóúâêôà]", t))
    return pt > en or (acentos >= 2 and pt >= en)


async def processar(tabela: str, aplicar: bool) -> tuple[int, int]:
    """Converte os campos de uma tabela. Devolve (campos convertidos, campos que a DeepL nao conseguiu traduzir)."""
    id_col, pares = ALVOS[tabela]
    convertidos = falhas = 0
    async with AsyncSessionLocal() as db:
        for base, pt in pares:
            rows = (await db.execute(text(
                f"SELECT {id_col}, {base} FROM {tabela} WHERE ({pt} IS NULL OR {pt} = '') AND {base} IS NOT NULL AND {base} <> ''"
            ))).all()
            for row_id, valor in rows:
                if not parece_portugues(valor):
                    continue
                if not aplicar:
                    convertidos += 1
                    print(f"  [simulacao] {tabela}.{base} ({row_id}): {texto_visivel(valor)[:70]!r}")
                    continue
                ingles = await translate_field(valor, reverse=True)
                if not ingles:
                    falhas += 1
                    continue
                await db.execute(text(f"UPDATE {tabela} SET {pt} = :pt, {base} = :en WHERE {id_col} = :id"),
                                 {"pt": valor, "en": ingles, "id": row_id})
                convertidos += 1
        await db.commit()
    return convertidos, falhas


async def main() -> None:
    """Le os argumentos, confere a chave da DeepL e processa as tabelas escolhidas."""
    parser = argparse.ArgumentParser(description="Converte conteudo em portugues para ingles (campo principal) + portugues (_pt).")
    parser.add_argument("--aplicar", action="store_true", help="grava de verdade (sem isso e' so' simulacao)")
    parser.add_argument("--tabelas", nargs="*", choices=sorted(ALVOS), help="so' estas tabelas (padrao: todas)")
    args = parser.parse_args()
    if args.aplicar and not settings.deepl_api_key:
        sys.exit("DEEPL_API_KEY vazia no .env: sem ela nao ha' como traduzir. (Use sem --aplicar para so' simular.)")
    print("MODO:", "APLICANDO" if args.aplicar else "SIMULACAO (nada sera gravado; use --aplicar)")
    total = total_falhas = 0
    for tabela in args.tabelas or ALVOS:
        n, f = await processar(tabela, args.aplicar)
        total, total_falhas = total + n, total_falhas + f
        print(f"{tabela}: {n} campo(s) {'convertido(s)' if args.aplicar else 'a converter'}" + (f", {f} sem traducao (DeepL falhou)" if f else ""))
    print(f"\nTotal: {total} campo(s)." + (f" {total_falhas} falharam - rode de novo para tentar outra vez." if total_falhas else ""))


if __name__ == "__main__":
    asyncio.run(main())
