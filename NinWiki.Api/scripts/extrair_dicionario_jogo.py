"""
Extrai o dicionario EN -> PT-BR do proprio jogo (Nin Online) para dentro do projeto: `app/data/game_pt.json`.

De onde vem: `Brazilian Portuguese.json` (pasta `data files/locales` do jogo), campo `Entries` = {texto em ingles: texto em portugues}.
E' a traducao OFICIAL; a API (app/core/game_dictionary.py) consulta esse arquivo ANTES de gastar a cota da DeepL.

O que fica no arquivo: {"_meta": {...}, "entries": {texto_ingles_normalizado: texto_pt}}. A chave e' normalizada (espacos colapsados + minusculas),
o mesmo que `game_dictionary.norm`. So' entram pares uteis: chave com letras, traducao diferente do original e com os MESMOS placeholders
({0}, {name}...) - par com placeholder trocado/perdido e' descartado. Os placeholders sao mantidos intactos.

Idempotente: rodar de novo com o mesmo arquivo do jogo gera exatamente o mesmo resultado (nao grava data de hoje no arquivo).
Nao toca em banco nenhum.

Uso (pasta NinWiki.Api):
    py scripts/extrair_dicionario_jogo.py
    py scripts/extrair_dicionario_jogo.py --arquivo "D:/outro/Brazilian Portuguese.json"
"""
import argparse
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

PADRAO = Path(r"E:\SteamLibrary\steamapps\common\Nin Online\data files\locales\Brazilian Portuguese.json")
SAIDA = Path(__file__).resolve().parent.parent / "app" / "data" / "game_pt.json"
PLACEHOLDER = re.compile(r"\{[^{}]*\}")


def norm(texto: str) -> str:
    """Mesma normalizacao de app/core/game_dictionary.py::norm (espacos colapsados + minusculas)."""
    return " ".join(texto.split()).casefold()


def util(chave: str, valor: str) -> bool:
    """Par util: chave com letras, traducao diferente da chave e placeholders identicos nos dois lados."""
    if not any(c.isalpha() for c in chave) or not valor.strip() or norm(valor) == norm(chave):
        return False
    if sorted(PLACEHOLDER.findall(chave)) != sorted(PLACEHOLDER.findall(valor)):
        return False
    return chave.count("{") == valor.count("{") and chave.count("}") == valor.count("}")


def main() -> None:
    """Le o arquivo do jogo e grava o dicionario compacto."""
    ap = argparse.ArgumentParser(description="Extrai o dicionario EN->PT do jogo para app/data/game_pt.json")
    ap.add_argument("--arquivo", default=str(PADRAO), help="Brazilian Portuguese.json do jogo (padrao: %(default)s)")
    args = ap.parse_args()
    origem = Path(args.arquivo)
    if not origem.is_file():
        sys.exit(f"Arquivo do jogo nao encontrado: {origem}")
    bruto = json.loads(origem.read_text(encoding="utf-8-sig"))
    entradas = bruto.get("Entries") or {}
    ticks = int(bruto.get("LastUpdatedTicks") or 0)   # ticks do .NET (100 ns desde 0001-01-01)
    atualizado = (datetime(1, 1, 1) + timedelta(microseconds=ticks // 10)).date().isoformat() if ticks else None

    saida: dict[str, str] = {}
    for chave, valor in entradas.items():
        if isinstance(chave, str) and isinstance(valor, str) and util(chave, valor):
            saida.setdefault(norm(chave), valor.strip())   # chave repetida (so' muda maiuscula/espaco): vale a primeira

    meta = {"fonte": "Nin Online - locales/Brazilian Portuguese.json", "idioma": bruto.get("Language"),
            "atualizado_no_jogo": atualizado, "entradas_no_jogo": len(entradas), "pares_uteis": len(saida)}
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps({"_meta": meta, "entries": saida}, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    print(f"{len(entradas)} entradas no jogo -> {len(saida)} pares uteis | {SAIDA} ({SAIDA.stat().st_size / 1024 / 1024:.2f} MB) | jogo atualizado em {atualizado}")


if __name__ == "__main__":
    main()
