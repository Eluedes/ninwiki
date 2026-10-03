"""
Conexao com o banco por TLS com CERTIFICADO DE CLIENTE (o que a SquareCloud usa nos bancos PostgreSQL deles).

No painel do banco da SquareCloud voce baixa 3 arquivos:
  - Certificate CA (.crt)  -> a "autoridade" que assina o banco: serve para a API CONFIAR no servidor;
  - PEM (.pem)             -> o certificado do CLIENTE (o da nossa API): prova para o banco quem somos;
  - Private Key (.key)     -> a chave privada desse certificado (SECRETA: nunca vai pro Git).
Configure no .env (caminhos relativos a' pasta NinWiki.Api, ex: certs/ca.crt):
  DATABASE_SSL_CA=certs/ca.crt   DATABASE_SSL_CERT=certs/client.pem   DATABASE_SSL_KEY=certs/client.key
Em PRODUCAO (SquareCloud) nenhum arquivo de certificado vai para o app: cole o TEXTO de cada arquivo (-----BEGIN ... END-----) direto nas
Variaveis de Ambiente DATABASE_SSL_CA / DATABASE_SSL_CERT / DATABASE_SSL_KEY. O codigo grava esse texto num arquivo temporario
(permissao 0600, fora da pasta do app, apagado ao sair) so' para o TLS poder le'-lo. Quebras de linha podem vir como "\\n".
Se o .pem ja' tiver a chave dentro, deixe DATABASE_SSL_KEY vazio. Sem nenhuma dessas variaveis nada muda (banco local, sem TLS).

Este modulo NAO le' configuracao sozinho: recebe os caminhos por parametro, para servir tanto a API (pydantic-settings)
quanto o Alembic (que le' o .env por conta propria) - ver app/core/database.py e alembic/env.py.
"""
import atexit
import os
import shutil
import ssl
import tempfile
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent.parent  # pasta NinWiki.Api


_PEM_CACHE: dict[str, str] = {}


def _pem_to_tempfile(text: str) -> str:
    """Grava o TEXTO de um certificado/chave num arquivo temporario 0600 (apagado ao sair) e devolve o caminho. Reaproveita o mesmo arquivo."""
    if text in _PEM_CACHE:
        return _PEM_CACHE[text]
    fd, tmp = tempfile.mkstemp(prefix="ninwiki-tls-", suffix=".pem")
    with os.fdopen(fd, "w") as fh:
        fh.write(text.replace("\\n", "\n").strip() + "\n")
    os.chmod(tmp, 0o600)
    atexit.register(lambda: Path(tmp).unlink(missing_ok=True))
    _PEM_CACHE[text] = tmp
    return tmp


def resolve(path: str) -> str:
    """Caminho absoluto de um certificado (relativo a' pasta NinWiki.Api quando nao for absoluto). Aceita tambem o TEXTO do certificado
    (comeca com -----BEGIN): vira um arquivo temporario seguro. Falha claro se o arquivo nao existir."""
    path = path.strip().strip('"').strip("'")  # o painel pede aspas em valores com espacos: se vierem junto, ignora
    if path.startswith("-----BEGIN"):
        return _pem_to_tempfile(path)
    p = Path(path)
    if not p.is_absolute():
        p = API_ROOT / p
    if not p.is_file():
        raise FileNotFoundError(
            f"Arquivo de certificado do banco nao encontrado: {p}. Em producao, cole o TEXTO do certificado (-----BEGIN ...) "
            "na variavel DATABASE_SSL_CA/CERT/KEY em vez de um caminho de arquivo (ver README)."
        )
    return str(p)


def is_enabled(ca: str, cert: str, key: str) -> bool:
    """True se pelo menos um dos tres certificados foi configurado (liga o TLS com certificado)."""
    return bool(ca or cert or key)


def asyncpg_ssl_context(ca: str, cert: str, key: str, verify_hostname: bool = False) -> ssl.SSLContext:
    """
    Contexto TLS para o asyncpg (a API): confia na CA informada, exige que o servidor apresente um certificado valido
    assinado por ela e apresenta o certificado de cliente. verify_hostname=False confere a cadeia (verify-ca) mas nao
    o nome do host - bancos hospedados costumam ter certificado emitido para outro nome; ligue se o seu bater.
    """
    ctx = ssl.create_default_context(cafile=resolve(ca) if ca else None)
    ctx.check_hostname = verify_hostname
    ctx.verify_mode = ssl.CERT_REQUIRED
    if cert:
        ctx.load_cert_chain(certfile=resolve(cert), keyfile=resolve(key) if key else None)
    return ctx


def private_key_for_libpq(path: str) -> str:
    """
    O libpq (Alembic) RECUSA uma chave privada legivel por outros usuarios ("private key file has group or world
    access") - e um zip enviado para a SquareCloud costuma extrair os arquivos como 0644. Se a permissao estiver aberta
    demais (Linux/Mac), usa uma COPIA temporaria com permissao 0600, apagada ao sair. No Windows nada muda.
    """
    if os.name == "nt" or (Path(path).stat().st_mode & 0o077) == 0:
        return path
    fd, tmp = tempfile.mkstemp(prefix="ninwiki-key-")
    os.close(fd)
    shutil.copyfile(path, tmp)
    os.chmod(tmp, 0o600)
    atexit.register(lambda: Path(tmp).unlink(missing_ok=True))
    return tmp


def libpq_args(ca: str, cert: str, key: str, verify_hostname: bool = False) -> dict[str, str]:
    """Os mesmos certificados no formato do libpq/psycopg (usado pelo Alembic, que roda em modo sincrono)."""
    args: dict[str, str] = {"sslmode": "verify-full" if verify_hostname else "verify-ca"}
    if ca:
        args["sslrootcert"] = resolve(ca)
    if cert:
        args["sslcert"] = resolve(cert)
    if key:
        args["sslkey"] = private_key_for_libpq(resolve(key))
    return args
