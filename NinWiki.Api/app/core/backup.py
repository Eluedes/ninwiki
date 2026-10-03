"""
Backup completo do wiki: banco de dados + imagens (pasta uploads/) num UNICO arquivo criptografado, que o bot guarda num canal privado do Discord.

POR QUE ASSIM: a SquareCloud nao tem `pg_dump` para o app, entao a propria API le' todas as tabelas e escreve um arquivo proprio.
CONTEUDO (um .tar.gz): `db.ndjson` (uma linha JSON por registro, tabelas na ordem das chaves estrangeiras) + `uploads/<arquivo>` de cada imagem.
CRIPTOGRAFIA: o .tar.gz passa por blocos de 1 MB, cada um cifrado com Fernet (AES-128 + HMAC) com chave derivada da senha BACKUP_PASSPHRASE por scrypt
(sal aleatorio por arquivo). Em blocos para NAO carregar tudo na memoria (o app tem so' 512 MB). Formato: b"NINBK2" + sal(16) + [tamanho(4) + token]...
O arquivo tem dados pessoais (IDs do Discord da equipe e dos leitores, IPs do log): por isso NUNCA e' gerado sem senha.
Restaurar: scripts/restaurar_backup.py.
"""
import asyncio
import base64
import datetime as dt
import decimal
import enum
import json
import os
import struct
import tarfile
import tempfile
import time
import uuid
from pathlib import Path
from typing import BinaryIO

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from sqlalchemy import Date, DateTime, LargeBinary, Numeric, Uuid, select
from sqlalchemy.ext.asyncio import AsyncSession

import app.models  # noqa: F401 - registra todas as tabelas no Base.metadata
from app.models.base import Base

MAGIC = b"NINBK2"
FRAME = 1024 * 1024         # tamanho de cada bloco cifrado
CHUNK = 2000                # linhas lidas por vez de cada tabela
KEEP_TEMP_SECONDS = 2 * 3600   # arquivos temporarios de backup mais velhos que isto sao apagados
BACKUP_DIR = Path(tempfile.gettempdir()) / "ninwiki-backups"


def _derive_key(passphrase: str, salt: bytes) -> bytes:
    """Chave de 32 bytes (formato Fernet) a partir da senha e do sal, com scrypt (caro de proposito: dificulta adivinhar a senha)."""
    raw = Scrypt(salt=salt, length=32, n=2**15, r=8, p=1).derive(passphrase.encode("utf-8"))
    return base64.urlsafe_b64encode(raw)


class EncryptingWriter:
    """Arquivo "de escrita" que cifra em blocos de 1 MB tudo o que recebe e grava em `dst` (cabecalho com o sal na criacao)."""

    def __init__(self, dst: BinaryIO, passphrase: str) -> None:
        salt = os.urandom(16)
        self._fernet = Fernet(_derive_key(passphrase, salt))
        self._dst, self._buf = dst, bytearray()
        dst.write(MAGIC + salt)

    def write(self, data: bytes) -> int:
        """Recebe bytes (do tar/gzip), acumula e grava um bloco cifrado a cada 1 MB."""
        self._buf += data
        while len(self._buf) >= FRAME:
            self._flush(bytes(self._buf[:FRAME]))
            del self._buf[:FRAME]
        return len(data)

    def _flush(self, block: bytes) -> None:
        """Cifra um bloco e grava tamanho + token."""
        token = self._fernet.encrypt(block)
        self._dst.write(struct.pack(">I", len(token)) + token)

    def close(self) -> None:
        """Grava o ultimo bloco (parcial). Nao fecha o arquivo de destino."""
        if self._buf:
            self._flush(bytes(self._buf))
            self._buf.clear()


def decrypt_to(src: BinaryIO, dst: BinaryIO, passphrase: str) -> None:
    """Decifra um arquivo .nbk inteiro para `dst` (bloco a bloco). ValueError se nao for backup do NinWiki ou se a senha estiver errada."""
    head = src.read(len(MAGIC) + 16)
    if len(head) < len(MAGIC) + 16 or not head.startswith(MAGIC):
        raise ValueError("This is not a NinWiki backup file (or it is incomplete: did you join all the parts?)")
    fernet = Fernet(_derive_key(passphrase, head[len(MAGIC):]))
    while True:
        size = src.read(4)
        if not size:
            return
        token = src.read(struct.unpack(">I", size)[0])
        try:
            dst.write(fernet.decrypt(token))
        except InvalidToken as exc:
            raise ValueError("Wrong passphrase or corrupted backup") from exc


