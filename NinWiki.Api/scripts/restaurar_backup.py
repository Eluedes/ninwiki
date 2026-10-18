"""
Restaura um backup do NinWiki (arquivo .nbk gerado por app/core/backup.py, guardado pelo bot no Discord): o banco E as imagens.

PARTES: o Discord limita o tamanho de cada anexo, entao o backup vem em partes (`ninwiki-AAAAMMDD-HHMM.nbk.01-of-03`, `.02-of-03`...). Baixe TODAS as partes
da mesma data para uma pasta e passe a primeira (ou o nome sem o sufixo): o script junta tudo sozinho.

QUANDO USAR: banco novo/vazio (recriar o app) ou desastre. O banco de DESTINO precisa ja' ter as tabelas: rode `alembic upgrade head` apontando para ele antes.
ATENCAO: o conteudo das tabelas do backup e' APAGADO no destino e substituido pelo do arquivo; as imagens sao copiadas para a pasta uploads/ (arquivos com o
mesmo nome sao sobrescritos). Por isso o --confirmo.

Uso (na pasta NinWiki.Api, venv ativado; DATABASE_URL do .env = o banco de DESTINO):
    python scripts/restaurar_backup.py  C:\\backups\\ninwiki-20261003-1200.nbk.01-of-03  --confirmo
A senha (BACKUP_PASSPHRASE da API) e' pedida no terminal (ou use a variavel de ambiente BACKUP_PASSPHRASE).
"""
import asyncio
import getpass
import io
import json
import os
import re
import sys
import tarfile
import tempfile
from pathlib import Path

from sqlalchemy import delete, func, insert, select, text

from app.api.uploads import UPLOAD_DIR
from app.core.backup import decrypt_to, restore_value
from app.core.database import AsyncSessionLocal
from app.models.base import Base


def join_parts(first: str, dst) -> int:
    """Junta as partes `X.nbk.NN-of-MM` (ou um arquivo unico) em `dst`. Falha clara se faltar alguma parte. Devolve quantas partes."""
    m = re.fullmatch(r"(.*\.nbk)\.(\d+)-of-(\d+)", first)
    if not m:
        with open(first, "rb") as fh:
            dst.write(fh.read())
        return 1
    base, total = m.group(1), int(m.group(3))
    for n in range(1, total + 1):
        part = f"{base}.{n:02d}-of-{total:02d}"
        if not os.path.isfile(part):
            sys.exit(f"Falta a parte {n} de {total}: {part}")
        with open(part, "rb") as fh:
            dst.write(fh.read())
    return total


def ordenar_auto_referencia(table, rows: list[dict]) -> list[dict]:
    """
    Tabela que aponta para ela mesma (ex.: `users.created_by_id` = quem cadastrou quem) so' aceita a linha
    filha DEPOIS da linha-mae. Sem isso o Postgres recusa o insert ("violates foreign key constraint").
    Devolve as linhas com as maes primeiro; tabela sem auto-referencia volta como esta.
    """
    pk = [c.name for c in table.primary_key.columns]
    refs = [fk.parent.name for fk in table.foreign_keys if fk.column.table is table]
    if len(pk) != 1 or not refs:
        return rows
    ja_inseridos: set = set()
    pendentes, ordenadas = list(rows), []
    while pendentes:
        prontas = [r for r in pendentes if all(r.get(c) is None or r.get(c) in ja_inseridos or r.get(c) == r.get(pk[0]) for c in refs)]
        if not prontas:   # referencia a uma linha que nem esta' no backup: insere o resto e deixa o banco acusar
            prontas = pendentes
        ordenadas += prontas
        ja_inseridos |= {r[pk[0]] for r in prontas}
        pendentes = [r for r in pendentes if r not in prontas]
    return ordenadas


async def acertar_contadores(db, tables: dict) -> None:
    """
    Depois de inserir linhas com ID explicito, o contador automatico (sequence) do Postgres continua no 1 e o proximo cadastro novo
    quebra com "duplicate key". Poe cada contador no maior ID existente.
    """
    for table in tables.values():
        pk = list(table.primary_key.columns)
        if len(pk) != 1 or not pk[0].autoincrement or pk[0].type.python_type is not int:
            continue
        seq = (await db.execute(text("select pg_get_serial_sequence(:t, :c)"), {"t": table.name, "c": pk[0].name})).scalar()
        if seq is None:
            continue
        maior = (await db.execute(select(func.max(pk[0])))).scalar()
        await db.execute(text("select setval(:s, :v, :usado)"), {"s": seq, "v": maior or 1, "usado": maior is not None})


async def restore(first: str, passphrase: str) -> tuple[dict[str, int], int]:
    """Junta e decifra o backup, restaura o banco (apaga e insere) e copia as imagens. Devolve (linhas por tabela, imagens)."""
    with tempfile.TemporaryDirectory() as tmp:
        joined, plain = Path(tmp) / "joined.nbk", Path(tmp) / "plain.tar.gz"
        with open(joined, "wb") as dst:
            join_parts(first, dst)
        with open(joined, "rb") as src, open(plain, "wb") as dst:
            decrypt_to(src, dst, passphrase)
        counts: dict[str, int] = {}
        files = 0
        with tarfile.open(plain, "r:gz") as tar:
            db_member = tar.extractfile("db.ndjson")
            lines = io.TextIOWrapper(db_member, encoding="utf-8").read().splitlines()
            header = json.loads(lines[0])
            by_table: dict[str, list[dict]] = {name: [] for name in header["tables"]}
            for line in lines[1:]:
                rec = json.loads(line)
                by_table[rec["t"]].append(rec["r"])
            tables = {t.name: t for t in Base.metadata.sorted_tables}
            async with AsyncSessionLocal() as db:
                for name in reversed(header["tables"]):   # filhas primeiro ao apagar
                    await db.execute(delete(tables[name]))
                for name in header["tables"]:             # maes primeiro ao inserir
                    table = tables[name]
                    rows = [{c.name: restore_value(c, r.get(c.name)) for c in table.columns if c.name in r} for r in by_table[name]]
                    rows = ordenar_auto_referencia(table, rows)
                    for i in range(0, len(rows), 1000):
                        await db.execute(insert(table), rows[i:i + 1000])
                    counts[name] = len(rows)
                await acertar_contadores(db, tables)
                await db.commit()
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            for member in tar:
                if member.isfile() and member.name.startswith("uploads/") and "/" not in member.name[len("uploads/"):] and not member.name.endswith("/"):
                    (UPLOAD_DIR / Path(member.name).name).write_bytes(tar.extractfile(member).read())
                    files += 1
        return counts, files


def main() -> None:
    """Le a linha de comando, confirma e restaura."""
    if len(sys.argv) < 2 or "--confirmo" not in sys.argv:
        sys.exit(__doc__)
    passphrase = os.getenv("BACKUP_PASSPHRASE") or getpass.getpass("Senha do backup: ")
    try:
        counts, files = asyncio.run(restore(sys.argv[1], passphrase))
    except ValueError as exc:
        sys.exit(f"Erro: {exc}")
    print(f"Restaurado: {sum(counts.values())} linhas em {len(counts)} tabelas e {files} imagens.")
    for name, n in counts.items():
        print(f"  {name}: {n}")


if __name__ == "__main__":
    main()