def _jsonable(value):
    """Valor de uma coluna em algo que o JSON entende (e que `restore_value` sabe desfazer)."""
    if isinstance(value, enum.Enum):
        return value.name
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if isinstance(value, (uuid.UUID, decimal.Decimal)):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"$b64": base64.b64encode(bytes(value)).decode()}
    return value


def restore_value(column, value):
    """Desfaz `_jsonable` conforme o tipo da coluna (datas, UUID, decimais e bytes voltam ao tipo certo; enum volta pelo nome)."""
    if value is None:
        return None
    t = column.type
    if isinstance(t, DateTime):
        return dt.datetime.fromisoformat(value)
    if isinstance(t, Date):
        return dt.date.fromisoformat(value)
    if isinstance(t, Uuid):
        return uuid.UUID(value)
    if isinstance(t, Numeric):
        return decimal.Decimal(value)
    if isinstance(t, LargeBinary) and isinstance(value, dict):
        return base64.b64decode(value["$b64"])
    return value


async def dump_database(db: AsyncSession, path: Path, exclude: set[str]) -> dict[str, int]:
    """Escreve o banco em `path` (NDJSON): cabecalho {"format": 1, ...} e depois {"t": tabela, "r": {coluna: valor}} por linha. Devolve linhas por tabela."""
    counts: dict[str, int] = {}
    names = [t.name for t in Base.metadata.sorted_tables if t.name not in exclude]
    with open(path, "w", encoding="utf-8") as out:
        out.write(json.dumps({"format": 1, "created": dt.datetime.now(dt.timezone.utc).isoformat(), "tables": names}) + "\n")
        for table in Base.metadata.sorted_tables:
            if table.name in exclude:
                continue
            counts[table.name] = 0
            result = await db.stream(select(table))
            async for rows in result.partitions(CHUNK):
                for row in rows:
                    out.write(json.dumps({"t": table.name, "r": {c.name: _jsonable(getattr(row, c.key)) for c in table.columns}}, ensure_ascii=False, default=str) + "\n")
                    counts[table.name] += 1
    return counts


def _write_archive(db_file: Path, uploads_dir: Path, out_path: Path, passphrase: str) -> int:
    """(Roda numa thread) Monta o tar.gz (banco + imagens) cifrando em blocos direto para `out_path`. Devolve quantas imagens entraram."""
    files = 0
    with open(out_path, "wb") as dst:
        writer = EncryptingWriter(dst, passphrase)
        with tarfile.open(fileobj=writer, mode="w|gz") as tar:
            tar.add(db_file, arcname="db.ndjson")
            if uploads_dir.is_dir():
                for p in sorted(uploads_dir.iterdir()):
                    if p.is_file() and not p.name.startswith("."):
                        tar.add(p, arcname=f"uploads/{p.name}")
                        files += 1
        writer.close()
    return files


def cleanup_old(max_age: int = KEEP_TEMP_SECONDS) -> None:
    """Apaga arquivos temporarios de backup antigos (o bot normalmente ja' apaga o seu depois de baixar)."""
    if not BACKUP_DIR.is_dir():
        return
    now = time.time()
    for p in BACKUP_DIR.iterdir():
        if p.is_file() and now - p.stat().st_mtime > max_age:
            p.unlink(missing_ok=True)


async def create_backup(db: AsyncSession, passphrase: str, uploads_dir: Path, exclude: set[str] | None = None) -> dict:
    """
    Gera o backup cifrado em BACKUP_DIR e devolve {"id", "path", "size", "rows", "files", "tables"}. O arquivo fica no disco ate' o bot baixar e
    mandar apagar (ou ate' ser limpo por `cleanup_old`).
    """
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    cleanup_old()
    backup_id = uuid.uuid4().hex
    db_file = BACKUP_DIR / f"{backup_id}.ndjson"
    out_path = BACKUP_DIR / f"{backup_id}.nbk"
    try:
        counts = await dump_database(db, db_file, exclude or set())
        files = await asyncio.to_thread(_write_archive, db_file, uploads_dir, out_path, passphrase)
    finally:
        db_file.unlink(missing_ok=True)
    return {"id": backup_id, "path": out_path, "size": out_path.stat().st_size, "rows": sum(counts.values()), "files": files, "tables": counts}
